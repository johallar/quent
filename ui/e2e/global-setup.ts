// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { FullConfig } from '@playwright/test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const e2eDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(e2eDir, '..');
const repoRoot = path.resolve(uiRoot, '..');
const dataDir = process.env.PLAYWRIGHT_E2E_DATA_DIR ?? path.join(uiRoot, '.e2e-data');
const analyzerUrl = process.env.PLAYWRIGHT_API_BASE_URL ?? 'http://127.0.0.1:18080';
const collectorAddress = process.env.PLAYWRIGHT_COLLECTOR_ADDRESS ?? '127.0.0.1:17836';
const collectorUrl = process.env.PLAYWRIGHT_COLLECTOR_URL ?? `http://${collectorAddress}`;
const engineId = '00000000-0000-0000-0000-000000000001';
const queryGroupId = '00000000-0000-0000-0000-000000000003';
const queryId = '00000000-0000-0000-0000-000000000004';
const cargoCommand = process.env.PLAYWRIGHT_CARGO_COMMAND?.split(/\s+/).filter(Boolean) ?? [
  'cargo',
];

type ChildProcess = ReturnType<typeof spawn>;

function captureOutput(child: ChildProcess) {
  const chunks: string[] = [];
  const capture = (chunk: Buffer) => {
    chunks.push(chunk.toString());
    if (chunks.length > 80) {
      chunks.shift();
    }
  };

  child.stdout?.on('data', capture);
  child.stderr?.on('data', capture);

  return () => chunks.join('');
}

async function waitForUrl(url: string, isReady: (response: Response) => Promise<boolean>) {
  const deadline = Date.now() + 120_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (await isReady(response)) {
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${String(lastError)}` : ''}`);
}

async function runCargo(args: string[]) {
  const child = spawn(cargoCommand[0], [...cargoCommand.slice(1), ...args], {
    cwd: repoRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = captureOutput(child);
  const [code, signal] = (await once(child, 'exit')) as [number | null, NodeJS.Signals | null];

  if (code !== 0) {
    throw new Error(
      `${[...cargoCommand, ...args].join(' ')} failed with ${signal ?? `exit code ${code}`}\n${output()}`
    );
  }
}

async function stopProcess(child: ChildProcess) {
  if (child.exitCode != null || child.pid == null) {
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill('SIGTERM');
  }

  const exit = once(child, 'exit');
  const timeout = new Promise(resolve => setTimeout(resolve, 5_000, 'timeout'));
  if ((await Promise.race([exit, timeout])) === 'timeout') {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      child.kill('SIGKILL');
    }
  }
}

async function globalSetup(_config: FullConfig) {
  await rm(dataDir, { recursive: true, force: true });
  await mkdir(dataDir, { recursive: true });

  const server = spawn(
    cargoCommand[0],
    [
      ...cargoCommand.slice(1),
      'run',
      '-p',
      'quent-simulator-server',
      '--',
      '--log-level',
      'warn',
      '--collector-address',
      collectorAddress,
      '--analyzer-address',
      new URL(analyzerUrl).host,
      '--cors-address',
      'http://127.0.0.1:5173',
      '--output-dir',
      dataDir,
    ],
    {
      cwd: repoRoot,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );
  const serverOutput = captureOutput(server);

  try {
    await Promise.race([
      waitForUrl(`${analyzerUrl}/api/engines`, async response => response.ok),
      once(server, 'exit').then(([code, signal]) => {
        throw new Error(
          `quent-simulator-server exited before it was ready with ${signal ?? `exit code ${code}`}\n${serverOutput()}`
        );
      }),
    ]);

    await runCargo([
      'run',
      '-p',
      'quent-query-engine-fixed',
      '--',
      '--collector-address',
      collectorUrl,
    ]);

    await waitForUrl(`${analyzerUrl}/api/engines?with_metadata=true`, async response => {
      if (!response.ok) {
        return false;
      }

      const engines = (await response.json()) as Array<{ id: string; instance_name?: string }>;
      return engines.some(
        engine => engine.id === engineId && engine.instance_name === 'test-engine'
      );
    });
    await waitForUrl(`${analyzerUrl}/api/engines/${engineId}/query-groups`, async response => {
      if (!response.ok) {
        return false;
      }

      const groups = (await response.json()) as Array<{ id: string; instance_name?: string }>;
      return groups.some(
        group => group.id === queryGroupId && group.instance_name === 'test-group'
      );
    });
    await waitForUrl(
      `${analyzerUrl}/api/engines/${engineId}/query_group/${queryGroupId}/queries`,
      async response => {
        if (!response.ok) {
          return false;
        }

        const queries = (await response.json()) as Array<{ id: string; instance_name?: string }>;
        return queries.some(query => query.id === queryId && query.instance_name === 'test-query');
      }
    );
  } catch (error) {
    await stopProcess(server);
    throw error;
  }

  return async () => {
    await stopProcess(server);
  };
}

export default globalSetup;

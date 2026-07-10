// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(scriptDir, '..');
const repoRoot = path.resolve(uiRoot, '..');
const e2eDir = path.join(uiRoot, 'e2e');
const dockerfile = path.join(uiRoot, 'docker', 'Dockerfile.snapshots');
const image = 'quent-playwright-snapshots:local';
const supportedPlatforms = new Set(['darwin', 'linux', 'all']);

function parseArguments(argv) {
  let platform;
  const playwrightArgs = [];

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--platform') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error('--platform requires darwin, linux, or all.');
      }
      platform = value;
      index += 1;
    } else if (argument.startsWith('--platform=')) {
      platform = argument.slice('--platform='.length);
    } else {
      playwrightArgs.push(argument);
    }
  }

  const targetPlatform = platform ?? process.platform;
  if (!supportedPlatforms.has(targetPlatform)) {
    throw new Error(`Unsupported platform "${targetPlatform}". Expected darwin, linux, or all.`);
  }
  if (targetPlatform === 'all' && process.platform !== 'darwin') {
    throw new Error('Generating all snapshots requires macOS for the Darwin baseline.');
  }

  return { targetPlatform, playwrightArgs };
}

async function run(command, args, options = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: process.env,
      stdio: 'inherit',
    });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(`${command} failed with ${signal ? `signal ${signal}` : `exit code ${code}`}`)
        );
      }
    });
  });
}

async function updateDarwin(playwrightArgs) {
  if (process.platform !== 'darwin') {
    throw new Error('Darwin snapshots must be generated natively on macOS.');
  }

  console.log('Generating Darwin golden images with native Playwright...');
  await run('pnpm', ['exec', 'playwright', 'test', '--update-snapshots=all', ...playwrightArgs], {
    cwd: uiRoot,
  });
}

async function updateLinux(playwrightArgs) {
  if (process.platform === 'linux') {
    console.log('Generating Linux golden images with native Playwright...');
    await run('pnpm', ['exec', 'playwright', 'test', '--update-snapshots=all', ...playwrightArgs], {
      cwd: uiRoot,
    });
    return;
  }

  console.log('Building the Linux/amd64 Playwright snapshot image...');
  await run('docker', [
    'build',
    '--platform=linux/amd64',
    '--file',
    dockerfile,
    '--tag',
    image,
    repoRoot,
  ]);

  console.log('Generating Linux golden images in Docker...');
  await run('docker', [
    'run',
    '--rm',
    '--init',
    '--ipc=host',
    '--platform=linux/amd64',
    '--env',
    `HOST_UID=${process.getuid?.() ?? 0}`,
    '--env',
    `HOST_GID=${process.getgid?.() ?? 0}`,
    '--env',
    'PLAYWRIGHT_SNAPSHOT_DIR=/snapshots',
    '--volume',
    `${e2eDir}:/snapshots`,
    image,
    'bash',
    '/quent/ui/scripts/run-snapshot-container.sh',
    ...playwrightArgs,
  ]);
}

async function main() {
  const { targetPlatform, playwrightArgs } = parseArguments(process.argv.slice(2));

  if (targetPlatform === 'darwin' || targetPlatform === 'all') {
    await updateDarwin(playwrightArgs);
  }
  if (targetPlatform === 'linux' || targetPlatform === 'all') {
    await updateLinux(playwrightArgs);
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});

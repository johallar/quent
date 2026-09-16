// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { parseArgs } from 'node:util';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  fetchQueryBundle,
  setApiBaseUrl,
} from '@quent/client';
import type { AskCommand } from './askCommand.types';
import {
  createNonInteractiveSelector,
  createTerminalSelector,
  selectEngine,
  selectQueryGroup,
  type DiscoveryApi,
} from './askSelection';
import { machineResult, serializeMachineOutput } from './machineOutput';

type NamedEntity = { id: string; instance_name: string | null };

const api: DiscoveryApi = {
  fetchListEngines,
  fetchListCoordinators,
  fetchListQueries,
  fetchQueryBundle,
};

function configureApi(apiBase: string | undefined): void {
  const resolved = apiBase ?? process.env.QUENT_API_BASE_URL ?? 'http://localhost:8080/api';
  setApiBaseUrl(resolved.replace(/\/+$/u, ''));
}

function sorted<T extends NamedEntity>(items: T[]): T[] {
  return items.sort(
    (left, right) =>
      (left.instance_name ?? left.id).localeCompare(right.instance_name ?? right.id) ||
      left.id.localeCompare(right.id)
  );
}

function formatList(title: string, items: NamedEntity[]): string {
  return [
    title,
    ...items.map(item =>
      item.instance_name && item.instance_name !== item.id
        ? `  ${item.instance_name} (${item.id})`
        : `  ${item.id}`
    ),
  ].join('\n');
}

function selector(json: boolean | undefined) {
  return json ? createNonInteractiveSelector() : createTerminalSelector();
}

export const enginesCommand: AskCommand = {
  id: 'engines',
  explanation: 'Lists engines available from the Quent API.',
  usage: `Usage:
  pnpm ask engines [--api-base URL] [--json]

Options:
  --api-base URL          API base (default: QUENT_API_BASE_URL or http://localhost:8080/api)
  --json                  Emit versioned JSON`,
  async run(args) {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      options: {
        'api-base': { type: 'string' },
        json: { type: 'boolean' },
      },
    });
    configureApi(values['api-base']);
    const engines = sorted(await api.fetchListEngines());
    process.stdout.write(
      values.json
        ? serializeMachineOutput(machineResult('engines', engines))
        : `${formatList('Engines', engines)}\n`
    );
  },
};

export const queryGroupsCommand: AskCommand = {
  id: 'query-groups',
  explanation: 'Lists query groups for an engine.',
  usage: `Usage:
  pnpm ask query-groups [--engine ID] [--api-base URL] [--json]

Options:
  --engine ID             Engine ID (required with --json)
  --api-base URL          API base (default: QUENT_API_BASE_URL or http://localhost:8080/api)
  --json                  Emit versioned JSON; never open interactive prompts`,
  async run(args) {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      options: {
        'api-base': { type: 'string' },
        engine: { type: 'string' },
        json: { type: 'boolean' },
      },
    });
    configureApi(values['api-base']);
    if (values.json && !values.engine) {
      throw new Error('JSON mode requires explicit --engine. Run "pnpm ask engines --json" first.');
    }
    const engineId =
      values.engine ?? (await selectEngine(api, selector(values.json), 'Select an engine'));
    const groups = sorted(await api.fetchListCoordinators(engineId));
    const data = { engineId, queryGroups: groups };
    process.stdout.write(
      values.json
        ? serializeMachineOutput(machineResult('query-groups', data))
        : `${formatList(`Query groups for ${engineId}`, groups)}\n`
    );
  },
};

export const queriesCommand: AskCommand = {
  id: 'queries',
  explanation: 'Lists queries for an engine and query group.',
  usage: `Usage:
  pnpm ask queries [--engine ID] [--query-group ID] [--api-base URL] [--json]

Options:
  --engine ID             Engine ID (required with --json)
  --query-group ID        Query group ID (required with --json)
  --api-base URL          API base (default: QUENT_API_BASE_URL or http://localhost:8080/api)
  --json                  Emit versioned JSON; never open interactive prompts`,
  async run(args) {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      options: {
        'api-base': { type: 'string' },
        engine: { type: 'string' },
        json: { type: 'boolean' },
        'query-group': { type: 'string' },
      },
    });
    configureApi(values['api-base']);
    if (values.json && (!values.engine || !values['query-group'])) {
      const missing = [
        !values.engine && '--engine',
        !values['query-group'] && '--query-group',
      ].filter((option): option is string => Boolean(option));
      throw new Error(
        `JSON mode requires explicit ${missing.join(', ')}. Use the discovery commands to find IDs.`
      );
    }
    const select = selector(values.json);
    const engineId = values.engine ?? (await selectEngine(api, select, 'Select an engine'));
    const queryGroupId =
      values['query-group'] ??
      (await selectQueryGroup(api, select, engineId, 'Select a query group'));
    const queries = sorted(await api.fetchListQueries(engineId, queryGroupId));
    const data = { engineId, queryGroupId, queries };
    process.stdout.write(
      values.json
        ? serializeMachineOutput(machineResult('queries', data))
        : `${formatList(`Queries for ${queryGroupId}`, queries)}\n`
    );
  },
};

export const discoveryCommands = [enginesCommand, queryGroupsCommand, queriesCommand] as const;

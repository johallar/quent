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
import { diffQueryBundles } from '@quent/query-diff';
import {
  createTerminalSelector,
  selectEngine,
  selectQuery,
  type DiscoveryApi,
  type SelectFromList,
} from './askSelection';
import type { AskCommand } from './askCommand.types';
import { formatQueryDiff } from './queryDiffFormat';

const usage = `Usage:
  pnpm ask query-diff [options]

Options:
  --engine ID             Engine containing both queries
  --baseline-engine ID    Baseline engine (overrides --engine)
  --candidate-engine ID   Candidate engine (overrides --engine)
  --baseline-query ID     Baseline query (select from API results when omitted)
  --candidate-query ID    Candidate query (select from API results when omitted)
  --api-base URL          API base (default: QUENT_API_BASE_URL or http://localhost:8080/api)
  --json                  Emit machine-readable JSON`;

function optionalId(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

interface QueryDiffSelections {
  baselineEngineId: string;
  baselineQueryId: string;
  candidateEngineId: string;
  candidateQueryId: string;
}

export async function resolveQueryDiffSelections(
  values: Record<string, string | boolean | undefined>,
  api: DiscoveryApi,
  select: SelectFromList
): Promise<QueryDiffSelections> {
  const commonEngineId = optionalId(values.engine);
  const baselineEngineId =
    optionalId(values['baseline-engine']) ??
    commonEngineId ??
    (await selectEngine(api, select, 'Select the baseline engine'));
  const baselineQueryId =
    optionalId(values['baseline-query']) ??
    (await selectQuery(api, select, baselineEngineId, 'Select the baseline query'));
  const candidateEngineId =
    optionalId(values['candidate-engine']) ??
    commonEngineId ??
    (await selectEngine(api, select, 'Select the candidate engine'));
  const excludedCandidateIds =
    candidateEngineId === baselineEngineId ? new Set([baselineQueryId]) : new Set<string>();
  const candidateQueryId =
    optionalId(values['candidate-query']) ??
    (await selectQuery(
      api,
      select,
      candidateEngineId,
      'Select the candidate query',
      excludedCandidateIds
    ));
  return { baselineEngineId, baselineQueryId, candidateEngineId, candidateQueryId };
}

export const queryDiffCommand: AskCommand = {
  id: 'query-diff',
  explanation: 'Compares numeric operator statistics and active spans from two query bundles.',
  usage,
  async run(args) {
    const { values } = parseArgs({
      args,
      allowPositionals: false,
      options: {
        'api-base': { type: 'string' },
        'baseline-engine': { type: 'string' },
        'baseline-query': { type: 'string' },
        'candidate-engine': { type: 'string' },
        'candidate-query': { type: 'string' },
        engine: { type: 'string' },
        json: { type: 'boolean' },
      },
    });

    const apiBase =
      values['api-base'] ?? process.env.QUENT_API_BASE_URL ?? 'http://localhost:8080/api';
    setApiBaseUrl(apiBase.replace(/\/+$/u, ''));

    const api: DiscoveryApi = {
      fetchListEngines,
      fetchListCoordinators,
      fetchListQueries,
      fetchQueryBundle,
    };
    const select = createTerminalSelector();
    const { baselineEngineId, baselineQueryId, candidateEngineId, candidateQueryId } =
      await resolveQueryDiffSelections(values, api, select);

    const [baselineBundle, candidateBundle] = await Promise.all([
      fetchQueryBundle(baselineEngineId, baselineQueryId),
      fetchQueryBundle(candidateEngineId, candidateQueryId),
    ]);
    const result = diffQueryBundles(baselineBundle, candidateBundle, {
      baselineEngineId,
      candidateEngineId,
    });
    process.stdout.write(
      values.json
        ? `${JSON.stringify(result, null, 2)}\n`
        : `${formatQueryDiff(result, {
            color: process.stdout.isTTY && !('NO_COLOR' in process.env),
          })}\n`
    );
  },
};

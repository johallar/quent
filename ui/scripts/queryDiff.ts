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
  createNonInteractiveSelector,
  createTerminalSelector,
  discoverQueryTreeChoices,
  selectEngine,
  selectQueriesFromTree,
  selectQuery,
  type DiscoveryApi,
  type QuerySelection,
  type SelectFromList,
  type SelectFromQueryTree,
} from './askSelection';
import type { AskCommand } from './askCommand.types';
import { selectFromQueryTreeWithInk } from './inkSelectorRunner';
import { machineResult, serializeMachineOutput } from './machineOutput';
import { formatQueryDiff } from './queryDiffFormat';

const usage = `Usage:
  pnpm ask query-diff [options]

Options:
  --engine ID             Default engine for the baseline and candidates
  --baseline-engine ID    Baseline engine (overrides --engine)
  --baseline-query ID     Baseline query (select from API results when omitted)
  --candidate-query ID    Candidate query; repeat for multiple on one engine
  --candidate-engine ID   Candidate engine; one for all queries or one per query
  --candidate ENGINE:QUERY
                          Qualified candidate; repeat for cross-engine comparison
  --api-base URL          API base (default: QUENT_API_BASE_URL or http://localhost:8080/api)
  --json                  Emit versioned JSON; never open interactive prompts`;

type QueryDiffCliValue = string | string[] | boolean | undefined;
type QueryDiffCliValues = Record<string, QueryDiffCliValue>;

function optionalId(value: QueryDiffCliValue): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function ids(value: QueryDiffCliValue): string[] {
  if (Array.isArray(value)) {
    return value.map(item => item.trim()).filter(Boolean);
  }
  const id = optionalId(value);
  return id ? [id] : [];
}

export interface QueryDiffSelections {
  baseline: QuerySelection;
  candidates: QuerySelection[];
}

function parseQualifiedCandidate(value: string): QuerySelection {
  const separator = value.indexOf(':');
  const engineId = value.slice(0, separator).trim();
  const queryId = value.slice(separator + 1).trim();
  if (separator <= 0 || !engineId || !queryId) {
    throw new Error(`Invalid candidate "${value}"; expected ENGINE:QUERY.`);
  }
  return { engineId, queryId };
}

function candidateEngineIds(
  queryIds: string[],
  engines: string[],
  commonEngineId: string | undefined
): string[] | null {
  if (engines.length === 1) {
    return queryIds.map(() => engines[0]!);
  }
  if (engines.length === queryIds.length) {
    return engines;
  }
  if (engines.length === 0 && commonEngineId) {
    return queryIds.map(() => commonEngineId);
  }
  if (engines.length === 0) {
    return null;
  }
  throw new Error(
    'Pass one --candidate-engine for all candidate queries or one --candidate-engine per query.'
  );
}

function uniqueCandidates(
  baseline: QuerySelection,
  candidates: QuerySelection[]
): QuerySelection[] {
  const baselineKey = `${baseline.engineId}\0${baseline.queryId}`;
  const seen = new Set<string>();
  return candidates.filter(candidate => {
    const key = `${candidate.engineId}\0${candidate.queryId}`;
    if (key === baselineKey) {
      throw new Error('The baseline query cannot also be a candidate.');
    }
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export async function resolveQueryDiffSelections(
  values: QueryDiffCliValues,
  api: DiscoveryApi,
  select: SelectFromList,
  selectTree: SelectFromQueryTree = selectFromQueryTreeWithInk
): Promise<QueryDiffSelections> {
  const commonEngineId = optionalId(values.engine);
  let treeChoices: Awaited<ReturnType<typeof discoverQueryTreeChoices>> | undefined;
  const getTreeChoices = async () => {
    treeChoices ??= await discoverQueryTreeChoices(api);
    return treeChoices;
  };
  const explicitBaselineEngineId = optionalId(values['baseline-engine']) ?? commonEngineId;
  const explicitBaselineQueryId = optionalId(values['baseline-query']);
  let baseline: QuerySelection;
  if (!explicitBaselineEngineId && !explicitBaselineQueryId) {
    [baseline] = await selectQueriesFromTree(
      api,
      selectTree,
      'Select the baseline query',
      false,
      new Set(),
      await getTreeChoices()
    );
  } else {
    const engineId =
      explicitBaselineEngineId ?? (await selectEngine(api, select, 'Select the baseline engine'));
    const queryId =
      explicitBaselineQueryId ??
      (await selectQuery(api, select, engineId, 'Select the baseline query'));
    baseline = { engineId, queryId };
  }

  const qualified = ids(values.candidate).map(parseQualifiedCandidate);
  const queryIds = ids(values['candidate-query']);
  const engines = ids(values['candidate-engine']);
  let candidates = qualified;
  if (queryIds.length > 0) {
    let resolvedEngines = candidateEngineIds(queryIds, engines, commonEngineId);
    if (!resolvedEngines) {
      const engineId = await selectEngine(api, select, 'Select the candidate engine');
      resolvedEngines = queryIds.map(() => engineId);
    }
    candidates = [
      ...candidates,
      ...queryIds.map((queryId, index) => ({
        engineId: resolvedEngines[index]!,
        queryId,
      })),
    ];
  }
  if (candidates.length === 0) {
    candidates = await selectQueriesFromTree(
      api,
      selectTree,
      'Select candidate queries',
      true,
      new Set([`${baseline.engineId}\0${baseline.queryId}`]),
      await getTreeChoices()
    );
  }
  return { baseline, candidates: uniqueCandidates(baseline, candidates) };
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
        candidate: { type: 'string', multiple: true },
        'candidate-engine': { type: 'string', multiple: true },
        'candidate-query': { type: 'string', multiple: true },
        engine: { type: 'string' },
        json: { type: 'boolean' },
      },
    });

    const apiBase =
      values['api-base'] ?? process.env.QUENT_API_BASE_URL ?? 'http://localhost:8080/api';
    setApiBaseUrl(apiBase.replace(/\/+$/u, ''));

    if (values.json) {
      const qualifiedCount = ids(values.candidate).length;
      const candidateQueryCount = ids(values['candidate-query']).length;
      const hasCandidates = qualifiedCount > 0 || candidateQueryCount > 0;
      const candidateQueriesHaveEngine =
        candidateQueryCount === 0 ||
        ids(values['candidate-engine']).length > 0 ||
        Boolean(values.engine);
      const missing = [
        !values.engine && !values['baseline-engine'] && '--baseline-engine or --engine',
        !values['baseline-query'] && '--baseline-query',
        !hasCandidates && '--candidate or --candidate-query',
        hasCandidates && !candidateQueriesHaveEngine && '--candidate-engine or --engine',
      ].filter((option): option is string => Boolean(option));
      if (missing.length > 0) {
        throw new Error(
          `JSON mode requires explicit ${missing.join(', ')}. Use the discovery commands to find IDs.`
        );
      }
    }
    const api: DiscoveryApi = {
      fetchListEngines,
      fetchListCoordinators,
      fetchListQueries,
      fetchQueryBundle,
    };
    const select = values.json ? createNonInteractiveSelector() : createTerminalSelector();
    const selectTree: SelectFromQueryTree = values.json
      ? async () => {
          throw new Error('Query tree selection is unavailable in JSON mode.');
        }
      : selectFromQueryTreeWithInk;
    const { baseline, candidates } = await resolveQueryDiffSelections(
      values,
      api,
      select,
      selectTree
    );

    const [baselineBundle, ...candidateBundles] = await Promise.all([
      fetchQueryBundle(baseline.engineId, baseline.queryId),
      ...candidates.map(candidate => fetchQueryBundle(candidate.engineId, candidate.queryId)),
    ]);
    const result = diffQueryBundles(
      { engineId: baseline.engineId, bundle: baselineBundle },
      candidates.map((candidate, index) => ({
        engineId: candidate.engineId,
        bundle: candidateBundles[index]!,
      }))
    );
    process.stdout.write(
      values.json
        ? serializeMachineOutput(machineResult('query-diff', result))
        : `${formatQueryDiff(result, {
            color: process.stdout.isTTY && !('NO_COLOR' in process.env),
          })}\n`
    );
  },
};

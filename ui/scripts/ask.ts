// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { parseArgs } from 'node:util';
import {
  fetchEntityList,
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  fetchQueryBundle,
  setApiBaseUrl,
  type ApiClient,
} from '@quent/client';
import { getQuestion, questionRegistry } from '../src/features/question-cli/questionRegistry';
import { createTerminalSelector, resolveAskSelections } from './askSelection';

const usage = `Usage:
  pnpm ask longest-resource-users [--engine ID] [--query ID] [--resource ID] [options]

Options:
  --engine ID            Engine ID (select from API results when omitted)
  --query ID             Query ID (select from API results when omitted)
  --resource ID          Resource ID (select from the query bundle when omitted)
  --entity-type NAME     Restrict to one declared FSM entity type
  --operator IDS         Comma-separated operator IDs
  --start SECONDS        Query-relative window start (default: 0)
  --end SECONDS          Query-relative window end (default: query duration)
  --limit COUNT          Maximum results, 1-500 (default: 10)
  --api-base URL         API base (default: QUENT_API_BASE_URL or http://localhost:8000/api)
  --base URL             Quent UI base for an absolute deep link
  --json                 Emit machine-readable JSON

Questions:
${[...questionRegistry.values()]
  .map(question => `  ${question.metadata.id}  ${question.metadata.explanation}`)
  .join('\n')}`;

function fail(message: string): never {
  throw new Error(message);
}

async function main() {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      'api-base': { type: 'string' },
      base: { type: 'string' },
      end: { type: 'string' },
      engine: { type: 'string' },
      'entity-type': { type: 'string' },
      json: { type: 'boolean' },
      limit: { type: 'string' },
      operator: { type: 'string' },
      query: { type: 'string' },
      resource: { type: 'string' },
      start: { type: 'string' },
    },
  });
  const questionId = positionals[0];
  if (!questionId || positionals.length !== 1) {
    fail('Expected exactly one question ID.');
  }
  const question = getQuestion(questionId);
  const apiBase =
    values['api-base'] ?? process.env.QUENT_API_BASE_URL ?? 'http://localhost:8000/api';
  setApiBaseUrl(apiBase.replace(/\/+$/u, ''));

  const selections = await resolveAskSelections({
    values,
    api: {
      fetchListEngines,
      fetchListCoordinators,
      fetchListQueries,
      fetchQueryBundle,
    },
    select: createTerminalSelector(),
    requireResource: question.metadata.parameters.some(
      parameter => parameter.name === 'resource' && parameter.required
    ),
  });
  const result = await question.run(
    {
      engineId: selections.engineId,
      queryId: selections.queryId,
      ...(values.base ? { appBaseUrl: values.base } : {}),
      queryBundle: selections.queryBundle,
      api: {
        fetchEntityList: (engineId, request): ReturnType<ApiClient['fetchEntityList']> =>
          fetchEntityList(engineId, request),
      },
    },
    selections.values
  );
  process.stdout.write(
    values.json ? `${JSON.stringify(result, null, 2)}\n` : `${question.formatHuman(result)}\n`
  );
}

try {
  await main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}\n`);
  process.exitCode = 1;
}

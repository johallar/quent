// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Readable, Writable } from 'node:stream';
import type { ApiClient } from '@quent/client';
import type { EntityRef, QueryBundle } from '@quent/utils';
import type { QuestionCliValues } from '../src/features/question-cli/question.types';
import { selectWithInk } from './inkSelectorRunner';

type TerminalReadable = Readable & { isTTY?: boolean };
type TerminalWritable = Writable & { isTTY?: boolean };

export interface SelectionChoice {
  value: string;
  label: string;
}

export type SelectFromList = (
  prompt: string,
  choices: readonly SelectionChoice[]
) => Promise<string>;

export type DiscoveryApi = Pick<
  ApiClient,
  'fetchListEngines' | 'fetchListCoordinators' | 'fetchListQueries' | 'fetchQueryBundle'
>;

interface ResolveAskSelectionsOptions {
  values: QuestionCliValues;
  api: DiscoveryApi;
  select: SelectFromList;
  requireResource: boolean;
}

export interface ResolvedAskSelections {
  engineId: string;
  queryId: string;
  queryBundle: QueryBundle<EntityRef>;
  values: QuestionCliValues;
}

function optionalId(value: string | boolean | undefined): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function label(name: string | null, id: string): string {
  return name && name !== id ? `${name} (${id})` : id;
}

function stableChoices(choices: SelectionChoice[]): SelectionChoice[] {
  return choices.sort(
    (left, right) => left.label.localeCompare(right.label) || left.value.localeCompare(right.value)
  );
}

export async function selectEngine(
  api: DiscoveryApi,
  select: SelectFromList,
  prompt = 'Select an engine'
): Promise<string> {
  const engines = await api.fetchListEngines();
  const choices = stableChoices(
    engines.map(engine => ({
      value: engine.id,
      label: label(engine.instance_name, engine.id),
    }))
  );
  if (choices.length === 0) {
    throw new Error('The Quent API returned no available engines.');
  }
  return select(prompt, choices);
}

export async function selectQuery(
  api: DiscoveryApi,
  select: SelectFromList,
  engineId: string,
  prompt = 'Select a query',
  excludedQueryIds: ReadonlySet<string> = new Set()
): Promise<string> {
  const groups = await api.fetchListCoordinators(engineId);
  const groupedQueries = await Promise.all(
    groups.map(async group => ({
      group,
      queries: (await api.fetchListQueries(engineId, group.id)).filter(
        query => !excludedQueryIds.has(query.id)
      ),
    }))
  );
  const availableGroups = groupedQueries.filter(({ queries }) => queries.length > 0);
  const groupPrompt = prompt.replace(/\bquery\b/u, 'query group');
  const groupChoices = stableChoices(
    availableGroups.map(({ group, queries }) => ({
      value: group.id,
      label: `${label(group.instance_name, group.id)} · ${queries.length} quer${
        queries.length === 1 ? 'y' : 'ies'
      }`,
    }))
  );
  if (groupChoices.length === 0) {
    throw new Error(`The Quent API returned no available queries for engine "${engineId}".`);
  }
  const groupId = await select(groupPrompt, groupChoices);
  const selectedGroup = availableGroups.find(({ group }) => group.id === groupId);
  if (!selectedGroup) {
    throw new Error(`Selected query group "${groupId}" is unavailable.`);
  }
  const queryChoices = stableChoices(
    selectedGroup.queries.map(query => ({
      value: query.id,
      label: label(query.instance_name, query.id),
    }))
  );
  return select(prompt, queryChoices);
}

async function selectResource(
  bundle: QueryBundle<EntityRef>,
  select: SelectFromList
): Promise<string> {
  const choices = stableChoices(
    Object.values(bundle.entities.resources).flatMap(resource =>
      resource
        ? [
            {
              value: resource.id,
              label: `${resource.instance_name} (${resource.type_name}, ${resource.id})`,
            },
          ]
        : []
    )
  );
  if (choices.length === 0) {
    throw new Error(`Query "${bundle.query_id}" contains no available resources.`);
  }
  return select('Select a resource', choices);
}

export async function resolveAskSelections({
  values,
  api,
  select,
  requireResource,
}: ResolveAskSelectionsOptions): Promise<ResolvedAskSelections> {
  const engineId = optionalId(values.engine) ?? (await selectEngine(api, select));
  const queryId = optionalId(values.query) ?? (await selectQuery(api, select, engineId));
  const queryBundle = await api.fetchQueryBundle(engineId, queryId);
  const resourceId =
    optionalId(values.resource) ??
    (requireResource ? await selectResource(queryBundle, select) : undefined);

  return {
    engineId,
    queryId,
    queryBundle,
    values: {
      ...values,
      engine: engineId,
      query: queryId,
      ...(resourceId ? { resource: resourceId } : {}),
    },
  };
}

export function createTerminalSelector(
  input: TerminalReadable = process.stdin,
  output: TerminalWritable = process.stderr
): SelectFromList {
  return async (prompt, choices) => {
    if (!input.isTTY || !output.isTTY) {
      throw new Error(`${prompt} requires an interactive terminal; pass the corresponding ID.`);
    }
    return await selectWithInk(
      prompt,
      choices,
      input as NodeJS.ReadStream,
      output as NodeJS.WriteStream
    );
  };
}

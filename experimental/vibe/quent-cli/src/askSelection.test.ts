// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '@quent/client';
import type { EntityRef, QueryBundle } from '@quent/utils';
import {
  createNonInteractiveSelector,
  createTerminalSelector,
  querySelectionKey,
  resolveAskSelections,
  selectQueriesFromTree,
  selectQueryGroup,
  selectQuery,
  type SelectFromList,
  type SelectFromQueryTree,
} from './askSelection';

const queryBundle = {
  query_id: 'query-2',
  duration_s: 10,
  entities: {
    resources: {
      'resource-2': {
        id: 'resource-2',
        instance_name: 'GPU Memory',
        type_name: 'Memory',
        parent_group_id: 'gpu',
      },
      'resource-1': {
        id: 'resource-1',
        instance_name: 'Host Memory',
        type_name: 'Memory',
        parent_group_id: 'worker',
      },
    },
  },
} as unknown as QueryBundle<EntityRef>;

function discoveryApi() {
  return {
    fetchListEngines: vi.fn().mockResolvedValue([
      {
        id: 'engine-2',
        instance_name: 'Zeta Engine',
        start_time_unix_ns: null,
        duration_s: null,
        implementation: null,
      },
      {
        id: 'engine-1',
        instance_name: 'Alpha Engine',
        start_time_unix_ns: null,
        duration_s: null,
        implementation: null,
      },
    ]),
    fetchListCoordinators: vi.fn().mockResolvedValue([
      { id: 'group-1', instance_name: 'Warehouse', engine_id: 'engine-2' },
      { id: 'group-2', instance_name: null, engine_id: 'engine-2' },
    ]),
    fetchListQueries: vi.fn().mockImplementation(async (_engineId, groupId) =>
      groupId === 'group-1'
        ? [
            {
              id: 'query-2',
              query_group_id: groupId,
              instance_name: 'Query Z',
              start_unix_ns: null,
              planning_s: null,
              executing_s: null,
              completed_s: null,
            },
          ]
        : [
            {
              id: 'query-1',
              query_group_id: groupId,
              instance_name: 'Query A',
              start_unix_ns: null,
              planning_s: null,
              executing_s: null,
              completed_s: null,
            },
          ]
    ),
    fetchQueryBundle: vi.fn().mockResolvedValue(queryBundle),
  } satisfies Pick<
    ApiClient,
    'fetchListEngines' | 'fetchListCoordinators' | 'fetchListQueries' | 'fetchQueryBundle'
  >;
}

describe('ask CLI selections', () => {
  it('discovers and presents missing engine, query, and resource IDs', async () => {
    const api = discoveryApi();
    const select: SelectFromList = vi.fn(async (prompt, _choices) => {
      if (prompt === 'Select an engine') {
        return 'engine-2';
      }
      if (prompt === 'Select a query group') {
        return 'group-1';
      }
      if (prompt === 'Select a query') {
        return 'query-2';
      }
      expect(prompt).toBe('Select a resource');
      return 'resource-2';
    });

    const resolved = await resolveAskSelections({
      values: {},
      api,
      select,
      requireResource: true,
    });

    expect(api.fetchListCoordinators).toHaveBeenCalledWith('engine-2');
    expect(api.fetchListQueries).toHaveBeenCalledWith('engine-2', 'group-1');
    expect(api.fetchListQueries).toHaveBeenCalledWith('engine-2', 'group-2');
    expect(api.fetchQueryBundle).toHaveBeenCalledWith('engine-2', 'query-2');
    expect(select).toHaveBeenNthCalledWith(1, 'Select an engine', [
      { value: 'engine-1', label: 'Alpha Engine (engine-1)' },
      { value: 'engine-2', label: 'Zeta Engine (engine-2)' },
    ]);
    expect(select).toHaveBeenNthCalledWith(2, 'Select a query group', [
      { value: 'group-2', label: 'group-2 · 1 query' },
      { value: 'group-1', label: 'Warehouse (group-1) · 1 query' },
    ]);
    expect(select).toHaveBeenNthCalledWith(3, 'Select a query', [
      { value: 'query-2', label: 'Query Z (query-2)' },
    ]);
    expect(select).toHaveBeenNthCalledWith(4, 'Select a resource', [
      { value: 'resource-2', label: 'GPU Memory (Memory, resource-2)' },
      { value: 'resource-1', label: 'Host Memory (Memory, resource-1)' },
    ]);
    expect(resolved).toMatchObject({
      engineId: 'engine-2',
      queryId: 'query-2',
      queryBundle,
      values: {
        engine: 'engine-2',
        query: 'query-2',
        resource: 'resource-2',
      },
    });
  });

  it('does not issue list requests for IDs supplied by the caller', async () => {
    const api = discoveryApi();
    const select = vi.fn<SelectFromList>();

    const resolved = await resolveAskSelections({
      values: {
        engine: ' engine-2 ',
        query: ' query-2 ',
        resource: ' resource-1 ',
      },
      api,
      select,
      requireResource: true,
    });

    expect(api.fetchListEngines).not.toHaveBeenCalled();
    expect(api.fetchListCoordinators).not.toHaveBeenCalled();
    expect(api.fetchListQueries).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(api.fetchQueryBundle).toHaveBeenCalledWith('engine-2', 'query-2');
    expect(resolved.values).toMatchObject({
      engine: 'engine-2',
      query: 'query-2',
      resource: 'resource-1',
    });
  });

  it('supports a custom query prompt and excluded query IDs', async () => {
    const api = discoveryApi();
    const select = vi
      .fn<SelectFromList>()
      .mockResolvedValueOnce('group-1')
      .mockResolvedValueOnce('query-2');

    await selectQuery(api, select, 'engine-2', 'Select the candidate query', new Set(['query-1']));

    expect(select).toHaveBeenNthCalledWith(1, 'Select the candidate query group', [
      { value: 'group-1', label: 'Warehouse (group-1) · 1 query' },
    ]);
    expect(select).toHaveBeenNthCalledWith(2, 'Select the candidate query', [
      { value: 'query-2', label: 'Query Z (query-2)' },
    ]);
  });

  it('selects query groups independently for discovery commands', async () => {
    const api = discoveryApi();
    const select = vi.fn<SelectFromList>().mockResolvedValue('group-1');

    await expect(selectQueryGroup(api, select, 'engine-2')).resolves.toBe('group-1');
    expect(select).toHaveBeenCalledWith('Select a query group', [
      { value: 'group-2', label: 'group-2' },
      { value: 'group-1', label: 'Warehouse (group-1)' },
    ]);
  });

  it('builds an all-engine query tree and returns multiple selections', async () => {
    const api = discoveryApi();
    const selectTree = vi
      .fn<SelectFromQueryTree>()
      .mockResolvedValue([
        querySelectionKey('engine-2', 'query-1'),
        querySelectionKey('engine-2', 'query-2'),
      ]);

    await expect(
      selectQueriesFromTree(api, selectTree, 'Select candidates', true)
    ).resolves.toEqual([
      { engineId: 'engine-2', queryId: 'query-1' },
      { engineId: 'engine-2', queryId: 'query-2' },
    ]);
    expect(selectTree).toHaveBeenCalledWith(
      'Select candidates',
      expect.arrayContaining([
        expect.objectContaining({
          engineId: 'engine-2',
          engineLabel: 'Zeta Engine (engine-2)',
          queryGroupId: 'group-1',
          queryGroupLabel: 'Warehouse (group-1)',
          queryId: 'query-2',
        }),
      ]),
      true
    );
  });

  it('fails clearly when interactive selection is unavailable', async () => {
    const input = Object.assign(new PassThrough(), { isTTY: false });
    const output = Object.assign(new PassThrough(), { isTTY: false });
    const select = createTerminalSelector(input, output);

    await expect(
      select('Select an engine', [{ value: 'engine-1', label: 'Engine 1' }])
    ).rejects.toThrow('requires an interactive terminal');
  });

  it('never opens a prompt in JSON mode', async () => {
    const select = createNonInteractiveSelector();

    await expect(select('Select an engine', [])).rejects.toThrow(
      'Select an engine is required in JSON mode'
    );
  });
});

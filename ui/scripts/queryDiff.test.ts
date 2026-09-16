// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { getApiClient, setApiClient, type ApiClient } from '@quent/client';
import type { EntityRef, QueryBundle } from '@quent/utils';
import type { DiscoveryApi, SelectFromList, SelectFromQueryTree } from './askSelection';
import { queryDiffCommand, resolveQueryDiffSelections } from './queryDiff';

const originalClient = getApiClient();

afterEach(() => {
  setApiClient(originalClient);
  vi.restoreAllMocks();
});

function discoveryApi(): DiscoveryApi {
  return {
    fetchListEngines: vi.fn().mockResolvedValue([
      { id: 'engine-1', instance_name: 'Baseline' },
      { id: 'engine-2', instance_name: 'Candidate' },
    ]),
    fetchListCoordinators: vi.fn(async engineId => [
      { id: `group-${engineId}`, instance_name: `Group ${engineId}` },
    ]),
    fetchListQueries: vi.fn(async engineId => [
      {
        id: engineId === 'engine-1' ? 'query-1' : 'query-2',
        instance_name: engineId === 'engine-1' ? 'Old query' : 'New query',
      },
    ]),
    fetchQueryBundle: vi.fn(),
  } as unknown as DiscoveryApi;
}

describe('query diff selections', () => {
  it('requires every selection explicitly in JSON mode', async () => {
    await expect(queryDiffCommand.run(['--json'])).rejects.toThrow(
      'JSON mode requires explicit --baseline-engine or --engine, --baseline-query, --candidate or --candidate-query'
    );
  });

  it('selects the baseline and multiple candidates from the all-engine query tree', async () => {
    const api = discoveryApi();
    const select = vi.fn<SelectFromList>();
    const selectTree = vi
      .fn<SelectFromQueryTree>()
      .mockResolvedValueOnce(['engine-1\0query-1'])
      .mockResolvedValueOnce(['engine-2\0query-2']);

    await expect(resolveQueryDiffSelections({}, api, select, selectTree)).resolves.toEqual({
      baseline: { engineId: 'engine-1', queryId: 'query-1' },
      candidates: [{ engineId: 'engine-2', queryId: 'query-2' }],
    });
    expect(select).not.toHaveBeenCalled();
    expect(selectTree).toHaveBeenNthCalledWith(
      1,
      'Select the baseline query',
      expect.any(Array),
      false
    );
    expect(selectTree).toHaveBeenNthCalledWith(
      2,
      'Select candidate queries',
      expect.any(Array),
      true
    );
  });

  it('accepts any number of candidate query IDs on one engine', async () => {
    const api = discoveryApi();
    const select = vi.fn<SelectFromList>();
    const selectTree = vi.fn<SelectFromQueryTree>();

    await expect(
      resolveQueryDiffSelections(
        {
          engine: 'engine-1',
          'baseline-query': 'query-1',
          'candidate-query': ['query-2', 'query-3', 'query-4'],
        },
        api,
        select,
        selectTree
      )
    ).resolves.toEqual({
      baseline: { engineId: 'engine-1', queryId: 'query-1' },
      candidates: [
        { engineId: 'engine-1', queryId: 'query-2' },
        { engineId: 'engine-1', queryId: 'query-3' },
        { engineId: 'engine-1', queryId: 'query-4' },
      ],
    });
    expect(api.fetchListEngines).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(selectTree).not.toHaveBeenCalled();
  });

  it('accepts repeatable qualified candidates across engines', async () => {
    const api = discoveryApi();

    await expect(
      resolveQueryDiffSelections(
        {
          'baseline-engine': 'engine-1',
          'baseline-query': 'query-1',
          candidate: ['engine-2:query-2', 'engine-3:query-3'],
        },
        api,
        vi.fn<SelectFromList>(),
        vi.fn<SelectFromQueryTree>()
      )
    ).resolves.toEqual({
      baseline: { engineId: 'engine-1', queryId: 'query-1' },
      candidates: [
        { engineId: 'engine-2', queryId: 'query-2' },
        { engineId: 'engine-3', queryId: 'query-3' },
      ],
    });
  });

  it('fetches and emits every candidate through the JSON command', async () => {
    const fetch = vi.fn(async (_engineId: string, queryId: string) => {
      return {
        query_id: queryId,
        duration_s: 1,
        entities: { operators: {}, plans: {} },
      } as unknown as QueryBundle<EntityRef>;
    });
    setApiClient({ fetchQueryBundle: fetch } as unknown as ApiClient);
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await queryDiffCommand.run([
      '--engine',
      'engine-1',
      '--baseline-query',
      'query-1',
      '--candidate-query',
      'query-2',
      '--candidate-query',
      'query-3',
      '--json',
    ]);

    expect(fetch.mock.calls).toEqual([
      ['engine-1', 'query-1'],
      ['engine-1', 'query-2'],
      ['engine-1', 'query-3'],
    ]);
    const output = JSON.parse(String(write.mock.calls[0]![0]));
    expect(output.schemaVersion).toBe(2);
    expect(output.data.comparisons).toHaveLength(2);
  });

  it('requires candidate engine counts to be unambiguous', async () => {
    await expect(
      resolveQueryDiffSelections(
        {
          'baseline-engine': 'engine-1',
          'baseline-query': 'query-1',
          'candidate-engine': ['engine-2', 'engine-3'],
          'candidate-query': ['query-2', 'query-3', 'query-4'],
        },
        discoveryApi(),
        vi.fn<SelectFromList>(),
        vi.fn<SelectFromQueryTree>()
      )
    ).rejects.toThrow(
      'Pass one --candidate-engine for all candidate queries or one --candidate-engine per query.'
    );
  });
});

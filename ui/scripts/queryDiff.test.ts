// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import type { DiscoveryApi, SelectFromList } from './askSelection';
import { resolveQueryDiffSelections } from './queryDiff';

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
  it('selects baseline and candidate engines independently', async () => {
    const api = discoveryApi();
    const select = vi.fn<SelectFromList>(async prompt => {
      switch (prompt) {
        case 'Select the baseline engine':
          return 'engine-1';
        case 'Select the baseline query group':
          return 'group-engine-1';
        case 'Select the baseline query':
          return 'query-1';
        case 'Select the candidate engine':
          return 'engine-2';
        case 'Select the candidate query group':
          return 'group-engine-2';
        case 'Select the candidate query':
          return 'query-2';
        default:
          throw new Error(`Unexpected prompt: ${prompt}`);
      }
    });

    await expect(resolveQueryDiffSelections({}, api, select)).resolves.toEqual({
      baselineEngineId: 'engine-1',
      baselineQueryId: 'query-1',
      candidateEngineId: 'engine-2',
      candidateQueryId: 'query-2',
    });
    expect(select.mock.calls.map(([prompt]) => prompt)).toEqual([
      'Select the baseline engine',
      'Select the baseline query group',
      'Select the baseline query',
      'Select the candidate engine',
      'Select the candidate query group',
      'Select the candidate query',
    ]);
  });

  it('uses --engine for an explicit same-engine comparison', async () => {
    const api = discoveryApi();
    vi.mocked(api.fetchListQueries).mockResolvedValue([
      { id: 'query-1', instance_name: 'Old query' },
      { id: 'query-2', instance_name: 'New query' },
    ] as never);
    const select = vi
      .fn<SelectFromList>()
      .mockResolvedValueOnce('group-engine-1')
      .mockResolvedValueOnce('query-2');

    await expect(
      resolveQueryDiffSelections({ engine: 'engine-1', 'baseline-query': 'query-1' }, api, select)
    ).resolves.toEqual({
      baselineEngineId: 'engine-1',
      baselineQueryId: 'query-1',
      candidateEngineId: 'engine-1',
      candidateQueryId: 'query-2',
    });
    expect(api.fetchListEngines).not.toHaveBeenCalled();
    expect(select).toHaveBeenNthCalledWith(
      1,
      'Select the candidate query group',
      expect.any(Array)
    );
    expect(select).toHaveBeenNthCalledWith(
      2,
      'Select the candidate query',
      expect.not.arrayContaining([expect.objectContaining({ value: 'query-1' })])
    );
  });
});

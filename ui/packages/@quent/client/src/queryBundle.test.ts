// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntityRef, QueryBundle } from '@quent/utils';
import { fetchQueryBundle, getApiClient, setApiClient } from './api';
import { queryBundleQueryOptions } from './queryBundle';

const defaultClient = getApiClient();

function rawBundle(): QueryBundle<EntityRef> {
  return {
    query_id: 'query',
    entities: {
      engine: {} as QueryBundle<EntityRef>['entities']['engine'],
      query: {
        id: 'query',
        instance_name: null,
        custom_attributes: [
          { key: 'nullable', value: null },
          { key: 'query_count', value: { U64: 9_007_199_254_740_993n } },
        ],
        start_unix_ns: 1n,
        planning_s: null,
        executing_s: null,
        completed_s: null,
      },
      workers: {},
      plans: {},
      operators: {
        operator: {
          id: 'operator',
          plan_id: null,
          parent_operator_ids: [],
          instance_name: null,
          operator_type_name: null,
          custom_attributes: [
            {
              key: 'configuration',
              value: {
                Struct: [
                  { key: 'mode', value: { String: 'fast' } },
                  { key: 'mode', value: { String: 'safe' } },
                ],
              },
            },
          ],
          statistics: {
            custom_statistics: [
              {
                value: {
                  key: 'group',
                  value: {
                    Struct: [
                      { key: 'rows', value: { U64: 9_007_199_254_740_993n } },
                      { key: 'rows', value: null },
                    ],
                  },
                },
                quantity: 'rows',
              },
              {
                value: { key: 'samples', value: { List: { U32: [1, 2, 3] } } },
                quantity: null,
              },
            ],
          },
          active_span: null,
        },
      },
      ports: {
        port: {
          id: 'port',
          operator_id: 'operator',
          instance_name: null,
          statistics: {
            custom_statistics: [
              { key: 'rows', value: { U32: 4 } },
              { key: 'rows', value: { U32: 5 } },
            ],
          },
        },
      },
      resource_types: {},
      resource_group_types: {},
      resources: {},
      resource_groups: {},
      fsm_types: {},
    },
    plan_tree: { id: 'plan', worker: null, children: [] },
    resource_tree: {} as QueryBundle<EntityRef>['resource_tree'],
    unique_operator_names: [],
    quantity_specs: {},
    start_time_unix_ns: 1n,
    duration_s: 1,
  };
}

afterEach(() => {
  setApiClient(defaultClient);
});

describe('query bundle normalization', () => {
  it('normalizes a custom client response only at the React Query boundary', async () => {
    const raw = rawBundle();
    const original = structuredClone(raw);
    const customFetch = vi.fn().mockResolvedValue(raw);
    setApiClient({ ...defaultClient, fetchQueryBundle: customFetch });

    await expect(fetchQueryBundle('engine', 'query')).resolves.toBe(raw);

    const queryClient = new QueryClient();
    const normalized = await queryClient.fetchQuery(
      queryBundleQueryOptions({ engineId: 'engine', queryId: 'query' })
    );

    expect(queryClient.getQueryData(['queryBundle', 'engine', 'query'])).toBe(normalized);
    expect(customFetch).toHaveBeenCalledTimes(2);
    expect(raw).toEqual(original);
    expect(normalized).not.toBe(raw);
    expect(normalized.entities.query.attributes).toEqual([
      { key: 'nullable', value: null },
      { key: 'query_count', value: 9_007_199_254_740_993n },
    ]);
    expect(normalized.entities.operators.operator).toMatchObject({
      attributes: [
        {
          key: 'configuration',
          value: {
            kind: 'struct',
            fields: [
              { key: 'mode', value: 'fast' },
              { key: 'mode', value: 'safe' },
            ],
          },
        },
      ],
      statistics: {
        statistics: [
          {
            key: 'group',
            quantity: 'rows',
            value: {
              kind: 'struct',
              fields: [
                { key: 'rows', value: 9_007_199_254_740_993n },
                { key: 'rows', value: null },
              ],
            },
          },
          { key: 'samples', value: [1, 2, 3] },
        ],
        fields: [
          {
            id: expect.any(String),
            path: [
              ['group', 0],
              ['rows', 0],
            ],
            quantity: 'rows',
            value: 9_007_199_254_740_993n,
          },
          {
            id: expect.any(String),
            path: [
              ['group', 0],
              ['rows', 1],
            ],
            quantity: 'rows',
            value: null,
          },
        ],
      },
    });
    expect(normalized.entities.ports.port.statistics.statistics).toEqual([
      { key: 'rows', value: 4 },
      { key: 'rows', value: 5 },
    ]);
    expect(normalized.entities.ports.port.statistics.fields.map(field => field.path)).toEqual([
      [['rows', 0]],
      [['rows', 1]],
    ]);
  });
});

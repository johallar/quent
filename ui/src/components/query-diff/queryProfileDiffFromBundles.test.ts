// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { EntityRef, QueryBundle } from '@quent/utils';
import { buildQueryProfileDiffFromBundles } from './queryProfileDiffFromBundles';

function makeBundle({
  queryId,
  operatorId,
  operatorType = 'Scan',
  rows,
  duration,
}: {
  queryId: string;
  operatorId: string;
  operatorType?: string;
  rows: number;
  duration: number;
}): QueryBundle<EntityRef> {
  const planId = `plan-${queryId}`;
  return {
    query_id: queryId,
    entities: {
      engine: { id: 'engine-1', instance_name: 'Engine 1' },
      query_group: { id: `group-${queryId}`, instance_name: `Group ${queryId}` },
      query: { id: queryId, instance_name: queryId },
      workers: {},
      plans: {
        [planId]: {
          id: planId,
          instance_name: 'Root plan',
          parent: null,
          worker_id: null,
          edges: [],
        },
      },
      operators: {
        [operatorId]: {
          id: operatorId,
          plan_id: planId,
          parent_operator_ids: [],
          instance_name: 'Scan orders',
          operator_type_name: operatorType,
          custom_attributes: {},
          statistics: { custom_statistics: { input_rows: { Number: rows } } },
          active_span: { start: 0, end: duration },
        },
      },
      ports: {},
      resource_types: {},
      resource_group_types: {},
      resources: {},
      resource_groups: {},
      fsm_types: {},
    },
    resource_tree: {
      ResourceGroup: {
        id: { QueryGroup: `group-${queryId}` },
        children: [],
      },
    },
    plan_tree: { id: planId, worker: null, children: [] },
    unique_operator_names: [],
    quantity_specs: {},
    start_time_unix_ns: 0n,
    duration_s: duration,
  } as unknown as QueryBundle<EntityRef>;
}

describe('buildQueryProfileDiffFromBundles', () => {
  it('builds operator stat deltas from real query bundle data', () => {
    const diff = buildQueryProfileDiffFromBundles(
      makeBundle({ queryId: 'query-a', operatorId: 'scan-a', rows: 100, duration: 12 }),
      makeBundle({ queryId: 'query-b', operatorId: 'scan-b', rows: 80, duration: 10 })
    );

    expect(diff.compatibility).toBe('compatible');
    expect(diff.operator_diffs?.[0]?.stats.duration_s.delta).toBe(2);
    expect(diff.operator_diffs?.[0]?.stats.duration_s.stats).toEqual([12, 10]);
    expect(diff.operator_diffs?.[0]?.stats.input_rows.delta).toBe(20);
    expect(diff.operator_diffs?.[0]?.stats.input_rows.percent_delta).toBe(0.25);
    expect(diff.stat_diffs?.duration.stats).toEqual([12, 10]);
  });

  it('marks structurally different operator signatures as different plans', () => {
    const diff = buildQueryProfileDiffFromBundles(
      makeBundle({ queryId: 'query-a', operatorId: 'scan-a', rows: 100, duration: 12 }),
      makeBundle({
        queryId: 'query-b',
        operatorId: 'join-b',
        operatorType: 'Join',
        rows: 80,
        duration: 10,
      })
    );

    expect(diff.compatibility).toBe('incompatible');
    expect(diff.operator_diffs).toEqual([]);
  });
});

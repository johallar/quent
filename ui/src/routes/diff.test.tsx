// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, renderWithRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';

const API_BASE = 'http://localhost:8000/api';

const QUERY_STATS = {
  'query-a': {
    scan: { duration: 12, input_rows: 1000, output_rows: 900 },
    join: { duration: 24, input_rows: 900, output_rows: 400 },
    agg: { duration: 4, input_rows: 400, output_rows: 20 },
  },
  'query-b': {
    scan: { duration: 10, input_rows: 1200, output_rows: 950 },
    join: { duration: 30, input_rows: 950, output_rows: 380 },
    agg: { duration: 4, input_rows: 380, output_rows: 20 },
  },
};

function taggedNumber(value: number) {
  return { Number: value };
}

function createQueryBundle(queryId: string) {
  const suffix = queryId.endsWith('b') ? 'b' : 'a';
  const stats = QUERY_STATS[queryId as keyof typeof QUERY_STATS] ?? QUERY_STATS['query-a'];
  const planId = `plan-${suffix}`;

  return {
    query_id: queryId,
    entities: {
      engine: { id: 'engine-1', instance_name: 'Engine 1' },
      query_group: { id: 'group-1', instance_name: 'Group 1' },
      query: { id: queryId, instance_name: suffix === 'a' ? 'Query A' : 'Query B' },
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
        [`scan-${suffix}`]: {
          id: `scan-${suffix}`,
          plan_id: planId,
          parent_operator_ids: [],
          instance_name: 'Scan orders',
          operator_type_name: 'Scan',
          custom_attributes: {},
          statistics: {
            custom_statistics: {
              input_rows: taggedNumber(stats.scan.input_rows),
              output_rows: taggedNumber(stats.scan.output_rows),
            },
          },
          active_span: { start: 0, end: stats.scan.duration },
        },
        [`join-${suffix}`]: {
          id: `join-${suffix}`,
          plan_id: planId,
          parent_operator_ids: [],
          instance_name: 'Join lineitem',
          operator_type_name: 'Join',
          custom_attributes: {},
          statistics: {
            custom_statistics: {
              input_rows: taggedNumber(stats.join.input_rows),
              output_rows: taggedNumber(stats.join.output_rows),
            },
          },
          active_span: { start: 0, end: stats.join.duration },
        },
        [`agg-${suffix}`]: {
          id: `agg-${suffix}`,
          plan_id: planId,
          parent_operator_ids: [],
          instance_name: 'Aggregate',
          operator_type_name: 'Aggregate',
          custom_attributes: {},
          statistics: {
            custom_statistics: {
              input_rows: taggedNumber(stats.agg.input_rows),
              output_rows: taggedNumber(stats.agg.output_rows),
            },
          },
          active_span: { start: 0, end: stats.agg.duration },
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
        id: { QueryGroup: 'group-1' },
        children: [],
      },
    },
    plan_tree: { id: planId, worker: null, children: [] },
    unique_operator_names: [],
    quantity_specs: {},
    start_time_unix_ns: 0,
    duration_s: 1,
  };
}

describe('Diff routes', () => {
  beforeEach(() => {
    server.use(
      http.get(`${API_BASE}/engines`, () =>
        HttpResponse.json([{ id: 'engine-1', instance_name: 'Engine 1' }])
      ),
      http.get(`${API_BASE}/engines/:engineId/query-groups`, () =>
        HttpResponse.json([
          { id: 'group-a', instance_name: 'Group A', engine_id: 'engine-1' },
          { id: 'group-b', instance_name: 'Group B', engine_id: 'engine-1' },
        ])
      ),
      http.get(`${API_BASE}/engines/:engineId/query_group/:queryGroupId/queries`, ({ params }) => {
        const queryGroupId = String(params.queryGroupId);
        return HttpResponse.json(
          queryGroupId === 'group-a'
            ? [
                {
                  id: 'query-a',
                  query_group_id: 'group-a',
                  instance_name: 'Query A',
                  start_unix_ns: null,
                  planning_s: null,
                  executing_s: null,
                  completed_s: null,
                },
              ]
            : [
                {
                  id: 'query-b',
                  query_group_id: 'group-b',
                  instance_name: 'Query B',
                  start_unix_ns: null,
                  planning_s: null,
                  executing_s: null,
                  completed_s: null,
                },
              ]
        );
      }),
      http.get(`${API_BASE}/engines/:engineId/query/:queryId`, ({ params }) =>
        HttpResponse.json(createQueryBundle(String(params.queryId)))
      )
    );
  });

  it('renders the top-level diff selection route', async () => {
    renderWithRouter({ initialPath: '/diff' });

    expect(await screen.findByText('Query A')).toBeInTheDocument();
    expect(screen.getByText('Query B')).toBeInTheDocument();
    expect(screen.getByText('Select an engine to compare queries.')).toBeInTheDocument();
  });

  it('renders a selected comparison route', async () => {
    renderWithRouter({
      initialPath: '/diff/engine/engine-1/query/query-a/compare/query-b',
    });

    expect(await screen.findByText('Operator Stat Deltas')).toBeInTheDocument();
    expect(screen.getByText('Timeline Delta')).toBeInTheDocument();
    expect(screen.getAllByText(/Query A/).length).toBeGreaterThan(0);
  });

  it('does not render a diff for the same query on both sides', async () => {
    renderWithRouter({
      initialPath: '/diff/engine/engine-1/query/query-a/compare/query-a',
    });

    expect(await screen.findByText('Choose two different queries.')).toBeInTheDocument();
  });
});

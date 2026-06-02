// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, renderWithRouter, userEvent, waitFor, within } from '@/test/test-utils';
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
  'query-c': {
    scan: { duration: 8, input_rows: 1400, output_rows: 980 },
    join: { duration: 28, input_rows: 980, output_rows: 360 },
    agg: { duration: 5, input_rows: 360, output_rows: 18 },
  },
};

function taggedNumber(value: number) {
  return { Number: value };
}

function createQueryBundle(engineId: string, queryId: string) {
  const suffix = queryId.endsWith('b') ? 'b' : queryId.endsWith('c') ? 'c' : 'a';
  const stats = QUERY_STATS[queryId as keyof typeof QUERY_STATS] ?? QUERY_STATS['query-a'];
  const planId = `plan-${suffix}`;
  const groupId = suffix === 'a' ? 'group-a' : 'group-b';

  return {
    query_id: queryId,
    entities: {
      engine: {
        id: engineId,
        instance_name: engineId === 'engine-2' ? 'Engine 2' : 'Engine 1',
      },
      query_group: { id: groupId, instance_name: suffix === 'a' ? 'Group A' : 'Group B' },
      query: { id: queryId, instance_name: `Query ${suffix.toUpperCase()}` },
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
        id: { QueryGroup: groupId },
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
        HttpResponse.json([
          { id: 'engine-1', instance_name: 'Engine 1' },
          { id: 'engine-2', instance_name: 'Engine 2' },
        ])
      ),
      http.get(`${API_BASE}/engines/:engineId/query-groups`, ({ params }) =>
        HttpResponse.json(
          String(params.engineId) === 'engine-1'
            ? [{ id: 'group-a', instance_name: 'Group A', engine_id: 'engine-1' }]
            : [{ id: 'group-b', instance_name: 'Group B', engine_id: 'engine-2' }]
        )
      ),
      http.get(`${API_BASE}/engines/:engineId/query_group/:queryGroupId/queries`, ({ params }) => {
        const engineId = String(params.engineId);
        const queryGroupId = String(params.queryGroupId);
        return HttpResponse.json(
          engineId === 'engine-1' && queryGroupId === 'group-a'
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
            : engineId === 'engine-2' && queryGroupId === 'group-b'
              ? [
                  {
                    id: 'query-b',
                    query_group_id: 'group-b',
                    instance_name: 'Query B',
                    start_unix_ns: null,
                    planning_s: null,
                    executing_s: null,
                    completed_s: null,
                  },
                  {
                    id: 'query-c',
                    query_group_id: 'group-b',
                    instance_name: 'Query C',
                    start_unix_ns: null,
                    planning_s: null,
                    executing_s: null,
                    completed_s: null,
                  },
                ]
              : []
        );
      }),
      http.get(`${API_BASE}/engines/:engineId/query/:queryId`, ({ params }) =>
        HttpResponse.json(createQueryBundle(String(params.engineId), String(params.queryId)))
      )
    );
  });

  it('renders the top-level diff selection route', async () => {
    renderWithRouter({ initialPath: '/diff' });

    expect(await screen.findByText('Baseline Query')).toBeInTheDocument();
    expect(screen.getByText('Comparison Queries')).toBeInTheDocument();
    expect(
      screen.getByText('Select Baseline Query and at least one comparison query.')
    ).toBeInTheDocument();
  });

  it('selects multiple comparison queries from one picker', async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter({ initialPath: '/diff/query/query-a' });

    const comparisonPicker = await screen.findByRole('combobox', { name: 'Comparison Queries' });
    await user.click(comparisonPicker);

    await user.click(await screen.findByRole('option', { name: /Query B/ }));
    await user.click(await screen.findByRole('option', { name: /Query C/ }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/diff/query/query-a/compare/query-b,query-c');
    });
  });

  it('renders a selected comparison route', async () => {
    renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-b',
    });

    expect(await screen.findByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByRole('tab', { name: 'Operator' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Timelines' })).toBeInTheDocument();
    expect(screen.getByText('Total Run Time')).toBeInTheDocument();
    expect(screen.getByText('Timeline Delta')).toBeInTheDocument();
    expect(screen.getAllByText(/Query A/).length).toBeGreaterThan(0);

    const legend = screen.getByRole('group', { name: 'Query diff legend' });
    expect(within(legend).getByText('Baseline')).toBeInTheDocument();
    expect(within(legend).getByText('Comparison 1')).toBeInTheDocument();
    expect(within(legend).getByText('Query A')).toBeInTheDocument();
    expect(within(legend).getByText('Query B')).toBeInTheDocument();
  });

  it('moves the operator pivot table into the Operator tab', async () => {
    const user = userEvent.setup();
    renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-b',
    });

    await user.click(await screen.findByRole('tab', { name: 'Operator' }));

    expect(await screen.findByText('Operator Stat Deltas')).toBeInTheDocument();
  });

  it('keeps the current timeline view in the Timelines tab', async () => {
    const user = userEvent.setup();
    renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-b',
    });

    await user.click(await screen.findByRole('tab', { name: 'Timelines' }));

    expect(await screen.findByText('Timeline Delta')).toBeInTheDocument();
    const overlayButton = screen.getByRole('button', { name: 'Overlay' });
    const heatmapButton = screen.getByRole('button', { name: 'Heatmap' });
    const lineButton = screen.getByRole('button', { name: 'Line' });
    expect(overlayButton).toHaveAttribute('aria-pressed', 'true');
    await user.click(heatmapButton);
    expect(heatmapButton).toHaveAttribute('aria-pressed', 'true');
    expect(overlayButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(lineButton);
    expect(lineButton).toHaveAttribute('aria-pressed', 'true');
    expect(heatmapButton).toHaveAttribute('aria-pressed', 'false');
    await user.click(overlayButton);
    expect(overlayButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('Total Run Time')).not.toBeInTheDocument();
  });

  it('renders one diff panel for each selected comparison query', async () => {
    renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-b,query-c',
    });

    const overviewTabs = await screen.findAllByRole('tab', { name: 'Overview' });
    expect(overviewTabs).toHaveLength(1);
    expect(screen.getAllByText('2 comparison queries').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total Run Time')).toHaveLength(2);
    expect(screen.getByText('Operator Summary')).toBeInTheDocument();

    const legend = screen.getByRole('group', { name: 'Query diff legend' });
    expect(within(legend).getByText('Baseline')).toBeInTheDocument();
    expect(within(legend).getByText('Comparison 1')).toBeInTheDocument();
    expect(within(legend).getByText('Comparison 2')).toBeInTheDocument();
    expect(within(legend).getByText('Query B')).toBeInTheDocument();
    expect(within(legend).getByText('Query C')).toBeInTheDocument();
  });

  it('preserves baseline and comparisons after the selector collapses', async () => {
    const user = userEvent.setup();
    renderWithRouter({ initialPath: '/diff' });

    const baselinePicker = await screen.findByRole('combobox', { name: 'Baseline Query' });
    await user.click(baselinePicker);
    await user.click(await screen.findByRole('option', { name: /Query A/ }));

    const comparisonPicker = await screen.findByRole('combobox', { name: 'Comparison Queries' });
    await user.click(comparisonPicker);
    await user.click(await screen.findByRole('option', { name: /Query B/ }));

    expect(await screen.findByText('Total Run Time')).toBeInTheDocument();

    const trigger = screen.getByText('Query Diff').closest('button');
    expect(trigger).not.toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.click(trigger!);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger!);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'Baseline Query' })).toHaveTextContent(/Query A/);
      expect(screen.getByRole('combobox', { name: 'Comparison Queries' })).toHaveTextContent(
        /1 query selected/
      );
    });
  });

  it('makes a comparison query the baseline via its chip', async () => {
    const user = userEvent.setup();
    const { router } = renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-b',
    });

    expect(await screen.findByText('Total Run Time')).toBeInTheDocument();

    const trigger = screen.getByText('Query Diff').closest('button');
    expect(trigger).not.toBeNull();
    await user.click(trigger!);

    await user.click(await screen.findByRole('button', { name: /Make .* the baseline/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/diff/query/query-b/compare/query-a');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  it('does not render a diff for the same query on both sides', async () => {
    renderWithRouter({
      initialPath: '/diff/query/query-a/compare/query-a',
    });

    expect(
      await screen.findByText('Choose comparison queries different from the baseline.')
    ).toBeInTheDocument();
  });
});

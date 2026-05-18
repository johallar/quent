// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, renderWithRouter } from '@/test/test-utils';
import { server } from '@/test/mocks/server';
import { equalPlanQueryProfileDiffFixture } from '@/test/mocks/queryProfileDiffFixtures';

const API_BASE = 'http://localhost:8000/api';

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
      http.post(`${API_BASE}/engines/:engineId/query-profile-diff`, () =>
        HttpResponse.json(equalPlanQueryProfileDiffFixture)
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
    expect(screen.getAllByText(/Query A/).length).toBeGreaterThan(0);
  });

  it('does not render a diff for the same query on both sides', async () => {
    renderWithRouter({
      initialPath: '/diff/engine/engine-1/query/query-a/compare/query-a',
    });

    expect(await screen.findByText('Choose two different queries.')).toBeInTheDocument();
  });
});

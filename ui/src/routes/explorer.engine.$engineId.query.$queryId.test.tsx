// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '@/test/mocks/server';
import { renderWithRouter, screen } from '@/test/test-utils';

vi.mock('@/components/explorer/ResourceTimelineExplorer', () => ({
  ResourceTimelineExplorer: ({
    engineId,
    queryBundle,
  }: {
    engineId: string;
    queryBundle: { query_id: string };
  }) => <h1>{`Explorer ${engineId} ${queryBundle.query_id}`}</h1>,
}));

describe('resource timeline explorer route', () => {
  it('loads a query bundle at an independent top-level route', async () => {
    server.use(
      http.get('http://localhost:8000/api/engines/:engineId/query/:queryId', ({ params }) =>
        HttpResponse.json({ query_id: params.queryId })
      )
    );

    renderWithRouter({
      initialPath: '/explorer/engine/engine-1/query/query-1',
    });

    expect(
      await screen.findByRole('heading', { name: 'Explorer engine-1 query-1' })
    ).toBeInTheDocument();
  });
});

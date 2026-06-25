// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithRouter, screen, waitFor } from '@/test/test-utils';

describe('/diff route', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders the empty selection prompt on /diff', async () => {
    renderWithRouter({ initialPath: '/diff' });
    await waitFor(() => {
      expect(screen.getByLabelText(/Baseline Query/i)).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Comparison Queries/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Select Baseline Query and at least one comparison query/i)
    ).toBeInTheDocument();
  });

  it('loads the dashboard from search params', async () => {
    renderWithRouter({ initialPath: '/diff?baseline=query-a&compare=query-b' });
    await waitFor(
      () => {
        expect(screen.getByRole('tab', { name: 'Overview' })).toBeInTheDocument();
      },
      { timeout: 4000 }
    );
    expect(screen.getByRole('tab', { name: 'Operator' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Timelines' })).toBeInTheDocument();
  });

  it('redirects away from /diff when QUERY_DIFF is disabled', async () => {
    vi.stubEnv('VITE_QUERY_DIFF', 'false');
    const { router } = renderWithRouter({ initialPath: '/diff?baseline=query-a&compare=query-b' });

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/profile');
    });
    expect(screen.queryByLabelText(/Baseline Query/i)).not.toBeInTheDocument();
  });
});

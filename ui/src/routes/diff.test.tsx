// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { renderWithRouter, screen, waitFor } from '@/test/test-utils';

describe('/diff route', () => {
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
});

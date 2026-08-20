// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  useSelectedOperatorLabel,
  useSetSelectedNodeIds,
  useSetSelectedOperatorLabel,
} from '@quent/hooks';
import { QueryToolbar } from './QueryToolbar';

function SeedOperatorFilter() {
  const setNodeIds = useSetSelectedNodeIds();
  const setLabel = useSetSelectedOperatorLabel();

  useEffect(() => {
    setNodeIds(new Set(['operator-1']));
    setLabel('Scan');
  }, [setLabel, setNodeIds]);
  return null;
}

function OperatorLabel() {
  return <span data-testid="operator-label">{useSelectedOperatorLabel() ?? 'none'}</span>;
}

describe('QueryToolbar', () => {
  it('shows custom resource filters beside the active operator filter', async () => {
    render(
      <>
        <SeedOperatorFilter />
        <QueryToolbar filters={<input aria-label="Filter resources" />} />
      </>
    );

    expect(await screen.findByText('Scan')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Filter resources' })).toBeInTheDocument();
    expect(screen.queryByText('No filters')).not.toBeInTheDocument();
  });

  it('clears only the operator filter', async () => {
    const user = userEvent.setup();
    render(
      <>
        <SeedOperatorFilter />
        <OperatorLabel />
        <QueryToolbar filters={<input aria-label="Filter resources" value="id:gpu-0" readOnly />} />
      </>
    );

    await user.click(await screen.findByRole('button', { name: 'Clear operator filter Scan' }));
    expect(screen.getByTestId('operator-label')).toHaveTextContent('none');
    expect(screen.getByRole('textbox', { name: 'Filter resources' })).toHaveValue('id:gpu-0');
  });
});

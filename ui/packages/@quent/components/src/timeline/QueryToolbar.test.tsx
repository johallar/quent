// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import {
  useSelectedNodeData,
  useSelectedNodeIds,
  useSetSelectedNodeData,
  useSetSelectedNodeIds,
  useSetSelectedOperatorLabel,
  useSetSelectedOperatorLabels,
} from '@quent/hooks';
import { QueryToolbar } from './QueryToolbar';

function ToolbarHarness() {
  const selectedNodeIds = useSelectedNodeIds();
  const selectedNodeData = useSelectedNodeData();
  const setSelectedNodeIds = useSetSelectedNodeIds();
  const setSelectedNodeData = useSetSelectedNodeData();
  const setSelectedOperatorLabel = useSetSelectedOperatorLabel();

  useEffect(() => {
    setSelectedNodeIds(new Set(['parent', 'child']));
    setSelectedOperatorLabel('Parent operator');
    setSelectedNodeData({
      nodeId: 'parent',
      label: 'Parent operator',
      operationType: 'logical',
      statistics: [],
    });
  }, [setSelectedNodeData, setSelectedNodeIds, setSelectedOperatorLabel]);

  return (
    <>
      <QueryToolbar />
      <span data-testid="selected-count">{selectedNodeIds.size}</span>
      <span data-testid="selected-details">{selectedNodeData?.nodeId ?? 'none'}</span>
    </>
  );
}

function MultiOperatorToolbarHarness() {
  const selectedNodeIds = useSelectedNodeIds();
  const setSelectedNodeIds = useSetSelectedNodeIds();
  const setSelectedNodeData = useSetSelectedNodeData();
  const setSelectedOperatorLabel = useSetSelectedOperatorLabel();
  const setSelectedOperatorLabels = useSetSelectedOperatorLabels();

  useEffect(() => {
    const labels = new Map(
      Array.from({ length: 5 }, (_, index) => {
        const number = index + 1;
        return [`operator-${number}`, `Operator ${number}`] as const;
      })
    );
    setSelectedNodeIds(new Set(labels.keys()));
    setSelectedOperatorLabels(labels);
    setSelectedOperatorLabel('Operator 5');
    setSelectedNodeData({
      nodeId: 'operator-5',
      label: 'Operator 5',
      operationType: 'physical',
      statistics: [],
    });
  }, [
    setSelectedNodeData,
    setSelectedNodeIds,
    setSelectedOperatorLabel,
    setSelectedOperatorLabels,
  ]);

  return (
    <>
      <QueryToolbar />
      <span data-testid="selected-count">{selectedNodeIds.size}</span>
    </>
  );
}

describe('QueryToolbar', () => {
  it('clears the full operator selection and pinned details', async () => {
    render(
      <Provider>
        <ToolbarHarness />
      </Provider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Clear operator filter' }));

    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('selected-details')).toHaveTextContent('none');
  });

  it('caps visible operator badges and removes operators individually', async () => {
    render(
      <Provider>
        <MultiOperatorToolbarHarness />
      </Provider>
    );

    expect(await screen.findByText('Operator 1')).toBeInTheDocument();
    expect(screen.getByText('Operator 2')).toBeInTheDocument();
    expect(screen.getByText('Operator 3')).toBeInTheDocument();
    expect(screen.queryByText('Operator 4')).not.toBeInTheDocument();
    expect(screen.getByText('and 2 more')).toBeInTheDocument();
    expect(screen.getByText('and 2 more')).toHaveAttribute('title', 'Operator 4, Operator 5');
    expect(screen.getByTestId('operator-filter-badges')).toHaveClass('max-w-[40%]');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Operator 2' }));

    expect(screen.getByTestId('selected-count')).toHaveTextContent('4');
    expect(screen.getByText('Operator 4')).toBeInTheDocument();
    expect(screen.getByText('and 1 more')).toBeInTheDocument();
  });
});

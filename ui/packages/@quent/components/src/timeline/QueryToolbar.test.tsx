// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'jotai';
import {
  useSelectedNodeData,
  useSelectedNodeIds,
  useSelectedNodesData,
  useSetOperatorSelection,
  useSetSelectedNodeData,
  useSetSelectedNodesData,
} from '@quent/hooks';
import { QueryToolbar } from './QueryToolbar';

function ToolbarHarness() {
  const selectedNodeIds = useSelectedNodeIds();
  const selectedNodeData = useSelectedNodeData();
  const setOperatorSelection = useSetOperatorSelection();
  const setSelectedNodeData = useSetSelectedNodeData();

  useEffect(() => {
    setOperatorSelection({
      selections: new Map([
        [
          'parent',
          {
            label: 'Parent operator',
            operatorIds: new Set(['parent', 'child']),
          },
        ],
      ]),
      activeId: 'parent',
    });
    setSelectedNodeData({
      nodeId: 'parent',
      label: 'Parent operator',
      operationType: 'logical',
      statistics: [],
    });
  }, [setOperatorSelection, setSelectedNodeData]);

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
  const selectedNodes = useSelectedNodesData();
  const setOperatorSelection = useSetOperatorSelection();
  const setSelectedNodesData = useSetSelectedNodesData();

  useEffect(() => {
    const selections = new Map(
      Array.from({ length: 5 }, (_, index) => {
        const number = index + 1;
        const id = `operator-${number}`;
        return [id, { label: `Operator ${number}`, operatorIds: new Set([id]) }] as const;
      })
    );
    setOperatorSelection({ selections, activeId: 'operator-5' });
    setSelectedNodesData(
      new Map(
        [...selections].map(([id, selection]) => [
          id,
          {
            nodeId: id,
            label: selection.label,
            operationType: 'physical',
            statistics: [],
          },
        ])
      )
    );
  }, [setOperatorSelection, setSelectedNodesData]);

  return (
    <>
      <QueryToolbar />
      <span data-testid="selected-count">{selectedNodeIds.size}</span>
      <span data-testid="inspected-count">{selectedNodes.length}</span>
    </>
  );
}

function TwoOperatorToolbarHarness() {
  const selectedNodes = useSelectedNodesData();
  const setOperatorSelection = useSetOperatorSelection();
  const setSelectedNodesData = useSetSelectedNodesData();

  useEffect(() => {
    setOperatorSelection({
      selections: new Map([
        ['scan', { label: 'Scan', operatorIds: new Set(['scan']) }],
        ['join', { label: 'Join', operatorIds: new Set(['join']) }],
      ]),
      activeId: 'join',
    });
    setSelectedNodesData(
      new Map([
        ['scan', { nodeId: 'scan', label: 'Scan', operationType: 'scan', statistics: [] }],
        ['join', { nodeId: 'join', label: 'Join', operationType: 'join', statistics: [] }],
      ])
    );
  }, [setOperatorSelection, setSelectedNodesData]);

  return (
    <>
      <QueryToolbar />
      <span data-testid="inspected-ids">{selectedNodes.map(node => node.nodeId).join(',')}</span>
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

    fireEvent.click(await screen.findByRole('button', { name: 'Clear all operator filters' }));

    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('selected-details')).toHaveTextContent('none');
  });

  it('caps badges and supports individual and bulk clearing', async () => {
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
    expect(screen.getByTestId('inspected-count')).toHaveTextContent('4');
    expect(screen.getByText('Operator 4')).toBeInTheDocument();
    expect(screen.getByText('and 1 more')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear all operator filters' }));

    expect(screen.getByTestId('selected-count')).toHaveTextContent('0');
    expect(screen.getByTestId('inspected-count')).toHaveTextContent('0');
    expect(screen.getByText('No filters')).toBeInTheDocument();
  });

  it('keeps remaining operator details after removing the last-clicked badge', async () => {
    render(
      <Provider>
        <TwoOperatorToolbarHarness />
      </Provider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Join' }));

    expect(screen.getByTestId('inspected-ids')).toHaveTextContent('scan');
    expect(screen.getByText('Scan')).toBeInTheDocument();
    expect(screen.queryByText('Join')).not.toBeInTheDocument();
  });
});

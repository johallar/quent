// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DAGGraphView } from './DAGGraphView';

vi.mock('@xyflow/react', () => ({
  Background: () => <div>Background</div>,
  EdgeLabelRenderer: ({ children }: { children: ReactNode }) => children,
  MiniMap: () => <div>Overview</div>,
  ReactFlow: ({
    children,
    nodes,
    onPaneClick,
  }: {
    children: ReactNode;
    nodes: unknown[];
    onPaneClick?: () => void;
  }) => (
    <section>
      <span>{nodes.length} nodes</span>
      <button onClick={onPaneClick}>Canvas</button>
      {children}
    </section>
  ),
  getSmoothStepPath: () => ['', 0, 0],
}));

describe('DAGGraphView', () => {
  it('renders controlled graph state and forwards canvas interaction without providers', () => {
    const onPaneClick = vi.fn();
    render(
      <DAGGraphView
        nodes={[]}
        edges={[]}
        onNodesChange={() => undefined}
        onEdgesChange={() => undefined}
        onPaneClick={onPaneClick}
        minZoom={0.1}
        maxZoom={2}
        miniMapNodeColor={() => '#000'}
        overlays={<div>Legend overlay</div>}
      />
    );

    expect(screen.getByText('0 nodes')).toBeVisible();
    expect(screen.getByText('Overview')).toBeVisible();
    expect(screen.getByText('Legend overlay')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Canvas' }));
    expect(onPaneClick).toHaveBeenCalledOnce();
  });
});

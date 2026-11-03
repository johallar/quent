// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryPlanNodeView } from './QueryPlanNodeView';

vi.mock('@xyflow/react', () => ({
  Handle: ({ type }: { type: string }) => <span data-testid={`${type}-handle`} />,
  Position: { Top: 'top', Bottom: 'bottom' },
}));

describe('QueryPlanNodeView', () => {
  it('renders controlled content and publishes hover changes without providers', () => {
    const onHoverChange = vi.fn();
    render(
      <QueryPlanNodeView
        data={{
          nodeId: 'operator-1',
          label: 'Hash join',
          operationType: 'join',
          hasIncoming: true,
          hasOutgoing: true,
          incomingHandlePosition: 'bottom',
          outgoingHandlePosition: 'top',
          formattedColorFieldValue: '42 rows',
          flowBar: <div>Flow summary</div>,
          presentation: {
            borderColor: '#123456',
            backgroundColor: '#abcdef',
            hoverBackgroundColor: '#fedcba',
            isSelected: false,
            isActiveHighlight: false,
            opacity: 'full',
          },
          onHoverChange,
        }}
      />
    );

    const node = screen.getByText('Hash join').closest('.nodrag');
    expect(node).not.toBeNull();
    expect(screen.getByText('42 rows')).toBeVisible();
    expect(screen.getByText('Flow summary')).toBeVisible();
    expect(screen.getByTestId('target-handle')).toBeInTheDocument();
    expect(screen.getByTestId('source-handle')).toBeInTheDocument();

    fireEvent.mouseEnter(node!);
    fireEvent.mouseLeave(node!);
    expect(onHoverChange).toHaveBeenNthCalledWith(1, true);
    expect(onHoverChange).toHaveBeenNthCalledWith(2, false);
  });
});

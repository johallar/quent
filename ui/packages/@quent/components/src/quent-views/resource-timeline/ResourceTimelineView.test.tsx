// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { TimelineChartProps } from '../../ui/charts/TimelineChart';
import { ResourceTimelineView, type ResourceTimelineViewProps } from './ResourceTimelineView';

vi.mock('../../ui/charts/TimelineChart', () => ({
  TimelineChart: ({
    timestamps,
    onHoverChange,
  }: Pick<TimelineChartProps, 'timestamps' | 'onHoverChange'>) => (
    <div data-testid="timeline-chart">
      <span>{timestamps.join(',')}</span>
      <button
        type="button"
        onClick={() =>
          onHoverChange?.({ dataIndex: 0, timestampMs: 100, clientX: 10, clientY: 20 })
        }
      >
        Hover bin
      </button>
    </div>
  ),
}));

const readyStatus: ResourceTimelineViewProps['status'] = {
  state: 'ready',
  data: {
    timestamps: [100, 200],
    series: {
      running: {
        binDuration: 0.1,
        color: '#123456',
        formatter: value => String(value),
        values: [1, 2],
      },
    },
    yAxisLabel: 'capacity',
  },
};

const baseProps = {
  durationSeconds: 1,
  isDark: false,
  visibleStartMs: 0,
  visibleEndMs: 1_000,
  minZoomWindowSeconds: 0.001,
  pointerRatio: null,
  onPointerRatioChange: vi.fn(),
} satisfies Omit<ResourceTimelineViewProps, 'status'>;

describe('ResourceTimelineView', () => {
  it('renders ready data and overlays without providers', async () => {
    render(
      <ResourceTimelineView
        {...baseProps}
        status={readyStatus}
        overlay={<span>Controlled overlay</span>}
      />
    );

    expect(await screen.findByTestId('timeline-chart')).toHaveTextContent('100,200');
    expect(screen.getByText('Controlled overlay')).toBeInTheDocument();
  });

  it('reports controlled hover interactions', async () => {
    const onHoverChange = vi.fn();
    const user = userEvent.setup();
    render(
      <ResourceTimelineView {...baseProps} status={readyStatus} onHoverChange={onHoverChange} />
    );

    await user.click(await screen.findByRole('button', { name: 'Hover bin' }));
    expect(onHoverChange).toHaveBeenCalledWith({
      dataIndex: 0,
      timestampMs: 100,
      clientX: 10,
      clientY: 20,
    });
  });

  it('renders an explicit error state', () => {
    render(<ResourceTimelineView {...baseProps} status={{ state: 'error' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Failed to load timeline');
    expect(screen.queryByTestId('timeline-chart')).not.toBeInTheDocument();
  });
});

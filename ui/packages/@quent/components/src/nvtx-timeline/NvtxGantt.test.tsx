// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NvtxGantt, NVTX_GANTT_HEIGHT } from './NvtxGantt';
import { NVTX_TOOLTIP_DETAIL_LIMIT } from './utils';
import type { NvtxLane } from '@quent/utils';

const mocks = vi.hoisted(() => ({
  ganttChart: vi.fn(),
}));

vi.mock('@quent/hooks', () => ({
  useZoomRange: () => ({ start: 0, end: 1 }),
}));

vi.mock('../timeline/timelineEchartsTheme', () => ({
  MARK_AREA_BORDER_OPACITY: 0.8,
  MARK_AREA_FILL_OPACITY: 0.2,
  useTimelineEchartsTheme: () => ({ textColor: '#000000' }),
}));

vi.mock('../gantt-chart/GanttChart', () => ({
  GanttChart: (props: {
    expandable: boolean;
    emptyMessage: ReactNode;
    data: unknown[];
    renderTooltip?: (hover: { timestampMs: number; clientX: number; clientY: number }) => ReactNode;
  }) => {
    mocks.ganttChart(props);
    return (
      <div>
        {props.emptyMessage}
        {props.data.length > 0
          ? props.renderTooltip?.({ timestampMs: 250, clientX: 10, clientY: 10 })
          : null}
      </div>
    );
  },
}));

const emptyLane: NvtxLane = {
  id: 'lane-1',
  label: 'thread 1',
  identity: { kind: 'thread', thread_id: 1, depth: 0 },
  ranges: [],
  marks: [],
};

describe('NvtxGantt', () => {
  it('reuses the shared expandable GanttChart', () => {
    render(<NvtxGantt lanes={[emptyLane]} durationSeconds={1} isDark={false} />);
    expect(mocks.ganttChart).toHaveBeenCalledWith(
      expect.objectContaining({
        expandable: true,
        expandLabel: 'Expand NVTX chart',
        emptyMessage: 'No NVTX ranges',
        height: NVTX_GANTT_HEIGHT,
      })
    );
    expect(screen.getByText('No NVTX ranges')).toBeInTheDocument();
  });

  it('renders the TimelineTooltip portal for hovered ranges', () => {
    const lane: NvtxLane = {
      id: 'lane-1',
      label: 'thread 186291',
      identity: { kind: 'thread', thread_id: 186291, depth: 0 },
      ranges: [
        {
          message: 'read_parquet',
          domain_id: '2',
          domain_name: 'libcudf',
          category_id: null,
          category_name: null,
          color: '#7c3aedff',
          kind: 'push_pop',
          thread_id: 186291,
          thread_name: 'thread 186291',
          observed_start: 0.1,
          observed_end: 0.4,
          display_start: 0.1,
          display_end: 0.4,
          observed_duration: 0.3,
          incomplete: false,
        },
      ],
      marks: [],
    };
    render(<NvtxGantt lanes={[lane]} durationSeconds={1} isDark={false} />);
    expect(screen.getByText('read_parquet')).toBeInTheDocument();
    expect(screen.getAllByText('thread 186291').length).toBeGreaterThan(0);
    expect(screen.getByText('push/pop range')).toBeInTheDocument();
  });

  it('shows stacked range details and caps the list', () => {
    const lanes: NvtxLane[] = Array.from({ length: NVTX_TOOLTIP_DETAIL_LIMIT + 2 }, (_, depth) => ({
      id: `lane-${depth}`,
      label: `thread 1 · depth ${depth}`,
      identity: { kind: 'thread' as const, thread_id: 1, depth },
      ranges: [
        {
          message: `range-${depth}`,
          domain_id: '2',
          domain_name: 'libcudf',
          category_id: null,
          category_name: null,
          color: '#7c3aedff',
          kind: 'push_pop' as const,
          thread_id: 1,
          thread_name: 'thread 1',
          observed_start: 0.1,
          observed_end: 0.4,
          display_start: 0.1,
          display_end: 0.4,
          observed_duration: 0.3,
          incomplete: false,
        },
      ],
      marks: [],
    }));
    render(<NvtxGantt lanes={lanes} durationSeconds={1} isDark={false} />);
    expect(screen.getByText('range-0')).toBeInTheDocument();
    expect(screen.getByText(`range-${NVTX_TOOLTIP_DETAIL_LIMIT - 1}`)).toBeInTheDocument();
    expect(screen.queryByText('1 range')).not.toBeInTheDocument();
    expect(screen.getAllByText('push/pop range').length).toBe(NVTX_TOOLTIP_DETAIL_LIMIT);
    expect(screen.queryByText(`range-${NVTX_TOOLTIP_DETAIL_LIMIT}`)).not.toBeInTheDocument();
    expect(screen.getByText('2 more not shown')).toBeInTheDocument();
  });
});

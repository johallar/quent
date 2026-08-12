// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { NvtxGantt } from './NvtxGantt';
import type { NvtxLane } from '@quent/utils';

const mocks = vi.hoisted(() => ({
  ganttChart: vi.fn(),
}));

vi.mock('../timeline/timelineEchartsTheme', () => ({
  MARK_AREA_BORDER_OPACITY: 0.8,
  MARK_AREA_FILL_OPACITY: 0.2,
  useTimelineEchartsTheme: () => ({ textColor: '#000000' }),
}));

vi.mock('../gantt-chart/GanttChart', () => ({
  GanttChart: (props: { expandable: boolean; emptyMessage: ReactNode; data: unknown[] }) => {
    mocks.ganttChart(props);
    return <div>{props.emptyMessage}</div>;
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
      })
    );
    expect(screen.getByText('No NVTX ranges')).toBeInTheDocument();
  });
});

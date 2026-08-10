// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LongEntitiesGantt } from './LongEntitiesGantt';

vi.mock('@quent/hooks', () => ({
  useZoomRange: () => ({ start: 0, end: 1 }),
}));

vi.mock('../timeline/timelineEchartsTheme', () => ({
  MARK_AREA_BORDER_OPACITY: 0.8,
  MARK_AREA_FILL_OPACITY: 0.2,
  useTimelineEchartsTheme: () => ({ textColor: '#000000' }),
}));

vi.mock('../gantt-chart/GanttChart', () => ({
  GanttChart: ({ emptyMessage }: { emptyMessage: ReactNode }) => <div>{emptyMessage}</div>,
}));

describe('LongEntitiesGantt', () => {
  it('explains the active threshold when no entities match', () => {
    render(
      <LongEntitiesGantt entries={[]} durationSeconds={1} minUsageSeconds={0.06} isDark={false} />
    );

    expect(screen.getByText('No Matching Entities')).toBeInTheDocument();
    expect(
      screen.getByText('Showing entities longer than 60.0ms. Zoom to see more.')
    ).toBeInTheDocument();
  });
});

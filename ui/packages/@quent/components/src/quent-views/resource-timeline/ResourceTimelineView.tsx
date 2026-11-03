// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { lazy, Suspense, type ReactNode } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import type { TimelineHoverPosition } from '../../ui/charts/TimelineChart';
import type { ResourceTimelineViewData } from './resourceTimelineViewModel';
import { TimelineSkeleton } from './ResourceTimelineSkeleton';

const TimelineChart = lazy(() =>
  import('../../ui/charts/TimelineChart').then(module => ({ default: module.TimelineChart }))
);

export type ResourceTimelineViewStatus =
  | { state: 'loading' }
  | { state: 'error'; message?: string }
  | { state: 'ready'; data: ResourceTimelineViewData };

export interface ResourceTimelineViewProps {
  status: ResourceTimelineViewStatus;
  durationSeconds: number;
  isDark: boolean;
  showTooltip?: boolean;
  visibleStartMs: number;
  visibleEndMs: number;
  minZoomWindowSeconds: number;
  pointerRatio: number | null;
  onPointerRatioChange: (ratio: number | null) => void;
  onHoverChange?: (position: TimelineHoverPosition | null) => void;
  onChartReady?: (instance: EChartsInstance) => void;
  onReady?: (instance: EChartsInstance) => void;
  overlay?: ReactNode;
}

/** Provider-free resource timeline rendering with controlled interaction state. */
export function ResourceTimelineView({
  status,
  durationSeconds,
  isDark,
  showTooltip = true,
  visibleStartMs,
  visibleEndMs,
  minZoomWindowSeconds,
  pointerRatio,
  onPointerRatioChange,
  onHoverChange,
  onChartReady,
  onReady,
  overlay,
}: ResourceTimelineViewProps) {
  if (status.state === 'loading') {
    return <TimelineSkeleton />;
  }

  if (status.state === 'error') {
    return (
      <div role="alert" className="flex h-full items-center justify-center text-xs text-red-400">
        {status.message ?? 'Failed to load timeline'}
      </div>
    );
  }

  const { data } = status;
  return (
    <div className="relative h-full w-full">
      <Suspense fallback={<TimelineSkeleton />}>
        <TimelineChart
          durationSeconds={durationSeconds}
          series={data.series}
          timestamps={data.timestamps}
          showTooltip={showTooltip}
          isDark={isDark}
          yAxisLabel={data.yAxisLabel}
          visibleStartMs={visibleStartMs}
          visibleEndMs={visibleEndMs}
          minZoomWindowSeconds={minZoomWindowSeconds}
          pointerRatio={pointerRatio}
          onPointerRatioChange={onPointerRatioChange}
          onHoverChange={onHoverChange}
          onChartReady={onChartReady}
          onReady={onReady}
        />
        {overlay}
      </Suspense>
    </div>
  );
}

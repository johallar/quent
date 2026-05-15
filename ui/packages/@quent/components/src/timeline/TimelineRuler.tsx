// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import ReactEChartsComponent from 'echarts-for-react';
import { echarts } from '../lib/echarts';
import type { EChartsOption } from '../lib/echarts';
import { useZoomRange } from '@quent/hooks';
import { formatDurationForAxisInterval } from '@quent/utils';
import { nanosToMs, getTimelineXAxisIntervalMs } from '../lib/timeline.utils';
import { useTimelineEchartsTheme } from './timelineEchartsTheme';
import { TIMELINE_SPACING } from './types';

const RULER_HEIGHT = 22;
const RULER_TARGET_TICKS = 7;
// Space above the grid for axis labels + ticks.
const RULER_GRID_TOP = 20;

type TimelineRulerProps = {
  startTime: bigint;
  isDark: boolean;
};

/** Sticky axis ruler showing elapsed time relative to query start for the current zoom window. */
export function TimelineRuler({ startTime, isDark }: TimelineRulerProps) {
  const { themeName, axisTickColor } = useTimelineEchartsTheme(isDark);
  const startTimeMs = useMemo(() => nanosToMs(startTime), [startTime]);
  const zoomRange = useZoomRange();

  const zoomedStartMs = startTimeMs + zoomRange.start * 1000;
  const zoomedEndMs = startTimeMs + zoomRange.end * 1000;
  const zoomedSpanMs = Math.max(zoomedEndMs - zoomedStartMs, 1e-6);

  const interval = useMemo(
    () => getTimelineXAxisIntervalMs(zoomedSpanMs, RULER_TARGET_TICKS),
    [zoomedSpanMs]
  );

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      grid: {
        ...TIMELINE_SPACING,
        top: RULER_GRID_TOP,
        bottom: 0,
      },
      xAxis: {
        type: 'value',
        show: true,
        position: 'top',
        min: zoomedStartMs,
        max: zoomedEndMs,
        interval,
        boundaryGap: false,
        // Re-enable ticks (theme disables them by default); prominent color + extra length.
        axisTick: { show: true, alignWithLabel: true, length: 8, lineStyle: { color: axisTickColor } },
        axisLabel: {
          hideOverlap: true,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          formatter: (value: number) =>
            formatDurationForAxisInterval(value - startTimeMs, interval),
        },
        splitLine: { show: false },
        axisPointer: { show: false },
      },
      yAxis: { type: 'value', show: false, min: 0, max: 1 },
      // Dummy series to give echarts a data domain to anchor the axis.
      series: [
        {
          type: 'line',
          data: [
            [zoomedStartMs, 0],
            [zoomedEndMs, 0],
          ],
          lineStyle: { opacity: 0 },
          symbol: 'none',
          silent: true,
          animation: false,
        },
      ],
    }),
    [zoomedStartMs, zoomedEndMs, interval, startTimeMs, axisTickColor]
  );

  return (
    <ReactEChartsComponent
      echarts={echarts}
      theme={themeName}
      option={option}
      style={{ width: '100%', height: `${RULER_HEIGHT}px` }}
      notMerge={false}
      lazyUpdate={false}
      opts={{ renderer: 'svg' }}
      autoResize
    />
  );
}

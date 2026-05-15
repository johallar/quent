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

/**
 * `absolute`: elapsed time from query start (e.g. "20.00ms", "40.00ms").
 * `relative`: offset from the start of the current zoom window, always begins near 0 (e.g. "+0.00ms", "+20.00µs").
 */
export type TimelineRulerMode = 'absolute' | 'relative';

type TimelineRulerProps = {
  startTime: bigint;
  isDark: boolean;
  mode?: TimelineRulerMode;
};

/** Sticky axis ruler showing elapsed time for the current zoom window. */
export function TimelineRuler({ startTime, isDark, mode = 'relative' }: TimelineRulerProps) {
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

  const option: EChartsOption = useMemo(() => {
    const formatLabel = (value: number): string => {
      const absoluteMs = value - startTimeMs;
      const relativeMs = value - zoomedStartMs;

      if (mode === 'relative') {
        const relStr = `+${formatDurationForAxisInterval(relativeMs, interval)}`;
        // Min/max ticks (always shown) get the "absolute (relative)" anchor format.
        const isMinMax = value === zoomedStartMs || value === zoomedEndMs;
        if (isMinMax) {
          return formatDurationForAxisInterval(absoluteMs, interval);
        }
        return relStr;
      }
      return formatDurationForAxisInterval(absoluteMs, interval);
    };

    return {
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
        axisTick: {
          show: true,
          alignWithLabel: true,
          length: 8,
          lineStyle: { color: axisTickColor },
        },
        axisLabel: {
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          formatter: formatLabel,
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
    };
  }, [zoomedStartMs, zoomedEndMs, interval, startTimeMs, axisTickColor, mode]);

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

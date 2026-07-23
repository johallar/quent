// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef } from 'react';
import EChartsReactCore from 'echarts-for-react/lib/core';

import type { EChartsOption } from '../lib/echarts';
import type { EChartsInstance } from 'echarts-for-react';
import type { CustomSeriesOption } from 'echarts/charts';
import {
  nanosToMs,
  registerAxisPointerSync,
  unregisterAxisPointerSync,
} from '../lib/timeline.utils';
import { useChartConnect } from '../lib/useChartConnect';
import { echarts } from '../lib/echarts';
import { CHART_GROUP } from '../timeline/Timeline';
import { useTimelineEchartsTheme } from '../timeline/timelineEchartsTheme';
import {
  MARK_AREA_BORDER_OPACITY,
  MARK_AREA_FILL_OPACITY,
  MARK_LABEL_TEXT_COLOR,
} from '../timeline/timelineEchartsTheme';
import { HiddenScroll } from '../ui/thin-scroll';
import { withOpacity } from '@quent/utils';
import type { LongEntityEntry } from './types';
import { clipRectByRect } from '../operator-timeline/utils';
import { TIMELINE_SPACING, TIMELINE_X_AXIS_ANIMATION } from '../timeline/types';

const DEFAULT_HEIGHT = 120;
const MAX_HEIGHT = 400;
const BAR_FONT_SIZE = 9;
const BAR_HEIGHT = 16;
const BAR_GAP = 2;
const SERIES_NAME = 'long-entity-segment';

/** Flat segment datum: one ECharts custom-series item per state span. */
type SegmentDatum = {
  value: [number, number, number];
  entryIndex: number;
  segmentIndex: number;
};

export interface LongEntitiesGanttProps {
  entries: LongEntityEntry[];
  startTime: bigint;
  durationSeconds: number;
  height?: number;
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
}

export function LongEntitiesGantt({
  entries,
  startTime,
  durationSeconds,
  height = DEFAULT_HEIGHT,
  isDark,
}: LongEntitiesGanttProps) {
  const { themeName } = useTimelineEchartsTheme(isDark);
  const startTimeMs = useMemo(() => nanosToMs(startTime), [startTime]);
  const xAxisMax = useMemo(
    () => startTimeMs + durationSeconds * 1_000,
    [startTimeMs, durationSeconds]
  );

  const { yAxisCategories, rowCount } = useMemo(() => {
    if (entries.length === 0) return { yAxisCategories: [] as number[], rowCount: 0 };
    const maxRow = Math.max(...entries.map(e => e.rowIndex));
    return {
      yAxisCategories: Array.from({ length: maxRow + 1 }, (_, i) => i),
      rowCount: maxRow + 1,
    };
  }, [entries]);
  // Chart paints every row; wrapper caps at MAX_HEIGHT and scrolls overflow.
  const contentHeight = rowCount * BAR_HEIGHT;
  const chartHeight = Math.max(height, contentHeight);
  const wrapperHeight = Math.min(chartHeight, MAX_HEIGHT);

  // One custom-series datum per segment, tagged with its parent entry/segment.
  const customSeriesData = useMemo<SegmentDatum[]>(() => {
    const data: SegmentDatum[] = [];
    entries.forEach((entry, entryIndex) => {
      entry.segments.forEach((seg, segmentIndex) => {
        data.push({
          value: [seg.startMs, seg.endMs, entry.rowIndex],
          entryIndex,
          segmentIndex,
        });
      });
    });
    return data;
  }, [entries]);

  type RenderItem = NonNullable<CustomSeriesOption['renderItem']>;

  const renderItem: RenderItem = useCallback(
    (params, api) => {
      const startMs = api.value(0) as number;
      const endMs = api.value(1) as number;
      const rowIndex = api.value(2) as number;
      if (endMs <= startMs) return null;

      const datum = customSeriesData[params.dataIndex];
      const entry = datum ? entries[datum.entryIndex] : undefined;
      const segment = entry?.segments[datum!.segmentIndex];
      if (!entry || !segment) return null;

      const startPoint = api.coord([startMs, rowIndex]);
      const endPoint = api.coord([endMs, rowIndex]);

      const barHeight = Math.max(1, BAR_HEIGHT - BAR_GAP);
      const y = startPoint[1] - barHeight / 2;
      const width = Math.max(1, endPoint[0] - startPoint[0]);

      const coord = params.coordSys as { x?: number; y?: number; width?: number; height?: number };
      const clipBound =
        typeof coord.width === 'number' && typeof coord.height === 'number'
          ? { x: coord.x ?? 0, y: coord.y ?? 0, width: coord.width, height: coord.height }
          : null;
      const rectShape = { x: startPoint[0], y, width, height: barHeight };
      const clippedShape = clipBound ? clipRectByRect(rectShape, clipBound) : rectShape;
      if (!clippedShape) return null;

      const color = segment.color;
      const rect = {
        type: 'rect' as const,
        shape: { ...clippedShape, r: 1 },
        // Mirror timeline marks: faint fill, stronger border, same state color.
        style: {
          fill: withOpacity(color, MARK_AREA_FILL_OPACITY),
          stroke: withOpacity(color, MARK_AREA_BORDER_OPACITY),
          lineWidth: 1,
        },
      };

      // Entity label chip on the first segment only (white text on state color).
      const textX = clippedShape.x + 4;
      const textY = clippedShape.y + clippedShape.height / 2;
      const labelChildren =
        datum!.segmentIndex === 0
          ? [
              {
                type: 'text' as const,
                style: {
                  text: entry.label,
                  x: textX,
                  y: textY,
                  textVerticalAlign: 'middle' as const,
                  fontSize: BAR_FONT_SIZE,
                  fontWeight: 500,
                  fill: MARK_LABEL_TEXT_COLOR,
                  backgroundColor: withOpacity(color, 0.85),
                  borderRadius: 1,
                  padding: [1, 2] as [number, number],
                  overflow: 'truncate' as const,
                  width: Math.max(0, clippedShape.width - 8),
                },
              },
            ]
          : [];

      return { type: 'group' as const, children: [rect, ...labelChildren] };
    },
    [entries, customSeriesData]
  );

  const gridOptions = useMemo(
    () => ({
      ...TIMELINE_SPACING,
      width: undefined as number | undefined,
      height: undefined as number | undefined,
    }),
    []
  );

  const option: EChartsOption = useMemo(
    () => ({
      animation: false,
      tooltip: { show: false },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },
      grid: gridOptions,
      xAxis: {
        type: 'time',
        min: startTimeMs,
        max: xAxisMax,
        show: true,
        axisLabel: { show: false },
        axisPointer: {
          show: true,
          type: 'line',
          animation: false,
          label: { show: false },
        },
        ...TIMELINE_X_AXIS_ANIMATION,
      },
      yAxis: {
        type: 'category',
        data: yAxisCategories,
        inverse: true,
        axisLine: { show: false },
        axisLabel: { show: false },
        axisPointer: { show: false },
      },
      series: [
        {
          type: 'custom',
          name: SERIES_NAME,
          animation: false,
          data: customSeriesData,
          renderItem: renderItem as never,
          coordinateSystem: 'cartesian2d',
        },
      ],
      dataZoom: [
        {
          type: 'slider',
          show: false,
          realtime: true,
          filterMode: 'none',
          xAxisIndex: [0],
        },
        {
          type: 'inside',
          zoomLock: true,
          zoomOnMouseWheel: false,
          moveOnMouseWheel: false,
          throttle: 30,
          filterMode: 'none',
          xAxisIndex: [0],
        },
        {
          type: 'inside',
          zoomOnMouseWheel: 'shift',
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
          throttle: 30,
          filterMode: 'none',
          xAxisIndex: [0],
        },
      ],
    }),
    [gridOptions, startTimeMs, xAxisMax, yAxisCategories, customSeriesData, renderItem]
  );

  // Join timeline-sync-group for frame-rate-level x-axis zoom sync via ECharts connect().
  const onChartReady = useCallback((instance: EChartsInstance) => {
    registerAxisPointerSync(instance, 0, { receiveShowTip: false });
  }, []);

  const { handleChartReady, instanceRef } = useChartConnect({
    durationSeconds,
    chartGroup: CHART_GROUP,
    onReady: onChartReady,
  });

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        unregisterAxisPointerSync(instanceRef.current);
        instanceRef.current = null;
      }
    };
  }, []);

  // ECharts captures wheel events; forward non-shift wheel to the scroll container.
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.shiftKey) return;
      e.stopPropagation();
    };
    wrapper.addEventListener('wheel', handleWheel, { capture: true, passive: true });
    return () => {
      wrapper.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, []);

  if (entries.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-muted-foreground text-sm"
        style={{ height }}
      >
        No long entities
      </div>
    );
  }

  return (
    <HiddenScroll ref={wrapperRef} style={{ height: wrapperHeight }}>
      <EChartsReactCore
        echarts={echarts}
        theme={themeName}
        option={option}
        style={{ height: chartHeight }}
        onChartReady={handleChartReady}
        notMerge={false}
        lazyUpdate={false}
        replaceMerge={['series']}
        autoResize={false}
      />
    </HiddenScroll>
  );
}

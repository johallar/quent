// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { MARK_AREA_BORDER_OPACITY, MARK_AREA_FILL_OPACITY } from '../timeline/timelineEchartsTheme';
import { HiddenScroll } from '../ui/thin-scroll';
import { useZoomRange } from '@quent/hooks';
import { withOpacity } from '@quent/utils';
import type { LongEntityEntry } from './types';
import { clipRectByRect } from '../operator-timeline/utils';
import { TIMELINE_SPACING, TIMELINE_X_AXIS_ANIMATION } from '../timeline/types';
import { getLongEntitySegmentsAtTimestamp } from './utils';
import { PointerTooltipPortal } from '../ui/gantt-tooltip';
import { observeGanttHover, type GanttHover } from '../ui/gantt-hover';
import { EntityTooltipContent, type ActiveMark } from '../timeline/TimelineTooltip';

const DEFAULT_HEIGHT = 120;
const MAX_HEIGHT = 400;
const STATE_FONT_SIZE = 9;
const TASK_FONT_SIZE = 10;
/** Task-name line drawn above each bar (~2px around the text). */
const TASK_LABEL_HEIGHT = TASK_FONT_SIZE + 4;
const BAR_HEIGHT = STATE_FONT_SIZE + 4;
/** Vertical gap between stacked rows. */
const ROW_GAP = 2;
const ROW_HEIGHT = TASK_LABEL_HEIGHT + BAR_HEIGHT + ROW_GAP;
/** Radius applied only to the outer corners of each entity's segment run. */
const CORNER_RADIUS = 3;
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
  const { themeName, textColor } = useTimelineEchartsTheme(isDark);
  const [hover, setHover] = useState<GanttHover | null>(null);
  const zoomRange = useZoomRange();
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
  const contentHeight = rowCount * ROW_HEIGHT;
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
  const activeMarks = useMemo<ActiveMark[]>(() => {
    if (!hover) return [];
    return getLongEntitySegmentsAtTimestamp(entries, hover.timestampMs).map(
      ({ entry, segment }) => ({
        color: segment.color,
        label: entry.label,
        stateName: segment.stateName,
        durationMs: segment.endMs - segment.startMs,
        attributes: segment.attributes,
        derivedAttributes: segment.derivedAttributes,
      })
    );
  }, [entries, hover]);

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

      // Center the task-label + bar cluster within the row band; bar sits below the label.
      const clusterTop = startPoint[1] - (TASK_LABEL_HEIGHT + BAR_HEIGHT) / 2;
      const barTop = clusterTop + TASK_LABEL_HEIGHT;
      const width = Math.max(1, endPoint[0] - startPoint[0]);

      const coord = params.coordSys as { x?: number; y?: number; width?: number; height?: number };
      const clipBound =
        typeof coord.width === 'number' && typeof coord.height === 'number'
          ? { x: coord.x ?? 0, y: coord.y ?? 0, width: coord.width, height: coord.height }
          : null;
      const rectShape = { x: startPoint[0], y: barTop, width, height: BAR_HEIGHT };
      const clippedShape = clipBound ? clipRectByRect(rectShape, clipBound) : rectShape;
      if (!clippedShape) return null;

      const color = segment.color;
      const isFirst = datum!.segmentIndex === 0;
      const isLast = datum!.segmentIndex === entry.segments.length - 1;
      // [topLeft, topRight, bottomRight, bottomLeft] — round only the run's outer corners
      // so touching segments tile with square inner seams.
      const r: [number, number, number, number] = [
        isFirst ? CORNER_RADIUS : 0,
        isLast ? CORNER_RADIUS : 0,
        isLast ? CORNER_RADIUS : 0,
        isFirst ? CORNER_RADIUS : 0,
      ];
      const rect = {
        type: 'rect' as const,
        shape: { ...clippedShape, r },
        // Mirror timeline marks: faint fill, stronger border, same state color.
        style: {
          fill: withOpacity(color, MARK_AREA_FILL_OPACITY),
          stroke: withOpacity(color, MARK_AREA_BORDER_OPACITY),
          lineWidth: 1,
        },
      };

      // State name centered inside each segment box (skipped when too narrow to read).
      const stateChildren =
        clippedShape.width > 10
          ? [
              {
                type: 'text' as const,
                style: {
                  text: segment.stateName,
                  x: clippedShape.x + clippedShape.width / 2,
                  y: clippedShape.y + clippedShape.height / 2,
                  textAlign: 'center' as const,
                  textVerticalAlign: 'middle' as const,
                  fontSize: STATE_FONT_SIZE,
                  fill: textColor,
                  overflow: 'truncate' as const,
                  width: Math.max(0, clippedShape.width - 6),
                },
              },
            ]
          : [];

      // Task name above the bar, drawn once (first segment) spanning the whole entity.
      const entityRight = api.coord([entry.endMs, rowIndex])[0];
      const labelLeft = clippedShape.x;
      const labelRight = clipBound
        ? Math.min(entityRight, clipBound.x + clipBound.width)
        : entityRight;
      const labelWidth = Math.max(0, labelRight - labelLeft);
      const taskChildren =
        isFirst && labelWidth > 4
          ? [
              {
                type: 'text' as const,
                style: {
                  text: entry.label,
                  x: labelLeft + 1,
                  y: clusterTop + TASK_LABEL_HEIGHT / 2,
                  textAlign: 'left' as const,
                  textVerticalAlign: 'middle' as const,
                  fontSize: TASK_FONT_SIZE,
                  fontWeight: 500 as const,
                  fill: textColor,
                  overflow: 'truncate' as const,
                  width: Math.max(0, labelWidth - 2),
                },
              },
            ]
          : [];

      return { type: 'group' as const, children: [rect, ...stateChildren, ...taskChildren] };
    },
    [entries, customSeriesData, textColor]
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
      // Axis-triggered tooltip paints the crosshair without rendering tooltip content.
      tooltip: {
        show: true,
        showContent: false,
        trigger: 'axis',
        transitionDuration: 0,
      },
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
          encode: { x: [0, 1], y: 2 },
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
  const hoverCleanupRef = useRef<(() => void) | null>(null);
  const onChartReady = useCallback((instance: EChartsInstance) => {
    registerAxisPointerSync(instance);
    hoverCleanupRef.current?.();
    hoverCleanupRef.current = observeGanttHover(instance, setHover);
  }, []);

  const { handleChartReady, instanceRef } = useChartConnect({
    durationSeconds,
    chartGroup: CHART_GROUP,
    onReady: onChartReady,
  });

  useEffect(() => {
    return () => {
      hoverCleanupRef.current?.();
      if (instanceRef.current) {
        unregisterAxisPointerSync(instanceRef.current);
        instanceRef.current = null;
      }
    };
  }, [instanceRef]);

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

  return (
    <>
      <HiddenScroll ref={wrapperRef} className="relative" style={{ height: wrapperHeight }}>
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
        {entries.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            No long entities
          </div>
        )}
      </HiddenScroll>
      <PointerTooltipPortal hover={activeMarks.length > 0 ? hover : null}>
        {hover && (
          <EntityTooltipContent
            timestamp={hover.timestampMs}
            startTime={startTime}
            windowMs={(zoomRange.end - zoomRange.start) * 1_000}
            activeMarks={activeMarks}
          />
        )}
      </PointerTooltipPortal>
    </>
  );
}

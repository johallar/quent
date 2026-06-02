// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from 'react';
import ReactEChartsComponent from 'echarts-for-react';
import type { EChartsInstance } from 'echarts-for-react';
import type { Opts } from 'echarts-for-react/lib/types';
import type { CustomSeriesOption, LineSeriesOption } from 'echarts/charts';
import {
  CHART_GROUP,
  connectChart,
  echarts,
  TIMELINE_MONO_FONT,
  TIMELINE_SPACING,
  useTimelineEchartsTheme,
  type EChartsOption,
} from '@quent/components';
import { useZoomRange } from '@quent/hooks';
import { cn, withOpacity } from '@quent/utils';
import type { QueryDiffTimelineHeatmapRow } from './QueryDiffTimelineHeatmap';
import { formatQueryDiffTimelineTooltipHtml } from './QueryDiffTimelineTooltip.utils';

interface QueryDiffTimelineLineProps {
  rows: QueryDiffTimelineHeatmapRow[];
  timestamps: number[];
  rowHeight: number;
  durationSeconds: number;
  isDark: boolean;
  positiveColor: string;
  negativeColor: string;
}

type LinePointValue = [
  timestampMs: number,
  yValue: number | null,
  rowIndex: number,
  signedDelta: number,
  relative: number,
  baseline: number,
  comparison: number,
  binIndex: number,
];

type LineTooltipCellValue = [xStartMs: number, xEndMs: number, rowIndex: number, binIndex: number];

interface RectShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AlignedLineRow extends QueryDiffTimelineHeatmapRow {
  baselineValues: number[];
  comparisonValues: number[];
  signedDeltaValues: number[];
  relativeValues: number[];
  colorValues: number[];
}

const ROW_HALF_BAND_HEIGHT = 0.5;
const AREA_FILL_OPACITY = 0.42;

function isLinePointValue(value: unknown): value is LinePointValue {
  return (
    Array.isArray(value) &&
    value.length >= 8 &&
    typeof value[0] === 'number' &&
    (typeof value[1] === 'number' || value[1] === null) &&
    value.slice(2).every(item => typeof item === 'number')
  );
}

function isLineTooltipCellValue(value: unknown): value is LineTooltipCellValue {
  return Array.isArray(value) && value.length >= 4 && value.every(item => typeof item === 'number');
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function maxAbsFinite(values: number[]): number {
  return values.reduce(
    (max, value) => (Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max),
    0
  );
}

function findBinIndexAtTime(sourceTimestamps: number[], timestamp: number): number {
  if (sourceTimestamps.length <= 1) return 0;

  let lo = 0;
  let hi = sourceTimestamps.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if ((sourceTimestamps[mid] ?? 0) <= timestamp) lo = mid + 1;
    else hi = mid - 1;
  }

  return Math.max(0, Math.min(sourceTimestamps.length - 1, hi));
}

function timestampsEqual(a: number[], b: number[]): boolean {
  return (
    a.length === b.length && a.every((value, index) => Math.abs(value - (b[index] ?? 0)) < 0.001)
  );
}

function inferSourceEnd(sourceTimestamps: number[]): number {
  if (sourceTimestamps.length <= 1) return Number.POSITIVE_INFINITY;
  const last = sourceTimestamps[sourceTimestamps.length - 1] ?? 0;
  const previous = sourceTimestamps[sourceTimestamps.length - 2] ?? last;
  return last + Math.max(0, last - previous);
}

function alignValuesToTimestamps({
  values,
  sourceTimestamps,
  targetTimestamps,
}: {
  values: number[];
  sourceTimestamps: number[];
  targetTimestamps: number[];
}): number[] {
  if (values.length === 0 || targetTimestamps.length === 0) return [];
  if (
    values.length === targetTimestamps.length &&
    timestampsEqual(sourceTimestamps, targetTimestamps)
  ) {
    return values.slice(0, targetTimestamps.length);
  }

  const sourceStart = sourceTimestamps[0] ?? 0;
  const sourceEnd = inferSourceEnd(sourceTimestamps);

  return targetTimestamps.map(timestamp => {
    if (timestamp < sourceStart || timestamp >= sourceEnd) return 0;
    return values[findBinIndexAtTime(sourceTimestamps, timestamp)] ?? 0;
  });
}

function alignRowToTimestamps(
  row: QueryDiffTimelineHeatmapRow,
  targetTimestamps: number[]
): AlignedLineRow {
  const sourceTimestamps = row.timestamps.length > 0 ? row.timestamps : targetTimestamps;
  return {
    ...row,
    baselineValues: alignValuesToTimestamps({
      values: row.baselineValues,
      sourceTimestamps,
      targetTimestamps,
    }),
    comparisonValues: alignValuesToTimestamps({
      values: row.comparisonValues,
      sourceTimestamps,
      targetTimestamps,
    }),
    signedDeltaValues: alignValuesToTimestamps({
      values: row.signedDeltaValues,
      sourceTimestamps,
      targetTimestamps,
    }),
    relativeValues: alignValuesToTimestamps({
      values: row.relativeValues,
      sourceTimestamps,
      targetTimestamps,
    }),
    colorValues: alignValuesToTimestamps({
      values: row.colorValues,
      sourceTimestamps,
      targetTimestamps,
    }),
  };
}

function clipRectByRect(rect: RectShape, bounds: RectShape): RectShape | null {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const x2 = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const y2 = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (x2 <= x || y2 <= y) return null;
  return { x, y, width: x2 - x, height: y2 - y };
}

function linePoint(
  row: AlignedLineRow,
  rowIndex: number,
  timestamp: number,
  binIndex: number,
  maxAbsSignedDelta: number,
  sign: 'positive' | 'negative'
): LinePointValue {
  const signedDelta = row.signedDeltaValues[binIndex] ?? 0;
  const normalized = maxAbsSignedDelta > 0 ? clampUnit(signedDelta / maxAbsSignedDelta) : 0;
  const isVisible = sign === 'positive' ? signedDelta >= 0 : signedDelta <= 0;
  const yValue = isVisible ? rowIndex - normalized * ROW_HALF_BAND_HEIGHT : null;
  return [
    timestamp,
    yValue,
    rowIndex,
    signedDelta,
    row.relativeValues[binIndex] ?? 0,
    row.baselineValues[binIndex] ?? 0,
    row.comparisonValues[binIndex] ?? 0,
    binIndex,
  ];
}

export function QueryDiffTimelineLine({
  rows,
  timestamps,
  rowHeight,
  durationSeconds,
  isDark,
  positiveColor,
  negativeColor,
}: QueryDiffTimelineLineProps) {
  const { themeName, axisLabelColor, labelBackgroundColor } = useTimelineEchartsTheme(isDark);
  const chartHeight = Math.max(rowHeight, rows.length * rowHeight);
  const xAxisMin = timestamps[0] ?? 0;
  const xAxisMax = Math.max(
    xAxisMin + durationSeconds * 1_000,
    timestamps[timestamps.length - 1] ?? xAxisMin
  );
  const zoomRange = useZoomRange();
  const zoomRangeRef = useRef(zoomRange);
  const durationSecondsRef = useRef(durationSeconds);
  zoomRangeRef.current = zoomRange;
  durationSecondsRef.current = durationSeconds;

  const alignedRows = useMemo(
    () => rows.map(row => alignRowToTimestamps(row, timestamps)),
    [rows, timestamps]
  );

  const seriesOptions = useMemo(() => {
    const zeroLineColor = withOpacity(axisLabelColor, isDark ? 0.34 : 0.28);
    return alignedRows.flatMap((row, rowIndex): LineSeriesOption[] => {
      if (row.disabledMessage) return [];
      const maxAbsSignedDelta = maxAbsFinite(row.signedDeltaValues) || 1;
      const zeroLine: LineSeriesOption = {
        name: `${row.id}-zero`,
        type: 'line',
        data: [
          [xAxisMin, rowIndex],
          [xAxisMax, rowIndex],
        ],
        symbol: 'none',
        lineStyle: { color: zeroLineColor, width: 1 },
        silent: true,
        tooltip: { show: false },
        animation: false,
        z: 1,
      };
      const commonLineOptions = {
        type: 'line' as const,
        showSymbol: false,
        symbol: 'none',
        connectNulls: false,
        animation: false,
        cursor: 'default',
        silent: true,
        emphasis: {
          disabled: true,
          focus: 'none' as const,
        },
        z: 3,
      };

      return [
        zeroLine,
        {
          ...commonLineOptions,
          name: `${row.id}-positive`,
          data: timestamps.map((timestamp, binIndex) =>
            linePoint(row, rowIndex, timestamp, binIndex, maxAbsSignedDelta, 'positive')
          ),
          lineStyle: { color: positiveColor, width: 1.5 },
          itemStyle: { color: positiveColor },
          areaStyle: {
            color: positiveColor,
            opacity: AREA_FILL_OPACITY,
            origin: rowIndex,
          },
        },
        {
          ...commonLineOptions,
          name: `${row.id}-negative`,
          data: timestamps.map((timestamp, binIndex) =>
            linePoint(row, rowIndex, timestamp, binIndex, maxAbsSignedDelta, 'negative')
          ),
          lineStyle: { color: negativeColor, width: 1.5 },
          itemStyle: { color: negativeColor },
          areaStyle: {
            color: negativeColor,
            opacity: AREA_FILL_OPACITY,
            origin: rowIndex,
          },
        },
      ];
    });
  }, [
    alignedRows,
    axisLabelColor,
    isDark,
    negativeColor,
    positiveColor,
    timestamps,
    xAxisMax,
    xAxisMin,
  ]);

  const tooltipData = useMemo(
    () =>
      alignedRows.flatMap((row, rowIndex) =>
        row.disabledMessage
          ? []
          : timestamps.map((timestamp, binIndex) => {
              const xEndMs = timestamps[binIndex + 1] ?? xAxisMax;
              return [timestamp, xEndMs, rowIndex, binIndex] as LineTooltipCellValue;
            })
      ),
    [alignedRows, timestamps, xAxisMax]
  );

  type RenderItem = NonNullable<CustomSeriesOption['renderItem']>;
  const renderTooltipCell: RenderItem = useCallback(
    (params, api) => {
      const xStartMs = api.value(0) as number;
      const xEndMs = api.value(1) as number;
      const rowIndex = api.value(2) as number;
      if (xEndMs <= xStartMs) return null;

      const startPoint = api.coord([xStartMs, rowIndex]);
      const endPoint = api.coord([xEndMs, rowIndex]);
      const axisBandSize = api.size?.([0, 1]) as number[] | undefined;
      const bandHeight = Math.max(1, axisBandSize?.[1] ?? rowHeight);
      const rectShape = {
        x: startPoint[0],
        y: startPoint[1] - bandHeight / 2,
        width: Math.max(1, endPoint[0] - startPoint[0]),
        height: bandHeight,
      };
      const coord = params.coordSys as { x?: number; y?: number; width?: number; height?: number };
      const clipBounds =
        typeof coord.width === 'number' && typeof coord.height === 'number'
          ? {
              x: coord.x ?? 0,
              y: coord.y ?? 0,
              width: coord.width,
              height: coord.height,
            }
          : null;
      const clippedShape = clipBounds ? clipRectByRect(rectShape, clipBounds) : rectShape;
      if (!clippedShape) return null;

      return {
        type: 'rect' as const,
        shape: clippedShape,
        style: {
          fill: 'rgba(0, 0, 0, 0.001)',
          lineWidth: 0,
        },
      };
    },
    [rowHeight]
  );

  const option: EChartsOption = useMemo(
    () =>
      ({
        animation: false,
        tooltip: {
          trigger: 'item',
          confine: true,
          backgroundColor: labelBackgroundColor,
          borderColor: axisLabelColor,
          textStyle: {
            color: axisLabelColor,
            fontFamily: TIMELINE_MONO_FONT,
            fontSize: 11,
          },
          formatter: (params: { data?: unknown }) => {
            const colors = {
              positive: positiveColor,
              negative: negativeColor,
              neutral: axisLabelColor,
            };

            if (isLinePointValue(params.data)) {
              const [timestamp, , rowIndex, signedDelta, relative, baseline, comparison] =
                params.data;
              const row = alignedRows[rowIndex];
              if (!row) return '';

              return formatQueryDiffTimelineTooltipHtml(
                {
                  label: row.label,
                  relative,
                  signedDelta,
                  baseline,
                  comparison,
                  timestamp,
                  formatter: row.formatter,
                },
                colors
              );
            }

            if (!isLineTooltipCellValue(params.data)) return '';

            const [timestamp, , rowIndex, binIndex] = params.data;
            const row = alignedRows[rowIndex];
            if (!row) return '';

            return formatQueryDiffTimelineTooltipHtml(
              {
                label: row.label,
                relative: row.relativeValues[binIndex] ?? 0,
                signedDelta: row.signedDeltaValues[binIndex] ?? 0,
                baseline: row.baselineValues[binIndex] ?? 0,
                comparison: row.comparisonValues[binIndex] ?? 0,
                timestamp,
                formatter: row.formatter,
              },
              colors
            );
          },
        },
        grid: {
          ...TIMELINE_SPACING,
          top: 0,
          bottom: 0,
          containLabel: false,
        },
        xAxis: {
          type: 'time',
          show: false,
          min: xAxisMin,
          max: xAxisMax,
          boundaryGap: false,
          axisPointer: {
            show: true,
            type: 'line',
            label: { show: false },
          },
        },
        yAxis: {
          type: 'value',
          show: false,
          inverse: true,
          min: -0.5,
          max: Math.max(0.5, rows.length - 0.5),
        },
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
        series: [
          ...seriesOptions,
          {
            type: 'custom',
            data: tooltipData,
            renderItem: renderTooltipCell as never,
            coordinateSystem: 'cartesian2d',
            cursor: 'default',
            z: 10,
          },
        ],
      }) as EChartsOption,
    [
      alignedRows,
      axisLabelColor,
      labelBackgroundColor,
      negativeColor,
      positiveColor,
      renderTooltipCell,
      rows.length,
      seriesOptions,
      tooltipData,
      xAxisMax,
      xAxisMin,
    ]
  );

  const handleChartReady = useCallback((instance: EChartsInstance) => {
    const dur = durationSecondsRef.current;
    const range = zoomRangeRef.current;
    const zoomPct =
      dur > 0 ? { start: (range.start / dur) * 100, end: (range.end / dur) * 100 } : null;
    connectChart(instance, CHART_GROUP, false, zoomPct);
  }, []);

  const opts = useMemo(() => ({ renderer: 'canvas' }) as Opts, []);

  return (
    <div className="grid min-h-0 grid-cols-[9rem_minmax(0,1fr)] border-t border-border">
      <div className="border-r border-border">
        {rows.map((row, index) => (
          <div
            key={row.id}
            className={cn(
              'flex min-w-0 flex-col justify-center px-3',
              index > 0 && 'border-t border-border'
            )}
            style={{ height: rowHeight }}
          >
            <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate">{row.label}</span>
            </span>
            {row.disabledMessage ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {row.disabledMessage}
              </span>
            ) : (
              row.detail && (
                <span className="truncate text-[11px] text-muted-foreground">{row.detail}</span>
              )
            )}
          </div>
        ))}
      </div>
      <div className="min-w-0" style={{ height: chartHeight }}>
        <ReactEChartsComponent
          echarts={echarts}
          theme={themeName}
          option={option}
          style={{ width: '100%', height: '100%' }}
          onChartReady={handleChartReady}
          notMerge={false}
          lazyUpdate={false}
          replaceMerge={['series']}
          opts={opts}
          autoResize
        />
      </div>
    </div>
  );
}

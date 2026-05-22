// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useRef } from 'react';
import type { ReactNode } from 'react';
import ReactEChartsComponent from 'echarts-for-react';
import type { EChartsInstance } from 'echarts-for-react';
import type { Opts } from 'echarts-for-react/lib/types';
import type { CustomSeriesOption } from 'echarts/charts';
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
import { cn, formatDuration } from '@quent/utils';

export interface QueryDiffTimelineHeatmapRow {
  id: string;
  label: string;
  detail?: ReactNode;
  color: string;
  timestamps: number[];
  baselineValues: number[];
  comparisonValues: number[];
  signedDeltaValues: number[];
  relativeValues: number[];
  colorValues: number[];
  formatter: (value: number, decimals?: number) => string;
  disabledMessage?: string;
}

interface QueryDiffTimelineHeatmapProps {
  rows: QueryDiffTimelineHeatmapRow[];
  timestamps: number[];
  rowHeight: number;
  durationSeconds: number;
  isDark: boolean;
  colorScheme: readonly string[];
  positiveColor: string;
  negativeColor: string;
}

type HeatmapCellValue = [
  xStartMs: number,
  xEndMs: number,
  rowIndex: number,
  colorValue: number,
  binIndex: number,
];

interface RectShape {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

interface AlignedHeatmapRow extends QueryDiffTimelineHeatmapRow {
  baselineValues: number[];
  comparisonValues: number[];
  signedDeltaValues: number[];
  relativeValues: number[];
  colorValues: number[];
}

function formatRelativePercent(value: number): string {
  const percent = value * 100;
  const decimals = Math.abs(percent) < 10 && percent !== 0 ? 1 : 0;
  return `${percent.toFixed(decimals)}%`;
}

function escapeTooltipText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isHeatmapCellValue(value: unknown): value is HeatmapCellValue {
  return Array.isArray(value) && value.length >= 5 && value.every(item => typeof item === 'number');
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function parseHexColor(color: string): RgbaColor {
  const normalized = color.trim();
  if (!normalized.startsWith('#')) return { r: 128, g: 128, b: 128, a: 1 };

  const hex = normalized.slice(1);
  if (hex.length !== 6 && hex.length !== 8) return { r: 128, g: 128, b: 128, a: 1 };

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    a: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1,
  };
}

function mixColor(a: RgbaColor, b: RgbaColor, t: number): RgbaColor {
  const clamped = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
    a: a.a + (b.a - a.a) * clamped,
  };
}

function colorToCss({ r, g, b, a }: RgbaColor): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getCellColor({
  value,
  colorScheme,
}: {
  value: number;
  colorScheme: readonly string[];
}): string {
  if (colorScheme.length === 0) return 'rgba(128, 128, 128, 1)';
  if (colorScheme.length === 1) return colorToCss(parseHexColor(colorScheme[0]!));

  const clamped = clampUnit(value);
  const scaled = ((clamped + 1) / 2) * (colorScheme.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.ceil(scaled);
  const lower = parseHexColor(colorScheme[lowerIndex]!);
  const upper = parseHexColor(colorScheme[upperIndex]!);
  return colorToCss(mixColor(lower, upper, scaled - lowerIndex));
}

function clipRectByRect(rect: RectShape, bounds: RectShape): RectShape | null {
  const x = Math.max(rect.x, bounds.x);
  const y = Math.max(rect.y, bounds.y);
  const x2 = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const y2 = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (x2 <= x || y2 <= y) return null;
  return { x, y, width: x2 - x, height: y2 - y };
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
): AlignedHeatmapRow {
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

export function QueryDiffTimelineHeatmap({
  rows,
  timestamps,
  rowHeight,
  durationSeconds,
  isDark,
  colorScheme,
  positiveColor,
  negativeColor,
}: QueryDiffTimelineHeatmapProps) {
  const { themeName, axisLabelColor, labelBackgroundColor } = useTimelineEchartsTheme(isDark);
  const chartHeight = Math.max(rowHeight, rows.length * rowHeight);
  const xAxisMin = timestamps[0] ?? 0;
  const xAxisMax = Math.max(
    xAxisMin + durationSeconds * 1_000,
    timestamps[timestamps.length - 1] ?? xAxisMin
  );
  const yCategories = useMemo(() => rows.map(row => row.id), [rows]);
  const zoomRange = useZoomRange();
  const zoomRangeRef = useRef(zoomRange);
  const durationSecondsRef = useRef(durationSeconds);
  zoomRangeRef.current = zoomRange;
  durationSecondsRef.current = durationSeconds;

  const alignedRows = useMemo(
    () => rows.map(row => alignRowToTimestamps(row, timestamps)),
    [rows, timestamps]
  );

  const heatmapData = useMemo(
    () =>
      alignedRows.flatMap((row, rowIndex) =>
        row.disabledMessage
          ? []
          : timestamps.flatMap((timestamp, binIndex) => {
              const xEndMs = timestamps[binIndex + 1] ?? xAxisMax;
              const value = row.colorValues[binIndex] ?? 0;
              return Number.isFinite(value)
                ? ([[timestamp, xEndMs, rowIndex, value, binIndex]] as HeatmapCellValue[])
                : [];
            })
      ),
    [alignedRows, timestamps, xAxisMax]
  );

  type RenderItem = NonNullable<CustomSeriesOption['renderItem']>;
  const renderItem: RenderItem = useCallback(
    (params, api) => {
      const xStartMs = api.value(0) as number;
      const xEndMs = api.value(1) as number;
      const rowIndex = api.value(2) as number;
      const colorValue = api.value(3) as number;
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
          fill: getCellColor({ value: colorValue, colorScheme }),
          lineWidth: 0,
        },
        emphasis: {
          style: {
            stroke: axisLabelColor,
            lineWidth: 1,
          },
        },
      };
    },
    [axisLabelColor, colorScheme, rowHeight]
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
            if (!isHeatmapCellValue(params.data)) return '';

            const [, , rowIndex, , binIndex] = params.data;
            const row = alignedRows[rowIndex];
            if (!row) return '';

            const relative = row.relativeValues[binIndex] ?? 0;
            const signedDelta = row.signedDeltaValues[binIndex] ?? 0;
            const baseline = row.baselineValues[binIndex] ?? 0;
            const comparison = row.comparisonValues[binIndex] ?? 0;
            const timestamp = timestamps[binIndex] ?? 0;
            const deltaLabel =
              signedDelta > 0
                ? 'Comparison higher'
                : signedDelta < 0
                  ? 'Comparison lower'
                  : 'No change';
            const deltaColor =
              signedDelta > 0 ? positiveColor : signedDelta < 0 ? negativeColor : axisLabelColor;
            const deltaStyle = `color:${deltaColor};font-weight:600`;
            const relativeText = escapeTooltipText(formatRelativePercent(relative));
            const deltaText = escapeTooltipText(row.formatter(signedDelta, 2));

            return [
              `<strong>${escapeTooltipText(row.label)}</strong>`,
              `<span style="${deltaStyle}">${escapeTooltipText(deltaLabel)}</span> (${relativeText})`,
              `Baseline: ${escapeTooltipText(row.formatter(baseline, 2))}`,
              `Comparison: ${escapeTooltipText(row.formatter(comparison, 2))}`,
              `Delta: <span style="${deltaStyle}">${deltaText}</span>`,
              `Time: ${escapeTooltipText(formatDuration(timestamp))}`,
            ].join('<br />');
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
          type: 'category',
          data: yCategories,
          inverse: true,
          show: false,
          boundaryGap: true,
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
          {
            type: 'custom',
            data: heatmapData,
            renderItem: renderItem as never,
            coordinateSystem: 'cartesian2d',
            cursor: 'default',
          },
        ],
      }) as EChartsOption,
    [
      alignedRows,
      axisLabelColor,
      heatmapData,
      labelBackgroundColor,
      negativeColor,
      positiveColor,
      renderItem,
      timestamps,
      xAxisMax,
      xAxisMin,
      yCategories,
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

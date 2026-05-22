// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildBinnedTimelineSeries, type TimelineSeries } from '@quent/components';
import type { DiffTimelineResponse } from '@quent/client';
import type { CapacityDecl, FsmTypeDecl, PaletteTheme, QuantitySpec } from '@quent/utils';
import {
  getDiffNegativeColor,
  getDiffPositiveColor,
  type QueryDiffQueryColors,
} from './QueryDiffColors';

const QUERY_A_HIGHER_LABEL = 'Query A higher';
const QUERY_B_HIGHER_LABEL = 'Query B higher';
const BASELINE_HIGHER_LABEL = 'Baseline higher';
const COMPARISON_HIGHER_LABEL = 'Comparison higher';
const COMPARISON_WITH_DELTA_OPACITY = 0.5;

interface TimelineRowData {
  timestamps: number[];
  series: TimelineSeries;
}

export interface DiffTimelineData {
  baseline: TimelineRowData;
  comparison: TimelineRowData;
  comparisonWithDelta: TimelineRowData;
  delta: TimelineRowData;
}

export interface DiffHeatmapRowData {
  timestamps: number[];
  baselineValues: number[];
  comparisonValues: number[];
  signedDeltaValues: number[];
  relativeValues: number[];
  colorValues: number[];
  formatter: (value: number, decimals?: number) => string;
}

interface BuildDiffTimelineDataParams {
  timelineDiff: DiffTimelineResponse;
  theme: PaletteTheme;
  capacities?: CapacityDecl[];
  quantitySpecs?: { [key in string]?: QuantitySpec };
  fsmTypes?: { [key in string]?: FsmTypeDecl };
  queryColors: QueryDiffQueryColors;
}

function getFirstFormatter(seriesA: TimelineSeries, seriesB: TimelineSeries) {
  return (
    Object.values(seriesA).find(entry => entry.values.length > 0)?.formatter ??
    Object.values(seriesB).find(entry => entry.values.length > 0)?.formatter ??
    ((value: number) => String(value))
  );
}

function getFirstBinDuration(series: TimelineSeries): number | null {
  return Object.values(series).find(entry => entry.values.length > 0)?.binDuration ?? null;
}

function inferBinDurationSeconds(timestamps: number[]): number | null {
  if (timestamps.length <= 1) return null;
  const first = timestamps[0] ?? 0;
  const second = timestamps[1] ?? first;
  const durationMs = second - first;
  return durationMs > 0 ? durationMs / 1_000 : null;
}

function timestampsEqual(a: number[], b: number[]): boolean {
  return (
    a.length === b.length && a.every((value, index) => Math.abs(value - (b[index] ?? 0)) < 0.001)
  );
}

function inferTimelineEnd(timestamps: number[], binDurationSeconds: number | null): number {
  const last = timestamps[timestamps.length - 1];
  if (last == null) return Number.POSITIVE_INFINITY;

  if (binDurationSeconds != null && binDurationSeconds > 0) {
    return last + binDurationSeconds * 1_000;
  }

  if (timestamps.length <= 1) return Number.POSITIVE_INFINITY;

  const previous = timestamps[timestamps.length - 2] ?? last;
  return last + Math.max(0, last - previous);
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

function alignValuesToTimestamps({
  values,
  sourceTimestamps,
  targetTimestamps,
  sourceBinDuration,
}: {
  values: number[];
  sourceTimestamps: number[];
  targetTimestamps: number[];
  sourceBinDuration: number | null;
}): number[] {
  if (values.length === 0 || targetTimestamps.length === 0) return [];
  if (
    values.length === targetTimestamps.length &&
    timestampsEqual(sourceTimestamps, targetTimestamps)
  ) {
    return values.slice(0, targetTimestamps.length);
  }

  const sourceStart = sourceTimestamps[0] ?? 0;
  const sourceEnd = inferTimelineEnd(sourceTimestamps, sourceBinDuration);

  return targetTimestamps.map(timestamp => {
    if (timestamp < sourceStart || timestamp >= sourceEnd) return 0;
    return values[findBinIndexAtTime(sourceTimestamps, timestamp)] ?? 0;
  });
}

function formatDeltaSeries({
  delta,
  baseline,
  comparison,
  theme,
}: {
  delta: TimelineRowData;
  baseline: TimelineRowData;
  comparison: TimelineRowData;
  theme: PaletteTheme;
}): TimelineSeries {
  const formatter = getFirstFormatter(baseline.series, comparison.series);
  const positiveColor = getDiffPositiveColor(theme);
  const negativeColor = getDiffNegativeColor(theme);
  return Object.fromEntries(
    Object.entries(delta.series).map(([name, entry]) => {
      const displayName =
        name === QUERY_A_HIGHER_LABEL
          ? BASELINE_HIGHER_LABEL
          : name === QUERY_B_HIGHER_LABEL
            ? COMPARISON_HIGHER_LABEL
            : name;
      return [
        displayName,
        {
          ...entry,
          color:
            name === QUERY_A_HIGHER_LABEL
              ? negativeColor
              : name === QUERY_B_HIGHER_LABEL
                ? positiveColor
                : entry.color,
          formatter,
        },
      ];
    })
  );
}

function buildSignedDeltaOverlaySeries({
  delta,
  baseline,
  comparison,
  theme,
}: {
  delta: TimelineRowData;
  baseline: TimelineRowData;
  comparison: TimelineRowData;
  theme: PaletteTheme;
}): TimelineSeries {
  const formatter = getFirstFormatter(baseline.series, comparison.series);
  const positiveColor = getDiffPositiveColor(theme);
  const negativeColor = getDiffNegativeColor(theme);
  const targetTimestamps =
    comparison.timestamps.length > 0 ? comparison.timestamps : delta.timestamps;
  const targetBinDuration =
    getFirstBinDuration(comparison.series) ??
    inferBinDurationSeconds(targetTimestamps) ??
    getFirstBinDuration(delta.series) ??
    0;

  return Object.fromEntries(
    Object.entries(delta.series).flatMap(([name, entry]) => {
      const baselineHigher = name === QUERY_A_HIGHER_LABEL || name === BASELINE_HIGHER_LABEL;
      const comparisonHigher = name === QUERY_B_HIGHER_LABEL || name === COMPARISON_HIGHER_LABEL;
      if (!baselineHigher && !comparisonHigher) return [];

      const displayName = baselineHigher ? BASELINE_HIGHER_LABEL : COMPARISON_HIGHER_LABEL;
      const sign = baselineHigher ? -1 : 1;
      const alignedValues = alignValuesToTimestamps({
        values: entry.values,
        sourceTimestamps: delta.timestamps,
        targetTimestamps,
        sourceBinDuration: entry.binDuration,
      });
      return [
        [
          `Delta: ${displayName}`,
          {
            ...entry,
            binDuration: targetBinDuration,
            color: baselineHigher ? negativeColor : positiveColor,
            formatter,
            isOverlay: true,
            renderType: 'bar' as const,
            values: alignedValues.map(value => (value === 0 ? 0 : sign * Math.abs(value))),
          },
        ],
      ];
    })
  );
}

function recolorTimelineSeries(series: TimelineSeries, color: string): TimelineSeries {
  return Object.fromEntries(
    Object.entries(series).map(([name, entry]) => [
      name,
      {
        ...entry,
        color,
      },
    ])
  );
}

function setTimelineSeriesOpacity(series: TimelineSeries, opacity: number): TimelineSeries {
  return Object.fromEntries(
    Object.entries(series).map(([name, entry]) => [
      name,
      {
        ...entry,
        opacity,
      },
    ])
  );
}

function clampRelativeValue(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(-1, Math.min(1, value));
}

function sumSeriesAtIndex(series: TimelineSeries, index: number): number {
  return Object.values(series)
    .filter(entry => !entry.isOverlay)
    .reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0);
}

function seriesValue(series: TimelineSeries, name: string, index: number): number {
  return series[name]?.values[index] ?? 0;
}

export function buildDiffHeatmapRowData(data: DiffTimelineData): DiffHeatmapRowData {
  const binCount = Math.max(
    data.delta.timestamps.length,
    data.baseline.timestamps.length,
    data.comparison.timestamps.length
  );
  const formatter = getFirstFormatter(data.baseline.series, data.comparison.series);

  const baselineValues = new Array<number>(binCount);
  const comparisonValues = new Array<number>(binCount);
  const signedDeltaValues = new Array<number>(binCount);
  const relativeValues = new Array<number>(binCount);
  const colorValues = new Array<number>(binCount);
  const hasBackendDelta =
    Boolean(data.delta.series[BASELINE_HIGHER_LABEL]) ||
    Boolean(data.delta.series[COMPARISON_HIGHER_LABEL]);

  for (let index = 0; index < binCount; index += 1) {
    const baseline = sumSeriesAtIndex(data.baseline.series, index);
    const comparison = sumSeriesAtIndex(data.comparison.series, index);
    const signedDelta = hasBackendDelta
      ? seriesValue(data.delta.series, COMPARISON_HIGHER_LABEL, index) -
        seriesValue(data.delta.series, BASELINE_HIGHER_LABEL, index)
      : comparison - baseline;

    const relative =
      baseline !== 0
        ? signedDelta / Math.abs(baseline)
        : comparison !== 0
          ? Math.sign(signedDelta)
          : 0;

    baselineValues[index] = baseline;
    comparisonValues[index] = comparison;
    signedDeltaValues[index] = signedDelta;
    relativeValues[index] = relative;
    colorValues[index] = clampRelativeValue(relative);
  }

  return {
    timestamps:
      data.delta.timestamps.length > 0
        ? data.delta.timestamps
        : data.baseline.timestamps.length > 0
          ? data.baseline.timestamps
          : data.comparison.timestamps,
    baselineValues,
    comparisonValues,
    signedDeltaValues,
    relativeValues,
    colorValues,
    formatter,
  };
}

export function buildDiffTimelineData({
  timelineDiff,
  theme,
  capacities,
  quantitySpecs,
  fsmTypes,
  queryColors,
}: BuildDiffTimelineDataParams): DiffTimelineData {
  const [baselineTimeline, comparisonTimeline] = timelineDiff.timelines;
  const baseline = buildBinnedTimelineSeries(
    baselineTimeline.data,
    baselineTimeline.config,
    0n,
    theme,
    capacities,
    quantitySpecs,
    fsmTypes
  );
  const comparison = buildBinnedTimelineSeries(
    comparisonTimeline.data,
    comparisonTimeline.config,
    0n,
    theme,
    capacities,
    quantitySpecs,
    fsmTypes
  );
  const delta = buildBinnedTimelineSeries(
    timelineDiff.delta.data,
    timelineDiff.delta.config,
    0n,
    theme
  );

  return {
    baseline: {
      ...baseline,
      series: recolorTimelineSeries(baseline.series, queryColors.baseline),
    },
    comparison: {
      ...comparison,
      series: recolorTimelineSeries(comparison.series, queryColors.comparison),
    },
    comparisonWithDelta: {
      timestamps: comparison.timestamps,
      series: {
        ...setTimelineSeriesOpacity(
          recolorTimelineSeries(comparison.series, queryColors.comparison),
          COMPARISON_WITH_DELTA_OPACITY
        ),
        ...buildSignedDeltaOverlaySeries({ delta, baseline, comparison, theme }),
      },
    },
    delta: {
      timestamps: delta.timestamps,
      series: formatDeltaSeries({ delta, baseline, comparison, theme }),
    },
  };
}

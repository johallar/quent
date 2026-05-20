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

  return Object.fromEntries(
    Object.entries(delta.series).flatMap(([name, entry]) => {
      const baselineHigher = name === QUERY_A_HIGHER_LABEL || name === BASELINE_HIGHER_LABEL;
      const comparisonHigher = name === QUERY_B_HIGHER_LABEL || name === COMPARISON_HIGHER_LABEL;
      if (!baselineHigher && !comparisonHigher) return [];

      const displayName = baselineHigher ? BASELINE_HIGHER_LABEL : COMPARISON_HIGHER_LABEL;
      const sign = baselineHigher ? -1 : 1;
      return [
        [
          `Delta: ${displayName}`,
          {
            ...entry,
            color: baselineHigher ? negativeColor : positiveColor,
            formatter,
            isOverlay: true,
            renderType: 'bar' as const,
            values: entry.values.map(value => (value === 0 ? 0 : sign * Math.abs(value))),
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
        ...recolorTimelineSeries(comparison.series, queryColors.comparison),
        ...buildSignedDeltaOverlaySeries({ delta, baseline, comparison, theme }),
      },
    },
    delta: {
      timestamps: delta.timestamps,
      series: formatDeltaSeries({ delta, baseline, comparison, theme }),
    },
  };
}

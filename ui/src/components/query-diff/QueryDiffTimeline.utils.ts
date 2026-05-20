// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildBinnedTimelineSeries, type TimelineSeries } from '@quent/components';
import type { QueryProfileDiffTimelineResponse } from '@quent/client';
import type { CapacityDecl, FsmTypeDecl, PaletteTheme, QuantitySpec } from '@quent/utils';
import {
  getDiffNegativeColor,
  getDiffPositiveColor,
  type QueryDiffQueryColors,
} from './QueryDiffColors';

const QUERY_A_HIGHER_LABEL = 'Query A higher';
const QUERY_B_HIGHER_LABEL = 'Query B higher';
const BASELINE_HIGHER_LABEL = 'Baseline higher';
const COMPETITOR_HIGHER_LABEL = 'Competitor higher';

interface TimelineRowData {
  timestamps: number[];
  series: TimelineSeries;
}

export interface DiffTimelineData {
  baseline: TimelineRowData;
  competitor: TimelineRowData;
  delta: TimelineRowData;
}

interface BuildDiffTimelineDataParams {
  timelineDiff: QueryProfileDiffTimelineResponse;
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
  competitor,
  theme,
}: {
  delta: TimelineRowData;
  baseline: TimelineRowData;
  competitor: TimelineRowData;
  theme: PaletteTheme;
}): TimelineSeries {
  const formatter = getFirstFormatter(baseline.series, competitor.series);
  const positiveColor = getDiffPositiveColor(theme);
  const negativeColor = getDiffNegativeColor(theme);
  return Object.fromEntries(
    Object.entries(delta.series).map(([name, entry]) => {
      const displayName =
        name === QUERY_A_HIGHER_LABEL
          ? BASELINE_HIGHER_LABEL
          : name === QUERY_B_HIGHER_LABEL
            ? COMPETITOR_HIGHER_LABEL
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
  const [baselineTimeline, competitorTimeline] = timelineDiff.timelines;
  const baseline = buildBinnedTimelineSeries(
    baselineTimeline.data,
    baselineTimeline.config,
    0n,
    theme,
    capacities,
    quantitySpecs,
    fsmTypes
  );
  const competitor = buildBinnedTimelineSeries(
    competitorTimeline.data,
    competitorTimeline.config,
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
    competitor: {
      ...competitor,
      series: recolorTimelineSeries(competitor.series, queryColors.competitor),
    },
    delta: {
      timestamps: delta.timestamps,
      series: formatDeltaSeries({ delta, baseline, competitor, theme }),
    },
  };
}

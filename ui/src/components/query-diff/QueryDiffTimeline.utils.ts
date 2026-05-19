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

interface TimelineRowData {
  timestamps: number[];
  series: TimelineSeries;
}

export interface DiffTimelineData {
  queryA: TimelineRowData;
  queryB: TimelineRowData;
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
  queryA,
  queryB,
  theme,
}: {
  delta: TimelineRowData;
  queryA: TimelineRowData;
  queryB: TimelineRowData;
  theme: PaletteTheme;
}): TimelineSeries {
  const formatter = getFirstFormatter(queryA.series, queryB.series);
  const positiveColor = getDiffPositiveColor(theme);
  const negativeColor = getDiffNegativeColor(theme);
  return Object.fromEntries(
    Object.entries(delta.series).map(([name, entry]) => [
      name,
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
    ])
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
  const [queryATimeline, queryBTimeline] = timelineDiff.timelines;
  const queryA = buildBinnedTimelineSeries(
    queryATimeline.data,
    queryATimeline.config,
    0n,
    theme,
    capacities,
    quantitySpecs,
    fsmTypes
  );
  const queryB = buildBinnedTimelineSeries(
    queryBTimeline.data,
    queryBTimeline.config,
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
    queryA: {
      ...queryA,
      series: recolorTimelineSeries(queryA.series, queryColors.queryA),
    },
    queryB: {
      ...queryB,
      series: recolorTimelineSeries(queryB.series, queryColors.queryB),
    },
    delta: {
      timestamps: delta.timestamps,
      series: formatDeltaSeries({ delta, queryA, queryB, theme }),
    },
  };
}

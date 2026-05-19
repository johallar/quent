// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { buildBinnedTimelineSeries, type TimelineSeries } from '@quent/components';
import type { QueryProfileDiffTimelineResponse } from '@quent/client';
import type { CapacityDecl, FsmTypeDecl, PaletteTheme, QuantitySpec } from '@quent/utils';

const QUERY_A_HIGHER_COLOR = '#CC6677';
const QUERY_B_HIGHER_COLOR = '#44AA99';
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
}: {
  delta: TimelineRowData;
  queryA: TimelineRowData;
  queryB: TimelineRowData;
}): TimelineSeries {
  const formatter = getFirstFormatter(queryA.series, queryB.series);
  return Object.fromEntries(
    Object.entries(delta.series).map(([name, entry]) => [
      name,
      {
        ...entry,
        color:
          name === QUERY_A_HIGHER_LABEL
            ? QUERY_A_HIGHER_COLOR
            : name === QUERY_B_HIGHER_LABEL
              ? QUERY_B_HIGHER_COLOR
              : entry.color,
        formatter,
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
    queryA,
    queryB,
    delta: {
      timestamps: delta.timestamps,
      series: formatDeltaSeries({ delta, queryA, queryB }),
    },
  };
}

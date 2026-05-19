// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  buildBinnedTimelineSeries,
  getAdaptiveNumBins,
  type TimelineSeries,
} from '@quent/components';
import type {
  CapacityDecl,
  FsmTypeDecl,
  PaletteTheme,
  QuantitySpec,
  SingleTimelineResponse,
} from '@quent/utils';

const QUERY_A_HIGHER_COLOR = '#CC6677';
const QUERY_B_HIGHER_COLOR = '#44AA99';

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
  queryATimeline: SingleTimelineResponse;
  queryBTimeline: SingleTimelineResponse;
  durationSeconds: number;
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

function buildElapsedTimestamps(durationSeconds: number, numBins: number): number[] {
  if (numBins <= 0) return [];
  const binDurationMs = (durationSeconds * 1_000) / numBins;
  return Array.from({ length: numBins }, (_, index) => index * binDurationMs);
}

function sampleAggregateAt(series: TimelineSeries, timestamps: number[], targetTimestamp: number) {
  const entries = Object.values(series);
  if (entries.length === 0 || timestamps.length === 0) return 0;

  const firstTimestamp = timestamps[0] ?? 0;
  const secondTimestamp = timestamps[1];
  const firstEntry = entries[0];
  const binDurationMs =
    secondTimestamp != null
      ? secondTimestamp - firstTimestamp
      : Math.max(firstEntry?.binDuration ?? 0, 0) * 1_000;

  if (binDurationMs <= 0 || targetTimestamp < firstTimestamp) return 0;

  const index = Math.floor((targetTimestamp - firstTimestamp) / binDurationMs);
  if (index < 0) return 0;

  return entries.reduce((sum, entry) => sum + (entry.values[index] ?? 0), 0);
}

function buildDiffSeries({
  queryA,
  queryB,
  timestamps,
  durationSeconds,
}: {
  queryA: TimelineRowData;
  queryB: TimelineRowData;
  timestamps: number[];
  durationSeconds: number;
}): TimelineSeries {
  const formatter = getFirstFormatter(queryA.series, queryB.series);
  const deltas = timestamps.map(timestamp => {
    const a = sampleAggregateAt(queryA.series, queryA.timestamps, timestamp);
    const b = sampleAggregateAt(queryB.series, queryB.timestamps, timestamp);
    return a - b;
  });
  const binDuration = timestamps.length > 0 ? durationSeconds / timestamps.length : 0;

  return {
    'Query A higher': {
      color: QUERY_A_HIGHER_COLOR,
      binDuration,
      formatter,
      values: deltas.map(delta => Math.max(delta, 0)),
    },
    'Query B higher': {
      color: QUERY_B_HIGHER_COLOR,
      binDuration,
      formatter,
      values: deltas.map(delta => Math.max(-delta, 0)),
    },
  };
}

export function buildDiffTimelineData({
  queryATimeline,
  queryBTimeline,
  durationSeconds,
  theme,
  capacities,
  quantitySpecs,
  fsmTypes,
}: BuildDiffTimelineDataParams): DiffTimelineData {
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
  const timestamps = buildElapsedTimestamps(durationSeconds, getAdaptiveNumBins());

  return {
    queryA,
    queryB,
    delta: {
      timestamps,
      series: buildDiffSeries({ queryA, queryB, timestamps, durationSeconds }),
    },
  };
}

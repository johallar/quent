// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimelineSeries, TimelineSeriesEntry } from '../../ui/charts/timelineTypes';

export const ALL_FSMS_COLORS = { light: '#4F6D8F', dark: '#7F9CBF' } as const;

export interface ResourceTimelineSeriesInput {
  spanStartSeconds: number;
  binDurationSeconds: number;
  numBins: number;
  entries: Array<{
    name: string;
    color: string;
    values: number[];
    formatter: TimelineSeriesEntry['formatter'];
  }>;
  emptySeriesColor: string;
  yAxisLabel?: string;
}

export interface ResourceTimelineViewData {
  timestamps: number[];
  series: TimelineSeries;
  yAxisLabel?: string;
}

/** Converts feature-scoped bins into data consumed by the controlled timeline chart. */
export function buildResourceTimelineViewData(
  input: ResourceTimelineSeriesInput
): ResourceTimelineViewData {
  const firstBinMs = input.spanStartSeconds * 1_000;
  const binDurationMs = input.binDurationSeconds * 1_000;
  const timestamps = Array.from(
    { length: input.numBins },
    (_, index) => firstBinMs + index * binDurationMs
  );
  const series = Object.fromEntries(
    input.entries.map(entry => [
      entry.name,
      {
        color: entry.color,
        formatter: entry.formatter,
        values: entry.values,
        binDuration: input.binDurationSeconds,
      },
    ])
  );

  if (Object.keys(series).length === 0) {
    series.empty = {
      color: input.emptySeriesColor,
      formatter: (value: number) => String(value),
      values: [],
      binDuration: input.binDurationSeconds,
    };
  }

  return { timestamps, series, yAxisLabel: input.yAxisLabel };
}

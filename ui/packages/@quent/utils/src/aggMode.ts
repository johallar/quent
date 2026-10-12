// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const STATISTIC_AGGREGATION_MODES = ['sum', 'mean', 'min', 'max', 'stdev'] as const;

export type StatisticAggregationMode = (typeof STATISTIC_AGGREGATION_MODES)[number];

export const DEFAULT_STATISTIC_AGGREGATION_MODE: StatisticAggregationMode = 'sum';

/** Serialized modes retain `value` so existing shared links remain valid. */
export const AGG_MODES = ['value', ...STATISTIC_AGGREGATION_MODES] as const;

/** @deprecated Use StatisticAggregationMode for runtime aggregation state. */
export type AggMode = (typeof AGG_MODES)[number];

export function normalizeStatisticAggregationMode(
  mode: AggMode | null | undefined,
  fallback: StatisticAggregationMode = DEFAULT_STATISTIC_AGGREGATION_MODE
): StatisticAggregationMode {
  return mode === 'value' || mode == null ? fallback : mode;
}

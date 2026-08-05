// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimelineSeries } from './types';

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const NICE_TIMELINE_INTERVALS_MS = [
  0.001, // 1 µs
  0.002,
  0.005,
  0.01, // 10 µs
  0.02,
  0.05,
  0.1, // 100 µs
  0.2,
  0.5,
  1, // 1 ms
  2,
  5,
  10, // 10 ms
  20,
  50,
  100,
  200,
  500,
  1 * SECOND_MS,
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  30 * SECOND_MS,
  1 * MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  1 * HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  1 * DAY_MS,
  2 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
] as const;

/**
 * Pick a nice x-axis interval for timeline charts based on visible span.
 * Supports short spans (seconds) through long spans (multi-day).
 * `targetSplits` is treated as the minimum number of displayed splits/labels.
 */
export function getTimelineXAxisIntervalMs(spanMs: number, targetSplits: number = 8): number {
  const safeSpanMs = Math.max(Number.EPSILON, spanMs);
  const minSplits = Math.max(2, targetSplits);
  // To display at least `minSplits`, interval must be <= span/(minSplits-1).
  const maxAllowedStep = safeSpanMs / (minSplits - 1);

  // Choose the largest "nice" interval that still satisfies the minimum split count.
  for (let i = NICE_TIMELINE_INTERVALS_MS.length - 1; i >= 0; i--) {
    const intervalMs = NICE_TIMELINE_INTERVALS_MS[i]!;
    if (intervalMs <= maxAllowedStep) return intervalMs;
  }

  // Fallback for very small spans where even the smallest nice interval is too coarse.
  return maxAllowedStep;
}

/** Max stacked value across non-dimmed, non-overlay bins within [zoomStartMs, zoomEndMs]. */
export function computeVisibleMaxValue(
  series: TimelineSeries,
  timestamps: number[],
  zoomStartMs: number,
  zoomEndMs: number
): number | null {
  const entries = Object.values(series).filter(e => !e.isDimmed && !e.isOverlay);
  if (!entries.length || !entries[0]?.values.length) return null;
  let max = 0;
  for (let i = 0; i < entries[0].values.length; i++) {
    const t = timestamps[i];
    if (t === undefined || t < zoomStartMs || t > zoomEndMs) continue;
    const sum = entries.reduce((acc, e) => acc + (e.values[i] ?? 0), 0);
    if (sum > max) max = sum;
  }
  return max > 0 ? max : null;
}

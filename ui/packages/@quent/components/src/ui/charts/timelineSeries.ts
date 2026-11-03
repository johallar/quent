// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TimelineSeries } from './timelineTypes';

/** Returns a copy of a timeline series with every entry dimmed. */
export function dimTimelineSeries(series: TimelineSeries): TimelineSeries {
  return Object.fromEntries(
    Object.entries(series).map(([name, entry]) => [name, { ...entry, isDimmed: true }])
  );
}

/** Layers full-opacity overlay entries over a dimmed base series. */
export function mergeTimelineOverlaySeries(
  baseSeries: TimelineSeries,
  overlaySeries: TimelineSeries,
  overlayLabel: string
): TimelineSeries {
  const merged = dimTimelineSeries(baseSeries);
  for (const [state, overlayEntry] of Object.entries(overlaySeries)) {
    const baseEntry = baseSeries[state];
    merged[`${state} (${overlayLabel})`] = {
      ...overlayEntry,
      color: baseEntry?.color ?? overlayEntry.color,
      isOverlay: true,
    };
  }
  return merged;
}

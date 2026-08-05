// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { computeVisibleMaxValue, getTimelineXAxisIntervalMs } from './timelineMath';
import type { TimelineSeries } from './types';

// ---- getTimelineXAxisIntervalMs --------------------------------------------

describe('getTimelineXAxisIntervalMs', () => {
  it.each([
    [700, 100],
    [1_400, 200],
    [3_500, 500],
    [7_000, 1_000],
    [7 * 60_000, 60_000],
    [7 * 3_600_000, 3_600_000],
    [7 * 86_400_000, 86_400_000],
  ])('picks the right nice interval for span %i ms', (span, expected) => {
    expect(getTimelineXAxisIntervalMs(span)).toBe(expected);
  });

  it('falls back to the raw step when the span is smaller than any nice interval', () => {
    // 10ms span, 2 target splits → maxAllowedStep = 10 / 1 = 10; even 100ms is too coarse
    expect(getTimelineXAxisIntervalMs(10, 2)).toBe(10);
  });

  it('respects a custom targetSplits that allows a coarser interval', () => {
    // 7s span, 2 splits → maxAllowedStep = 7000 / 1 = 7000 → picks 5-second interval
    expect(getTimelineXAxisIntervalMs(7_000, 2)).toBe(5_000);
  });

  it('treats targetSplits < 2 as 2', () => {
    // Same result as targetSplits = 2
    expect(getTimelineXAxisIntervalMs(7_000, 1)).toBe(getTimelineXAxisIntervalMs(7_000, 2));
  });
});

describe('computeVisibleMaxValue', () => {
  const series: TimelineSeries = {
    run: { color: '#f00', binDuration: 1, formatter: String, values: [1, 2, 3] },
    wait: { color: '#0f0', binDuration: 1, formatter: String, values: [2, 3, 4] },
  };
  const timestamps = [0, 1000, 2000];

  it('returns the maximum stacked value in the visible window', () => {
    expect(computeVisibleMaxValue(series, timestamps, 0, 1000)).toBe(5);
  });

  it('ignores dimmed and overlay series', () => {
    const decorated: TimelineSeries = {
      ...series,
      overlay: {
        color: '#00f',
        binDuration: 1,
        formatter: String,
        values: [100, 100, 100],
        isOverlay: true,
      },
    };
    expect(computeVisibleMaxValue(decorated, timestamps, 2000, 2000)).toBe(7);
  });

  it('returns null for empty visible values', () => {
    expect(computeVisibleMaxValue(series, timestamps, 3000, 4000)).toBeNull();
  });
});

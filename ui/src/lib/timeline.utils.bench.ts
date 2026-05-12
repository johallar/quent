// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Benchmarks for buildBinnedTimelineSeries and sliceToViewport.
 *
 * Run with: pnpm bench
 *
 * Two scenarios are covered:
 *
 * 1. Initial render / data refresh — buildBinnedTimelineSeries runs once per
 *    timeline when the API response arrives. Measures how many timelines can
 *    be processed before the work exceeds a 16 ms frame budget.
 *
 * 2. Zoom / pan events — only sliceToViewport runs, once per timeline per
 *    event. These fire at high frequency (throttled to ~30 ms in the UI, so
 *    up to ~33 events/s). The viewport shifts on every call to prevent the
 *    engine from optimising away repeated identical work.
 */

import { bench, describe } from 'vitest';
import {
  buildBinnedTimelineSeries,
  nanosToMs,
  sliceToViewport,
  type TimelineSeries,
  type ViewportSec,
} from '@quent/components';
import type { ResourceTimeline, BinnedSpanSec } from '@quent/utils';

// ── Fixture constants ─────────────────────────────────────────────────────────

const TOTAL_BINS = 800;
const BIN_DURATION_SEC = 1;
const TOTAL_DURATION_SEC = TOTAL_BINS * BIN_DURATION_SEC;
const SERIES_NAMES = ['allocated', 'used', 'available'];
const START_TIME_NS = 1_700_000_000_000_000_000n;

const CONFIG: BinnedSpanSec = {
  span: { start: 0, end: TOTAL_DURATION_SEC },
  bin_duration: BIN_DURATION_SEC,
  num_bins: BigInt(TOTAL_BINS),
};

// Derived geometry — matches what buildBinnedTimelineSeries computes internally.
const FIRST_BIN_MS = nanosToMs(START_TIME_NS) + CONFIG.span.start * 1_000;
const BIN_DURATION_MS = BIN_DURATION_SEC * 1_000;

// ── Viewport sequence ─────────────────────────────────────────────────────────
//
// Simulate a smooth pan across the timeline by pre-computing 64 viewport
// positions that slide from left to right. The bench cycles through them so
// each call sees a different (but realistic) viewport, preventing the engine
// from eliding repeated identical slices.

const VIEWPORT_WINDOW_SEC = 400; // visible span: 400 of 800 bins
const PAN_STEPS = 64;
const VIEWPORTS: ViewportSec[] = Array.from({ length: PAN_STEPS }, (_, i) => {
  const start = (i / PAN_STEPS) * (TOTAL_DURATION_SEC - VIEWPORT_WINDOW_SEC);
  return { start, end: start + VIEWPORT_WINDOW_SEC };
});

// ── Fixture builders ──────────────────────────────────────────────────────────

function makeApiTimeline(): ResourceTimeline {
  const base = Array.from({ length: TOTAL_BINS }, (_, i) => (i % 100) + 1);
  return {
    Binned: {
      config: CONFIG,
      long_fsms: [],
      capacities_values: Object.fromEntries(
        SERIES_NAMES.map((name, idx) => [name, base.map(v => v * (idx + 1))])
      ),
    },
  };
}

// Pre-built result objects (timestamps + series) as they would exist after the
// initial buildBinnedTimelineSeries call — this is what sliceToViewport
// operates on during zoom/pan.
function makeBuiltTimelines(count: number): Array<{
  timestamps: number[];
  series: TimelineSeries;
}> {
  const api = makeApiTimeline();
  const base = buildBinnedTimelineSeries(api, CONFIG, START_TIME_NS, 'dark');
  return Array.from({ length: count }, () => ({
    timestamps: [...base.timestamps],
    series: Object.fromEntries(
      Object.entries(base.series).map(([k, s]) => [k, { ...s, values: [...s.values] }])
    ),
  }));
}

// ── Scenario 1: initial render / data refresh ─────────────────────────────────

const API_TIMELINE = makeApiTimeline();

describe('buildBinnedTimelineSeries — initial render (800 bins)', () => {
  for (const n of [1, 10, 25, 50, 100, 250, 500]) {
    bench(`${n} timeline${n === 1 ? '' : 's'}`, () => {
      for (let i = 0; i < n; i++) {
        buildBinnedTimelineSeries(API_TIMELINE, CONFIG, START_TIME_NS, 'dark');
      }
    });
  }
});

// ── Scenario 2: zoom / pan — sliceToViewport only ────────────────────────────
//
// On every zoom or pan event, React re-runs the useMemo that calls
// sliceToViewport for each visible timeline. At 30 ms throttle the UI can
// fire ~33 events/s; a 16 ms frame budget means this batch must finish in
// under 16 ms to stay at 60 fps.

describe('sliceToViewport — zoom/pan event across 50 timelines, varying viewport', () => {
  const TIMELINES_50 = makeBuiltTimelines(50);
  let step = 0;

  bench('50 timelines × 1 zoom event (shifting viewport)', () => {
    const viewport = VIEWPORTS[step % PAN_STEPS]!;
    step++;
    for (const tl of TIMELINES_50) {
      sliceToViewport(tl, FIRST_BIN_MS, BIN_DURATION_MS, TOTAL_BINS, START_TIME_NS, viewport);
    }
  });
});

describe('sliceToViewport — zoom/pan, varying timeline count, shifting viewport', () => {
  const timelinesMap = Object.fromEntries(
    [1, 10, 25, 50, 100, 250].map(n => [n, makeBuiltTimelines(n)])
  );
  let step = 0;

  for (const n of [1, 10, 25, 50, 100, 250]) {
    const timelines = timelinesMap[n]!;
    bench(`${n} timeline${n === 1 ? '' : 's'} per zoom event`, () => {
      const viewport = VIEWPORTS[step % PAN_STEPS]!;
      step++;
      for (const tl of timelines) {
        sliceToViewport(tl, FIRST_BIN_MS, BIN_DURATION_MS, TOTAL_BINS, START_TIME_NS, viewport);
      }
    });
  }
});

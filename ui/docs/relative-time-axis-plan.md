<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Relative nanosecond time axis for ECharts timelines

## Status

**Scoped / approved for initial implementation.** This document covers only the
first slice: migrating the charts currently used in the app from an absolute
epoch-millisecond axis to a **relative nanosecond-offset** axis. Broader "make
ECharts BigInt-aware as a library" work is explicitly out of scope for now (see
[Deferred](#deferred-not-in-this-slice)).

## Why now: the ECharts 6 driver

The trigger for doing this slice first is that **ECharts 6 breaks our current
approach**, so this is a prerequisite for upgrading.

### Finding (confirmed by executing 5.6.0 vs 6.1.0)

Today every timeline chart feeds ECharts an **absolute epoch value in ms** on a
`type: 'time'` axis (`nanosToMs(startTime) + offset`). ECharts 6's `time` axis
**quantizes values to whole-millisecond (`Date`) resolution**, destroying all
sub-millisecond structure. For an identical sub-ms window (`min = startMs`,
`max = startMs + 0.00175`, 8 points 250 ns apart), `convertToPixel` returns:

| x-axis / base epoch / window | v5.6.0 | v6.1.0 |
|---|---|---|
| `time`, `1.72e12`, `0.00175 ms` | span `0.00171`, **8/8 distinct pixels** | extent balloons to **±1 day**, **1/8** (all collapse to one pixel) |
| `time`, `0`, `0.00175 ms` | span `0.00175`, **8/8 distinct** | **±1 day**, **1/8** |
| `time`, `1.72e12`, `2 ms` | span `2`, **8/8 distinct** | span `2`, **3/8** (data snapped to whole ms) |
| `value`, `1.72e12`, `0.00175 ms` | span `0.00171`, **8/8** | span `0.00171`, **8/8 distinct** |

Key conclusions:

- It is **magnitude-independent** (breaks at `base = 0` too) → not a float64
  precision ceiling, but deliberate integer-ms quantization on the `time` axis.
- The **`value` axis is unaffected** — v6 preserves fractional/float spans there.
- v6 also **intermittently hangs** (synchronous multi-minute tick-generation
  loops) on sub-ms `time` windows — a worse, secondary failure mode.

Diff notes: `TimeScale.parse`, `scaleRawExtentInfo.ts`,
`axisHelper.ts#niceScaleExtent`, `data/helper/dataValueHelper.ts`, and
`util/number.ts#parseDate` are unchanged between 5.6 and 6.x. The visible
amplifier is the (identical) equal-extent guard in `src/scale/Time.ts`
`calcNiceExtent`: when the sub-ms window collapses to `min === max`, it expands
to `±ONE_DAY`, so every real point lands on the same pixel.

### The fix, and why it is safe for our use case

Move the ECharts numeric domain from absolute epoch ms on a `time` axis to a
**relative nanosecond offset (`ts − startTime`, as a plain integer) on a `value`
axis**. The `value` axis is the one path proven to stay correct on v6, and it
carries full precision.

**Precision budget (float64 exact-integer range `2^53`):**

- Exact 1 ns resolution for any query up to **`2^53` ns ≈ 104.25 days**.
- Degrades gracefully past that (2 ns at ~104–208 days, …); stays under our
  `MIN_BIN_DURATION_NS = 250` floor until **~2^60 ns ≈ 36 years**.
- Real queries run seconds→minutes, i.e. **6–8 orders of magnitude** of margin.

Bonus: today's absolute-epoch-ms ulp at `~1.72e12` is already `~244 ns` — the
very reason `MIN_BIN_DURATION_NS = 250` exists. Relative-ns replaces that
~244 ns floor with exact 1 ns, so this hack can be removed.

## Design principle

- BigInt lives **only at the data boundary**. A single codec converts
  `bigint` ns ↔ relative `number` offset for the axis, and relative `number` ↔
  display string for labels/tooltips.
- ECharts never sees a BigInt; every timeline x-axis becomes `type: 'value'`
  in the **relative-ns domain**. Zoom stays percentage-based (unchanged).
- Display formatting (elapsed durations) is unchanged — it already works in
  ms/µs/ns via `@quent/utils` formatters.

## Scope of this slice

### In scope

1. **Shared codec** (`@quent/utils` + `timeline.utils`), tested:
   - `nsOffset(ts: bigint, origin: bigint): number` — relative offset in ns.
   - `offsetToNs(offset: number, origin: bigint): bigint` — inverse for
     round-tripping pointer/zoom values back to absolute BigInt.
   - Offset-domain formatter helpers (wrap existing `formatDuration*`).
   - Unit tests proving 1 ns / 250 ns steps stay distinct where absolute-ms
     collapses them today.

2. **Migrate the charts used in the app to the relative-ns `value` domain:**
   - `Timeline.tsx` — `type: 'time'` → `type: 'value'`; `data: [offset, value]`;
     `min/max` in offsets; `convertFromPixel` results are offsets (already
     numeric, feed straight into `snapToBinIndex`).
   - `OperatorGanttChart.tsx` — `type: 'time'` → `type: 'value'`;
     `value: [startOffset, endOffset, rowIndex]`; `renderItem` `api.value(0/1)`
     become offsets.
   - `TimelineController.tsx` / `TimelineRuler.tsx` — already `type: 'value'`
     but on absolute epoch ms; switch min/max/label math to offsets
     (labels simplify to `formatDuration(offset)`).
   - `DagPlayhead.tsx` — `broadcastSyncedPointer` sends an offset; the
     axis-pointer registry in `timeline.utils.ts` operates in the same offset
     domain so crosshair sync stays consistent.
   - `operator-timeline/utils.ts` (`spanToMs`, `stackOperatorsIntoRows`) →
     offset-based equivalents.

3. **Remove / lower** `MIN_BIN_DURATION_NS` once bins are distinct at ns scale.

4. **Coordinated landing:** all five surfaces share crosshair/zoom sync, so the
   domain switch lands as one change, not per-chart.

### Validation

- Existing unit tests updated for the offset domain; new codec tests.
- Nanosecond timelines render distinct bins at max zoom.
- **ECharts 6 upgrade check:** re-run the v6 probe (relative-ns `value` axis →
  8/8 distinct pixels; no hang) to confirm the upgrade is unblocked.
- `pnpm ci:check` green.

## Deferred (not in this slice)

- Centralizing the codec + axis/formatter builders into `lib/echarts.ts` as a
  reusable "BigInt time" adapter for future charts.
- Any general ECharts library extension (custom scale/axis, upstream work).
  Note: native BigInt in core is impractical — its `DataStore` is backed by
  `Float64Array`.

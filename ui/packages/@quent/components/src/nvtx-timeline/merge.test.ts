// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { mergeNvtxGanttData, NVTX_BAR_MERGE_MIN_COUNT, type NvtxGanttDatum } from './utils';

const budget = { visibleStartMs: 0, visibleEndMs: 100, plotWidthPx: 100 };

function touchingBars(count: number): NvtxGanttDatum[] {
  return Array.from({ length: count }, (_, index) => ({
    value: [index, index + 1, 0],
  }));
}

describe('NVTX Gantt condensation', () => {
  it('leaves runs below the minimum count separate', () => {
    const bars = touchingBars(NVTX_BAR_MERGE_MIN_COUNT - 1);

    expect(mergeNvtxGanttData(bars, budget)).toEqual(bars);
  });

  it('condenses runs at the minimum count', () => {
    const merged = mergeNvtxGanttData(touchingBars(NVTX_BAR_MERGE_MIN_COUNT), budget);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      value: [0, NVTX_BAR_MERGE_MIN_COUNT, 0],
      mergedCount: NVTX_BAR_MERGE_MIN_COUNT,
    });
  });
});

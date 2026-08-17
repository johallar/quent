// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { mergeNvtxGanttData, type NvtxGanttDatum } from './utils';

const budget = { visibleStartMs: 0, visibleEndMs: 100, plotWidthPx: 100 };

function touchingBars(count: number): NvtxGanttDatum[] {
  return Array.from({ length: count }, (_, index) => ({
    value: [index, index + 1, 0],
  }));
}

describe('NVTX Gantt condensation', () => {
  it('leaves fewer than ten touching bars separate', () => {
    const bars = touchingBars(9);

    expect(mergeNvtxGanttData(bars, budget)).toEqual(bars);
  });

  it('condenses ten touching bars', () => {
    const merged = mergeNvtxGanttData(touchingBars(10), budget);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      value: [0, 10, 0],
      mergedCount: 10,
    });
  });
});

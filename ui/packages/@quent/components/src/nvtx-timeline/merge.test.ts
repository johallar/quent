// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { NvtxRangeItem } from '@quent/utils';
import {
  mergeNvtxGanttData,
  NVTX_BAR_MERGE_MIN_COUNT,
  nvtxMergedBarCountLabel,
  nvtxTooltipModel,
  type NvtxGanttDatum,
} from './utils';

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

  it('labels a consolidated block with its range count', () => {
    const [label] = nvtxMergedBarCountLabel(
      { x: 10, y: 0, width: 80, height: 14 },
      '#111',
      NVTX_BAR_MERGE_MIN_COUNT
    );

    expect(label?.style).toMatchObject({
      text: `(${NVTX_BAR_MERGE_MIN_COUNT} Ranges)`,
      opacity: 0.6,
    });
  });

  it('omits a count that cannot fit without truncation', () => {
    expect(nvtxMergedBarCountLabel({ x: 10, y: 0, width: 4, height: 14 }, '#111', 12)).toEqual([]);
  });
});

function rangeDatum(message: string, depth: number, startMs = 0): NvtxGanttDatum {
  const range: NvtxRangeItem = {
    message,
    domain_id: 'domain-1',
    domain_name: 'Domain 1',
    category_id: null,
    category_name: null,
    color: '#76b900ff',
    kind: 'push_pop',
    thread_id: 42,
    thread_name: 'worker 42',
    observed_start: startMs / 1_000,
    observed_end: (startMs + 1) / 1_000,
    display_start: startMs / 1_000,
    display_end: (startMs + 1) / 1_000,
    observed_duration: 0.001,
    incomplete: false,
  };
  return { value: [startMs, startMs + 1, depth], range };
}

describe('NVTX Gantt tooltip', () => {
  it('omits the thread name and orders ranges by chart depth', () => {
    const tooltip = nvtxTooltipModel([
      rangeDatum('inner', 2),
      rangeDatum('outer', 0),
      rangeDatum('middle', 1),
    ]);

    expect(tooltip.marks.map(mark => mark.label)).toEqual(['outer', 'middle', 'inner']);
    expect(tooltip.marks.map(mark => mark.stateName)).toEqual(['', '', '']);
    expect(tooltip.marks[0]?.attributes?.some(attribute => attribute.key === 'thread')).toBe(false);
  });

  it('aggregates consolidated counts by range type', () => {
    const data = [
      ...Array.from({ length: 3 }, (_, index) => rangeDatum('type A', 0, index)),
      ...Array.from({ length: 5 }, (_, index) => rangeDatum('type B', 0, index + 3)),
    ];
    const tooltip = nvtxTooltipModel(mergeNvtxGanttData(data, budget));

    expect(tooltip.summary).toBe('8 ranges');
    expect(tooltip.marks).toEqual([
      { label: 'type A', stateName: '3 ranges', color: '#76b900', compact: true },
      { label: 'type B', stateName: '5 ranges', color: '#76b900', compact: true },
    ]);
  });
});

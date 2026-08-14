// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { NvtxCatalog, NvtxLane, NvtxViewportResponse } from '@quent/utils';
import {
  NVTX_DOMAIN_ROW_TYPE,
  NVTX_LANE_ROW_TYPE,
  NVTX_SECTION_ID,
  NVTX_SECTION_ROW_TYPE,
  buildNvtxTree,
  indexNvtxLanes,
  nvtxDefaultExpandedIds,
  nvtxDomainRowId,
  nvtxItemsAtTimestamp,
  nvtxKindLabel,
  nvtxDomainMeta,
  nvtxLanesToGanttData,
  nvtxMarksRowId,
  nvtxProcessRowId,
  nvtxThreadRowId,
  mergeNvtxGanttData,
  NVTX_BAR_MERGE_GAP_PX,
  nvtxMergedBarGlyph,
  nvtxToActiveMark,
  nvtxToSummaryMark,
  nvtxTooltipModel,
  rgbHex,
} from './utils';

const CATALOG: NvtxCatalog = {
  trace_start: 0,
  trace_end: 1,
  domains: [
    {
      domain_id: '0',
      name: 'default domain',
      color: '#2563eb',
      threads: [
        { thread_id: 186143, name: 'thread 186143' },
        { thread_id: 186291, name: 'thread 186291' },
      ],
      categories: [],
      has_uncategorized: true,
    },
    {
      domain_id: '2',
      name: 'libcudf',
      color: '#7c3aed',
      threads: [{ thread_id: 186291, name: 'thread 186291' }],
      categories: [],
      has_uncategorized: true,
    },
  ],
  anomalies: {
    orphan_range_ends: '0',
    orphan_range_pops: '0',
    orphan_resource_destroys: '0',
    reused_range_ids: '0',
    reused_resource_handles: '0',
    total: '0',
    is_faithful: true,
  },
};

function range(message: string, start: number, end: number): NvtxLane['ranges'][number] {
  return {
    message,
    domain_id: '2',
    domain_name: 'libcudf',
    category_id: null,
    category_name: null,
    color: '#7c3aedff',
    kind: 'push_pop',
    thread_id: 186291,
    thread_name: 'thread 186291',
    observed_start: start,
    observed_end: end,
    display_start: start,
    display_end: end,
    observed_duration: end - start,
    incomplete: false,
  };
}

const VIEWPORT: NvtxViewportResponse = {
  viewport: { start: 0, end: 1 },
  domains: [
    {
      domain_id: '2',
      name: 'libcudf',
      color: '#7c3aed',
      lanes: [
        {
          id: 'nvtx:2:thread:186291:depth:0',
          label: 'thread 186291',
          identity: { kind: 'thread', thread_id: 186291, depth: 0 },
          ranges: [range('read_parquet', 0.1, 0.4)],
          marks: [],
        },
        {
          id: 'nvtx:2:thread:186291:depth:1',
          label: 'thread 186291 · depth 1',
          identity: { kind: 'thread', thread_id: 186291, depth: 1 },
          ranges: [range('copy_if', 0.2, 0.3)],
          marks: [],
        },
        {
          id: 'nvtx:2:process',
          label: 'Process ranges',
          identity: { kind: 'process' },
          ranges: [range('sirius:query', 0, 1)],
          marks: [],
        },
        {
          id: 'nvtx:2:marks',
          label: 'Marks',
          identity: { kind: 'marks' },
          ranges: [],
          marks: [
            {
              message: 'start',
              domain_id: '2',
              domain_name: 'libcudf',
              category_id: null,
              category_name: null,
              color: '#7c3aedff',
              timestamp: 0.5,
            },
          ],
        },
      ],
    },
  ],
  statistics: [],
};

describe('buildNvtxTree', () => {
  it('nests catalog threads under domains and appends process/marks rows', () => {
    const tree = buildNvtxTree(CATALOG, VIEWPORT);
    expect(tree?.id).toBe(NVTX_SECTION_ID);
    expect(tree?.type).toBe(NVTX_SECTION_ROW_TYPE);
    expect(tree?.children?.map(child => child.type)).toEqual([
      NVTX_DOMAIN_ROW_TYPE,
      NVTX_DOMAIN_ROW_TYPE,
    ]);
    const libcudf = tree?.children?.[1];
    expect(libcudf?.children?.map(child => child.id)).toEqual([
      nvtxThreadRowId('2', 186291),
      nvtxProcessRowId('2'),
      nvtxMarksRowId('2'),
    ]);
    expect(libcudf?.children?.every(child => child.type === NVTX_LANE_ROW_TYPE)).toBe(true);
  });
});

describe('indexNvtxLanes', () => {
  it('groups thread depths onto one row id', () => {
    const lanes = indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291));
    expect(
      lanes?.map(lane => (lane.identity.kind === 'thread' ? lane.identity.depth : -1))
    ).toEqual([0, 1]);
  });
});

describe('nvtxLanesToGanttData', () => {
  it('uses display seconds as ms and depth as the row index', () => {
    const lanes = indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? [];
    expect(nvtxLanesToGanttData(lanes).map(datum => datum.value)).toEqual([
      [100, 400, 0],
      [200, 300, 1],
    ]);
  });

  it('keeps marks as zero-duration ticks', () => {
    const lanes = indexNvtxLanes(VIEWPORT).get(nvtxMarksRowId('2')) ?? [];
    expect(nvtxLanesToGanttData(lanes)[0]?.value).toEqual([500, 500, 0]);
  });
});

describe('nvtxItemsAtTimestamp', () => {
  it('includes nested ranges and instant marks with a 1ms hit target', () => {
    const data = nvtxLanesToGanttData(
      indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? []
    );
    expect(nvtxItemsAtTimestamp(data, 250).map(datum => datum.range?.message)).toEqual([
      'read_parquet',
      'copy_if',
    ]);
    const marks = nvtxLanesToGanttData(indexNvtxLanes(VIEWPORT).get(nvtxMarksRowId('2')) ?? []);
    expect(nvtxItemsAtTimestamp(marks, 500.4)[0]?.mark?.message).toBe('start');
  });
});

describe('nvtxDefaultExpandedIds', () => {
  it('expands the section and every domain', () => {
    expect(nvtxDefaultExpandedIds(CATALOG)).toEqual([
      NVTX_SECTION_ID,
      nvtxDomainRowId('0'),
      nvtxDomainRowId('2'),
    ]);
  });
});

describe('rgbHex', () => {
  it('strips an 8-digit ARGB suffix before withOpacity', () => {
    expect(rgbHex('#7c3aedff')).toBe('#7c3aed');
  });
});

describe('nvtxDomainMeta', () => {
  it('uses the same RGB the Gantt paints', () => {
    expect(nvtxDomainMeta(CATALOG, nvtxDomainRowId('2'))).toEqual({
      name: 'libcudf',
      color: '#7c3aed',
    });
    const withAlpha: NvtxCatalog = {
      ...CATALOG,
      domains: [{ ...CATALOG.domains[1]!, color: '#dc2626ff' }],
    };
    expect(nvtxDomainMeta(withAlpha, nvtxDomainRowId('2'))?.color).toBe('#dc2626');
  });
});

describe('mergeNvtxGanttData', () => {
  const budget = { visibleStartMs: 0, visibleEndMs: 1_000, plotWidthPx: 100 };

  function bar(
    startMs: number,
    endMs: number,
    color = '#7c3aed',
    row = 0
  ): ReturnType<typeof nvtxLanesToGanttData>[number] {
    return {
      value: [startMs, endMs, row],
      range: { ...range('x', startMs / 1_000, endMs / 1_000), color },
    };
  }

  it('merges same-color bars that share a pixel column', () => {
    const merged = mergeNvtxGanttData([bar(0, 4), bar(6, 10), bar(12, 16)], budget);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.value).toEqual([0, 16, 0]);
    expect(merged[0]?.mergedCount).toBe(3);
  });

  it('merges bars within the pixel gap threshold', () => {
    // 10ms/px: first bar occupies 1px, second starts at 2px → 1px gap.
    const merged = mergeNvtxGanttData([bar(0, 4), bar(20, 24)], budget);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.mergedCount).toBe(2);
  });

  it('keeps bars farther apart than the pixel gap threshold', () => {
    const startMs = (1 + NVTX_BAR_MERGE_GAP_PX + 1) * 10;
    const merged = mergeNvtxGanttData([bar(0, 4), bar(startMs, startMs + 4)], budget);
    expect(merged.map(datum => datum.value)).toEqual([
      [0, 4, 0],
      [startMs, startMs + 4, 0],
    ]);
    expect(merged.every(datum => datum.mergedCount == null)).toBe(true);
  });

  it('does not merge different colors, rows, or marks with ranges', () => {
    const mark = {
      value: [6, 6, 0] as [number, number, number],
      mark: {
        message: 'tick',
        domain_id: '2',
        domain_name: 'libcudf',
        category_id: null,
        category_name: null,
        color: '#7c3aedff',
        timestamp: 0.006,
      },
    };
    const merged = mergeNvtxGanttData(
      [bar(0, 4, '#7c3aed'), bar(6, 10, '#dc2626'), bar(6, 10, '#7c3aed', 1), mark],
      budget
    );
    expect(merged).toHaveLength(4);
  });

  it('splits again when the window has more pixels per millisecond', () => {
    const dense = mergeNvtxGanttData([bar(0, 4), bar(6, 10)], budget);
    expect(dense).toHaveLength(1);
    const zoomed = mergeNvtxGanttData([bar(0, 4), bar(6, 10)], {
      visibleStartMs: 0,
      visibleEndMs: 20,
      plotWidthPx: 100,
    });
    expect(zoomed).toHaveLength(2);
  });
});

describe('nvtxMergedBarGlyph', () => {
  it('draws three dots when the bar is wide enough', () => {
    const glyph = nvtxMergedBarGlyph({ x: 10, y: 0, width: 40, height: 14 }, '#111');
    expect(glyph).toHaveLength(3);
    expect(glyph.every(item => item.type === 'circle')).toBe(true);
  });

  it('falls back to an ellipsis on medium bars', () => {
    const glyph = nvtxMergedBarGlyph({ x: 10, y: 0, width: 9, height: 14 }, '#111');
    expect(glyph).toEqual([
      expect.objectContaining({
        type: 'text',
        style: expect.objectContaining({ text: '…' }),
      }),
    ]);
  });

  it('omits the glyph on bars too narrow to read', () => {
    expect(nvtxMergedBarGlyph({ x: 10, y: 0, width: 4, height: 14 }, '#111')).toEqual([]);
  });
});

describe('nvtxKindLabel', () => {
  it('uses the mockup wording', () => {
    expect(nvtxKindLabel('push_pop')).toBe('push/pop range');
    expect(nvtxKindLabel('start_end')).toBe('start/end range');
    expect(nvtxKindLabel('mark')).toBe('mark');
  });
});

describe('nvtxToActiveMark', () => {
  it('maps a range onto TimelineTooltip mark fields', () => {
    const [datum] = nvtxLanesToGanttData(
      indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? []
    );
    expect(nvtxToActiveMark(datum!)).toMatchObject({
      label: 'thread 186291',
      stateName: 'read_parquet',
      color: '#7c3aed',
      attributes: [
        { key: 'start', value: '100.00ms' },
        { key: 'end', value: '400.00ms' },
        { key: 'kind', value: 'push/pop range' },
        { key: 'thread', value: 'thread 186291' },
        { key: 'domain', value: 'libcudf' },
        { key: 'category', value: 'Uncategorized' },
      ],
    });
    expect(nvtxToActiveMark(datum!).durationMs).toBeCloseTo(300);
  });

  it('lists the range name with a count on pixel-merged bars', () => {
    const [datum] = nvtxLanesToGanttData(
      indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? []
    );
    expect(nvtxToSummaryMark({ ...datum!, mergedCount: 4 })).toEqual({
      label: 'read_parquet',
      stateName: '4 ranges',
      color: '#7c3aed',
      compact: true,
    });
    expect(nvtxToActiveMark({ ...datum!, mergedCount: 4 })).toEqual(
      nvtxToSummaryMark({ ...datum!, mergedCount: 4 })
    );
  });
});

describe('nvtxTooltipModel', () => {
  it('keeps a single range in the detailed tooltip', () => {
    const data = nvtxLanesToGanttData(
      indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? []
    ).slice(0, 1);
    const model = nvtxTooltipModel(data);
    expect(model.compact).toBe(false);
    expect(model.summary).toBeUndefined();
    expect(model.marks[0]?.stateName).toBe('read_parquet');
  });

  it('shows full range data for unmerged items and counts for merged bars', () => {
    const nested = nvtxLanesToGanttData(
      indexNvtxLanes(VIEWPORT).get(nvtxThreadRowId('2', 186291)) ?? []
    );
    const stacked = nvtxTooltipModel(nested);
    expect(stacked.compact).toBe(false);
    expect(stacked.summary).toBeUndefined();
    expect(stacked.marks.map(mark => mark.stateName)).toEqual(['read_parquet', 'copy_if']);
    expect(stacked.marks.every(mark => mark.compact !== true)).toBe(true);

    const merged = nvtxTooltipModel([
      { ...nested[0]!, mergedCount: 4 },
      { ...nested[1]!, mergedCount: 2 },
    ]);
    expect(merged.summary).toBe('6 ranges');
    expect(merged.marks.map(mark => mark.stateName)).toEqual(['4 ranges', '2 ranges']);

    const mixed = nvtxTooltipModel([{ ...nested[0]!, mergedCount: 4 }, nested[1]!]);
    expect(mixed.summary).toBe('5 ranges');
    expect(mixed.marks[0]).toMatchObject({
      label: 'read_parquet',
      stateName: '4 ranges',
      compact: true,
    });
    expect(mixed.marks[1]).toMatchObject({ stateName: 'copy_if' });
    expect(mixed.marks[1]?.compact).toBeUndefined();
  });
});

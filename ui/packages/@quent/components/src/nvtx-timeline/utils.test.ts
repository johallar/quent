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
  nvtxLanesToGanttData,
  nvtxMarksRowId,
  nvtxProcessRowId,
  nvtxThreadRowId,
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

describe('nvtxKindLabel', () => {
  it('uses the mockup wording', () => {
    expect(nvtxKindLabel('push_pop')).toBe('push/pop range');
    expect(nvtxKindLabel('start_end')).toBe('start/end range');
    expect(nvtxKindLabel('mark')).toBe('mark');
  });
});

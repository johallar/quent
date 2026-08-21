// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { NvtxCatalog, NvtxViewportResponse } from '@quent/utils';
import {
  buildNvtxTree,
  indexNvtxLanes,
  NVTX_DOMAIN_ROW_TYPE,
  NVTX_LANE_ROW_TYPE,
  nvtxDomainRowId,
  nvtxLaneLabel,
  nvtxMarksRowId,
  nvtxProcessRowId,
  nvtxThreadRowId,
} from './utils';

function nvtxDomain(
  domainId: string,
  name: string,
  threadId: number,
  threadName: string
): NvtxCatalog['domains'][number] {
  return {
    domain_id: domainId,
    name,
    color: '#000000ff',
    threads: [{ thread_id: threadId, name: threadName }],
    categories: [],
    has_uncategorized: true,
  };
}

const catalog = {
  domains: [nvtxDomain('1', 'libcudf', 101, 'worker 1'), nvtxDomain('3', 'CCCL', 303, 'worker 3')],
} satisfies Pick<NvtxCatalog, 'domains'>;

describe('NVTX resource tree', () => {
  it('puts the selected domain lanes directly below the NVTX row', () => {
    const tree = buildNvtxTree(catalog, new Set(), '3');

    expect(tree?.children).toEqual([
      expect.objectContaining({
        id: nvtxThreadRowId('3', 303),
        type: NVTX_LANE_ROW_TYPE,
      }),
    ]);
  });

  it('keeps each domain in a sub-tree when showing all domains', () => {
    const tree = buildNvtxTree(catalog, new Set(), null);

    expect(tree?.children).toEqual([
      expect.objectContaining({
        id: nvtxDomainRowId('1'),
        type: NVTX_DOMAIN_ROW_TYPE,
        children: [expect.objectContaining({ id: nvtxThreadRowId('1', 101) })],
      }),
      expect.objectContaining({
        id: nvtxDomainRowId('3'),
        type: NVTX_DOMAIN_ROW_TYPE,
        children: [expect.objectContaining({ id: nvtxThreadRowId('3', 303) })],
      }),
    ]);
    expect(nvtxLaneLabel(catalog, new Map(), nvtxThreadRowId('3', 303))).toBe('worker 3');
  });

  it('appends process and marks lanes after thread rows', () => {
    const viewport = {
      viewport: { start: 0, end: 1 },
      domains: [
        {
          domain_id: '3',
          name: 'CCCL',
          color: '#000000ff',
          lanes: [
            {
              id: 'process',
              label: 'Process ranges',
              identity: { kind: 'process' },
              ranges: [],
              marks: [],
            },
            {
              id: 'marks',
              label: 'Marks',
              identity: { kind: 'marks' },
              ranges: [],
              marks: [],
            },
          ],
        },
      ],
      statistics: [],
    } satisfies NvtxViewportResponse;
    const lanesByRowId = indexNvtxLanes(viewport);
    const tree = buildNvtxTree(catalog, new Set(lanesByRowId.keys()), '3');

    expect(tree?.children?.map(item => item.id)).toEqual([
      nvtxThreadRowId('3', 303),
      nvtxProcessRowId('3'),
      nvtxMarksRowId('3'),
    ]);
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { NvtxCatalog } from '@quent/utils';
import {
  buildNvtxTree,
  NVTX_DOMAIN_ROW_TYPE,
  NVTX_LANE_ROW_TYPE,
  nvtxDomainRowId,
  nvtxLaneLabel,
  nvtxThreadRowId,
} from './utils';

const catalog = {
  domains: [
    {
      domain_id: '1',
      name: 'libcudf',
      threads: [{ thread_id: 101, name: 'worker 1' }],
    },
    {
      domain_id: '3',
      name: 'CCCL',
      threads: [{ thread_id: 303, name: 'worker 3' }],
    },
  ],
} as NvtxCatalog;

describe('NVTX resource tree', () => {
  it('puts the selected domain lanes directly below the NVTX row', () => {
    const tree = buildNvtxTree(catalog, null, '3');

    expect(tree?.children).toEqual([
      expect.objectContaining({
        id: nvtxThreadRowId('3', 303),
        type: NVTX_LANE_ROW_TYPE,
      }),
    ]);
  });

  it('keeps each domain in a sub-tree when showing all domains', () => {
    const tree = buildNvtxTree(catalog, null, null);

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
    expect(nvtxLaneLabel(catalog, null, nvtxThreadRowId('3', 303))).toBe('worker 3');
  });
});

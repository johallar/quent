// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildQueryPlanVisualization } from './useQueryPlanVisualization';
import { getPlanDAG, getTreeData } from './query-bundle-transformer';

vi.mock('./query-bundle-transformer', () => ({
  getPlanDAG: vi.fn(),
  getTreeData: vi.fn(),
}));

const getPlanDAGMock = vi.mocked(getPlanDAG);
const getTreeDataMock = vi.mocked(getTreeData);

describe('buildQueryPlanVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adapts a bundle into the existing DAGData model', () => {
    const treeData = [{ id: 'plan-1', name: 'Plan 1' }];
    getTreeDataMock.mockReturnValue(treeData);
    getPlanDAGMock.mockReturnValue({
      nodes: [{ id: 'operator-1', label: 'Scan', type: 'scan' }],
      edges: [],
    });
    const bundle = { quantity_specs: { bytes: { base: 1024 } } } as never;

    const result = buildQueryPlanVisualization(bundle, 'plan-1');

    expect(result.error).toBeNull();
    expect(result.treeData).toBe(treeData);
    expect(result.dagData).toMatchObject({
      nodes: [{ id: 'operator-1' }],
      edges: [],
      queryData: treeData,
      quantitySpecs: { bytes: { base: 1024 } },
    });
  });

  it('returns an empty DAG and surfaces transform failures', () => {
    getTreeDataMock.mockReturnValue([]);
    getPlanDAGMock.mockImplementation(() => {
      throw new Error('missing plan');
    });

    const result = buildQueryPlanVisualization({} as never, 'plan-1');

    expect(result.dagData).toEqual({ nodes: [], edges: [], queryData: [] });
    expect(result.error).toEqual(new Error('missing plan'));
  });
});

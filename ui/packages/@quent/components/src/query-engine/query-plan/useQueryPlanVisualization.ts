// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import type { EntityRef, QueryBundle } from '@quent/utils/query-engine';
import { getPlanDAG, getTreeData } from './query-bundle-transformer';
import type { DAGData, QueryPlanDataItem } from './types';

export interface QueryPlanVisualizationResult {
  dagData: DAGData;
  treeData: QueryPlanDataItem[];
  error: Error | null;
}

const EMPTY_DAG: DAGData = { nodes: [], edges: [], queryData: [] };

export function buildQueryPlanVisualization(
  queryBundle: QueryBundle<EntityRef> | undefined,
  planId: string
): QueryPlanVisualizationResult {
  let treeData: QueryPlanDataItem[] = [];
  if (queryBundle) {
    try {
      treeData = getTreeData(queryBundle);
    } catch (error) {
      console.error('Error generating tree data:', error);
    }
  }

  if (!queryBundle || !planId) {
    return { dagData: EMPTY_DAG, treeData, error: null };
  }

  try {
    const dag = getPlanDAG(queryBundle, planId);
    return {
      dagData: { ...dag, queryData: treeData, quantitySpecs: queryBundle.quantity_specs },
      treeData,
      error: null,
    };
  } catch (error) {
    return {
      dagData: EMPTY_DAG,
      treeData,
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/** Memoized QueryBundle adapter for query-plan views. */
export function useQueryPlanVisualization(
  queryBundle: QueryBundle<EntityRef> | undefined,
  planId: string
): QueryPlanVisualizationResult {
  return useMemo(() => buildQueryPlanVisualization(queryBundle, planId), [planId, queryBundle]);
}

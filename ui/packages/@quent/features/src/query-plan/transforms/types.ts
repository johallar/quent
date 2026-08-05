// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DAGEdge, DAGNode } from '../../dag/state/types';
import type { TreeDataItem } from '../../shared/ui/tree-view';

export interface QueryPlanDataItem extends TreeDataItem {
  queryId?: string;
  workerId?: string;
  planType?: string;
}

export type { StatValue } from '@quent/protocol';
export type {
  CategoricalEdgeColoring,
  CategoricalNodeColoring,
  ContinuousEdgeColoring,
  ContinuousNodeColoring,
  DAGEdge,
  DAGNode,
  EdgeColoring,
  EdgeWidthConfig,
  NodeColoring,
} from '../../dag/state/types';

export interface DAGData {
  nodes: DAGNode[];
  edges: DAGEdge[];
  queryData: QueryPlanDataItem[];
}

export interface QueryPlanNodeData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  operationType: string;
  metadata?: Record<string, unknown>;
  hasIncoming?: boolean;
  hasOutgoing?: boolean;
}

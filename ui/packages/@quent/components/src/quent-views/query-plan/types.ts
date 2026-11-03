// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import type { DAGEdge, DAGNode } from '@quent/utils';

export interface DAGGraphData {
  nodes: DAGNode[];
  edges: DAGEdge[];
}

export type DAGNodeOpacity = 'full' | 'dimmed' | 'faded';

export interface QueryPlanNodePresentation {
  borderColor: string;
  backgroundColor: string;
  hoverBackgroundColor: string;
  textColor?: string;
  colorFieldTextColor?: string;
  isSelected: boolean;
  isActiveHighlight: boolean;
  opacity: DAGNodeOpacity;
}

export interface QueryPlanNodeViewData extends Record<string, unknown> {
  nodeId: string;
  label: string;
  operationType: string;
  hasIncoming: boolean;
  hasOutgoing: boolean;
  incomingHandlePosition: 'top' | 'bottom';
  outgoingHandlePosition: 'top' | 'bottom';
  formattedColorFieldValue?: string | null;
  flowBar?: ReactNode;
  presentation: QueryPlanNodePresentation;
  onHoverChange?: (hovered: boolean) => void;
}

export interface DAGEdgePresentation {
  color: string;
  strokeWidth: number;
  dimmed: boolean;
  emphasized: boolean;
  label?: string;
}

export interface DAGEdgeViewData extends Record<string, unknown> {
  sourcePortId?: string;
  targetPortId?: string;
  sourcePortName?: string;
  targetPortName?: string;
  inspected: boolean;
  presentation: DAGEdgePresentation;
  onHoverChange?: (hovered: boolean) => void;
  onInspect?: () => void;
}

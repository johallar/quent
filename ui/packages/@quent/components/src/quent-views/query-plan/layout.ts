// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { graph, sugiyama } from 'd3-dag';
import type { Edge, Node } from '@xyflow/react';

export const NODE_LAYOUT_WIDTH = 200;
export const NODE_LAYOUT_HEIGHT = 60;
export const FLOW_BAR_TOP_MARGIN = 6;
export const FLOW_BAR_TRACK_HEIGHT = 12;
export const FLOW_BAR_TRACK_GAP = 2;
export const FLOW_BAR_LABEL_HEIGHT = 12;
export const FLOW_BAR_HEIGHT =
  FLOW_BAR_TOP_MARGIN +
  FLOW_BAR_TRACK_HEIGHT +
  FLOW_BAR_TRACK_GAP +
  FLOW_BAR_TRACK_HEIGHT +
  FLOW_BAR_LABEL_HEIGHT;

const NODE_SPACING = 50;
const LAYER_SPACING = 100;

export async function calculateLayout<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
  direction: 'bottom-to-top' | 'top-to-bottom' = 'bottom-to-top',
  nodeHeight = NODE_LAYOUT_HEIGHT
): Promise<{ nodes: Node<TData>[]; edges: Edge[] }> {
  const dag = graph<string, undefined>();
  const nodeById = new Map<string, ReturnType<typeof dag.node>>();
  for (const node of nodes) {
    nodeById.set(node.id, dag.node(node.id));
  }
  const flip = direction === 'bottom-to-top';
  for (const edge of edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (source && target) {
      dag.link(flip ? target : source, flip ? source : target, undefined);
    }
  }

  sugiyama().nodeSize([NODE_LAYOUT_WIDTH + NODE_SPACING, nodeHeight + LAYER_SPACING])(dag);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of dag.nodes()) {
    positions.set(node.data, {
      x: (node.x ?? 0) - NODE_LAYOUT_WIDTH / 2,
      y: (node.y ?? 0) - nodeHeight / 2,
    });
  }

  return {
    nodes: nodes.map(node => ({
      ...node,
      position: positions.get(node.id) ?? { x: 0, y: 0 },
    })),
    edges,
  };
}

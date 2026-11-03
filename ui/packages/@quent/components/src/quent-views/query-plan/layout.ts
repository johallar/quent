// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { graph, sugiyama } from 'd3-dag';
import type { Edge, Node } from '@xyflow/react';

type DagLayoutDirection = 'bottom-to-top' | 'top-to-bottom';

export const NODE_LAYOUT_WIDTH = 200;
export const NODE_LAYOUT_HEIGHT = 72;
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

export function calculateLayout<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
  direction: DagLayoutDirection = 'bottom-to-top',
  nodeHeight = NODE_LAYOUT_HEIGHT
): { nodes: Node<TData>[]; edges: Edge[] } {
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

  const sizeById = new Map(
    nodes.map(node => [
      node.id,
      {
        width: Math.max(NODE_LAYOUT_WIDTH, node.measured?.width ?? node.width ?? 0),
        height: Math.max(nodeHeight, node.measured?.height ?? node.height ?? 0),
      },
    ])
  );
  const layoutWidth = Math.max(
    NODE_LAYOUT_WIDTH,
    ...[...sizeById.values()].map(size => size.width)
  );
  const layoutHeight = Math.max(nodeHeight, ...[...sizeById.values()].map(size => size.height));

  sugiyama().nodeSize([layoutWidth + NODE_SPACING, layoutHeight + LAYER_SPACING])(dag);

  const positions = new Map<string, { x: number; y: number }>();
  for (const node of dag.nodes()) {
    const size = sizeById.get(node.data) ?? {
      width: NODE_LAYOUT_WIDTH,
      height: nodeHeight,
    };
    positions.set(node.data, {
      x: (node.x ?? 0) - size.width / 2,
      y: (node.y ?? 0) - size.height / 2,
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

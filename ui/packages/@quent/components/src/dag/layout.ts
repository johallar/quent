// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { graph, sugiyama } from 'd3-dag';
import ELK from 'elkjs';
import type { Node, Edge } from '@xyflow/react';

export const NODE_LAYOUT_WIDTH = 200;
const NODE_LAYOUT_HEIGHT = 60;
const NODE_SPACING = 50;
const LAYER_SPACING = 100;

export type LayoutEngine = 'd3-dag' | 'elk';

const D3_NODE_SIZE = [
  NODE_LAYOUT_WIDTH + NODE_SPACING,
  NODE_LAYOUT_HEIGHT + LAYER_SPACING,
] as const;

async function layoutWithD3Dag<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[]
): Promise<{ nodes: Node<TData>[]; edges: Edge[] }> {
  const grf = graph<string, undefined>();
  const nodeById = new Map<string, ReturnType<typeof grf.node>>();
  for (const n of nodes) nodeById.set(n.id, grf.node(n.id));
  for (const e of edges) {
    const src = nodeById.get(e.source);
    const tgt = nodeById.get(e.target);
    if (src && tgt) grf.link(src, tgt, undefined);
  }

  // sugiyama is synchronous and top-to-bottom by default (matches ELK DOWN)
  sugiyama().nodeSize(D3_NODE_SIZE)(grf);

  // d3-dag reports node centers; ReactFlow expects top-left
  const posMap = new Map<string, { x: number; y: number }>();
  for (const node of grf.nodes()) {
    posMap.set(node.data, {
      x: (node.x ?? 0) - NODE_LAYOUT_WIDTH / 2,
      y: (node.y ?? 0) - NODE_LAYOUT_HEIGHT / 2,
    });
  }

  return {
    nodes: nodes.map(n => ({ ...n, position: posMap.get(n.id) ?? { x: 0, y: 0 } })),
    edges,
  };
}

// ---- ELK -------------------------------------------------------------------

const elk = new ELK();

const elkOptions = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.layered.spacing.nodeNodeBetweenLayers': `${LAYER_SPACING}`,
  'elk.spacing.nodeNode': `${NODE_SPACING}`,
};

async function layoutWithElk<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[]
): Promise<{ nodes: Node<TData>[]; edges: Edge[] }> {
  const elkGraph = {
    id: 'root',
    layoutOptions: elkOptions,
    children: nodes.map(n => ({
      id: n.id,
      width: NODE_LAYOUT_WIDTH,
      height: NODE_LAYOUT_HEIGHT,
    })),
    edges: edges.map(e => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layout = await elk.layout(elkGraph);

  return {
    nodes:
      layout.children?.map((child, i) => ({
        ...nodes[i]!,
        position: { x: child.x ?? 0, y: child.y ?? 0 },
      })) ?? [],
    edges,
  };
}

// ---- Public API ------------------------------------------------------------

export async function calculateLayout<TData extends Record<string, unknown>>(
  nodes: Node<TData>[],
  edges: Edge[],
  engine: LayoutEngine = 'd3-dag'
): Promise<{ nodes: Node<TData>[]; edges: Edge[] }> {
  return engine === 'elk' ? layoutWithElk(nodes, edges) : layoutWithD3Dag(nodes, edges);
}

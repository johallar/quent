// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType, ReactNode } from 'react';
import {
  Background,
  EdgeLabelRenderer,
  MiniMap,
  ReactFlow,
  getSmoothStepPath,
  type Edge,
  type EdgeProps,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnMoveStart,
  type NodeMouseHandler,
  type OnNodesChange,
} from '@xyflow/react';
import { QueryPlanNodeView } from './QueryPlanNodeView';
import type { DAGEdgeViewData, QueryPlanNodeViewData } from './types';

const EDGE_DIMMED_OPACITY = 0.25;
const EDGE_TRANSITION_MS = 150;
const ARROW_WIDTH_MULTIPLIER = 1.5;
const ARROW_WIDTH_BASE = 8;
const ARROW_DEPTH_RATIO = 0.6;
const MINIMAP_SIZE = 125;
const MINIMAP_NODE_STROKE_WIDTH = 3;

/** Provider-free DAG edge renderer driven entirely by presentation props. */
export function DAGEdgeView(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const data = props.data as DAGEdgeViewData | undefined;
  if (!data) {
    return null;
  }
  const { presentation } = data;
  const arrowWidth = presentation.strokeWidth * ARROW_WIDTH_MULTIPLIER + ARROW_WIDTH_BASE;
  const arrowDepth = arrowWidth * ARROW_DEPTH_RATIO;
  const markerId = `arrow-${id}`;
  const targetYOffset = targetPosition === 'bottom' ? arrowDepth : -arrowDepth;
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY: targetY + targetYOffset,
    sourcePosition,
    targetPosition,
  });
  const color = presentation.emphasized ? 'hsl(var(--primary))' : presentation.color;

  return (
    <>
      <defs>
        <marker
          id={markerId}
          markerWidth={arrowDepth}
          markerHeight={arrowWidth}
          refX={0}
          refY={arrowWidth / 2}
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d={`M0,0 L0,${arrowWidth} L${arrowDepth},${arrowWidth / 2} z`} fill={color} />
        </marker>
      </defs>
      {data.sourcePortId && data.targetPortId && (
        <path
          d={edgePath}
          fill="none"
          stroke="transparent"
          strokeWidth={Math.max(16, presentation.strokeWidth)}
          style={{ pointerEvents: 'stroke', cursor: 'pointer', outline: 'none' }}
          role="button"
          tabIndex={0}
          aria-label={`Inspect pipe ${data.sourcePortName ?? data.sourcePortId} to ${data.targetPortName ?? data.targetPortId}`}
          aria-pressed={data.inspected}
          onMouseEnter={() => data.onHoverChange?.(true)}
          onMouseLeave={() => data.onHoverChange?.(false)}
          onClick={event => {
            event.stopPropagation();
            data.onInspect?.();
          }}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              data.onInspect?.();
            }
          }}
        >
          <title>{`${data.sourcePortName ?? data.sourcePortId} → ${data.targetPortName ?? data.targetPortId}`}</title>
        </path>
      )}
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={`url(#${markerId})`}
        style={{
          pointerEvents: 'none',
          stroke: color,
          filter: presentation.emphasized ? 'drop-shadow(0 0 3px hsl(var(--primary)))' : undefined,
          strokeWidth: presentation.strokeWidth,
          fill: 'none',
          opacity: presentation.dimmed ? EDGE_DIMMED_OPACITY : 1,
          transition: `opacity ${EDGE_TRANSITION_MS}ms, stroke ${EDGE_TRANSITION_MS}ms`,
        }}
      />
      {presentation.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
              opacity: presentation.dimmed ? EDGE_DIMMED_OPACITY : 1,
              transition: `opacity ${EDGE_TRANSITION_MS}ms`,
            }}
            className="rounded border border-border/50 bg-background/80 px-1 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            {presentation.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

const defaultNodeTypes = new Proxy(
  {},
  { get: () => QueryPlanNodeView as unknown as ComponentType }
) as NodeTypes;
const defaultEdgeTypes: EdgeTypes = {
  smoothstep: DAGEdgeView,
  default: DAGEdgeView,
};

export interface DAGGraphViewProps<
  TNodeData extends Record<string, unknown> = QueryPlanNodeViewData,
  TEdgeData extends Record<string, unknown> = DAGEdgeViewData,
> {
  nodes: Node<TNodeData>[];
  edges: Edge<TEdgeData>[];
  onNodesChange: OnNodesChange<Node<TNodeData>>;
  onEdgesChange: OnEdgesChange<Edge<TEdgeData>>;
  onNodeClick?: NodeMouseHandler<Node<TNodeData>>;
  onPaneClick?: () => void;
  onMoveStart?: OnMoveStart;
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  minZoom: number;
  maxZoom: number;
  miniMapNodeColor: (node: Node<TNodeData>) => string;
  overlays?: ReactNode;
}

/** Provider-free React Flow rendering shell with controlled graph state. */
export function DAGGraphView<
  TNodeData extends Record<string, unknown> = QueryPlanNodeViewData,
  TEdgeData extends Record<string, unknown> = DAGEdgeViewData,
>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onPaneClick,
  onMoveStart,
  nodeTypes = defaultNodeTypes,
  edgeTypes = defaultEdgeTypes,
  minZoom,
  maxZoom,
  miniMapNodeColor,
  overlays,
}: DAGGraphViewProps<TNodeData, TEdgeData>) {
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onPaneClick={onPaneClick}
      onMoveStart={onMoveStart}
      proOptions={{ hideAttribution: true }}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={minZoom}
      maxZoom={maxZoom}
      defaultEdgeOptions={{ type: 'smoothstep' }}
    >
      <Background />
      {overlays}
      <MiniMap
        pannable
        zoomable
        nodeStrokeWidth={MINIMAP_NODE_STROKE_WIDTH}
        style={{ width: MINIMAP_SIZE, height: MINIMAP_SIZE, background: 'hsl(var(--card))' }}
        maskColor="hsl(var(--muted) / 0.7)"
        nodeColor={node => miniMapNodeColor(node as Node<TNodeData>)}
      />
    </ReactFlow>
  );
}

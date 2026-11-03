// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const NO_EDGES: ReadonlySet<string> = new Set();

export function shouldDimEdgeFromInteraction({
  hoveredEdgeId,
  inspectedEdgeIds = NO_EDGES,
  edgeId,
  selectedNodeIds,
  highlightedNodeIds,
}: {
  hoveredEdgeId?: string;
  inspectedEdgeIds?: ReadonlySet<string>;
  edgeId?: string;
  selectedNodeIds: ReadonlySet<string>;
  highlightedNodeIds: ReadonlySet<string> | null;
}): boolean {
  if (edgeId !== undefined && (edgeId === hoveredEdgeId || inspectedEdgeIds.has(edgeId))) {
    return false;
  }
  return (
    hoveredEdgeId !== undefined ||
    selectedNodeIds.size > 0 ||
    inspectedEdgeIds.size > 0 ||
    highlightedNodeIds !== null
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DAGNodeOpacity } from './types';

export function resolveNodeOpacity({
  isHoveredStatActive,
  hasHoveredValue,
  highlightedNodeIds,
  operatorId,
  isDimmed,
  isFiltered,
}: {
  isHoveredStatActive: boolean;
  hasHoveredValue: boolean;
  highlightedNodeIds: ReadonlySet<string> | null;
  operatorId: string;
  isDimmed: boolean;
  isFiltered: boolean;
}): DAGNodeOpacity {
  if (isHoveredStatActive) {
    return hasHoveredValue || isFiltered ? 'full' : 'faded';
  }
  if (highlightedNodeIds !== null && highlightedNodeIds.size > 0) {
    return highlightedNodeIds.has(operatorId) || isFiltered ? 'full' : 'dimmed';
  }
  return isDimmed ? 'dimmed' : 'full';
}

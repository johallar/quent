// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { InspectedNodeData } from '@quent/utils';

export function findInspectedNodeData(
  current: ReadonlyMap<string, InspectedNodeData>,
  operatorId: string
): InspectedNodeData | undefined {
  const direct = current.get(operatorId);
  if (direct) {
    return direct;
  }
  for (const data of current.values()) {
    if (data.nodeId === operatorId) {
      return data;
    }
    const related = data.relatedOperators?.find(operator => operator.nodeId === operatorId);
    if (related) {
      return related;
    }
  }
  return undefined;
}

export function upsertInspectedNodeData(
  current: ReadonlyMap<string, InspectedNodeData>,
  selectionId: string,
  data: InspectedNodeData
): Map<string, InspectedNodeData> {
  const next = new Map(current);
  next.set(selectionId, data);
  return next;
}

export function removeInspectedNodeData(
  current: ReadonlyMap<string, InspectedNodeData>,
  selectionId: string
): ReadonlyMap<string, InspectedNodeData> {
  if (!current.has(selectionId)) {
    return current;
  }
  const next = new Map(current);
  next.delete(selectionId);
  return next;
}

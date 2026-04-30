// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';

const treeStateSchema = z.object({
  expandedIds: z.array(z.string()).catch([]),
  selectedTypes: z.record(z.string(), z.string()).catch({}),
  selectedFsmTypes: z.record(z.string(), z.string().nullable()).catch({}),
  planId: z.string().optional(),
  operatorId: z.string().optional(),
  operatorLabel: z.string().nullable().optional(),
  zoomStart: z.number().optional(),
  zoomEnd: z.number().optional(),
  hideTasks: z.boolean().optional(),
  dagColorField: z.string().nullable().optional(),
  dagEdgeWidthField: z.string().nullable().optional(),
  dagEdgeColorField: z.string().nullable().optional(),
  dagNodeLabelField: z.enum(['name', 'id', 'type']).optional(),
  dagNodePalette: z.enum(['blue', 'teal', 'purple', 'orange', 'viridis']).optional(),
  dagEdgePalette: z.enum(['blue', 'teal', 'purple', 'orange', 'viridis']).optional(),
});

export type TreeState = z.infer<typeof treeStateSchema>;

export interface TreeStateInput {
  expandedIds: Set<string>;
  selectedTypes: Map<string, string>;
  selectedFsmTypes: Map<string, string | null>;
  planId?: string;
  operatorId?: string;
  operatorLabel?: string | null;
  zoomStart?: number;
  zoomEnd?: number;
  hideTasks?: boolean;
  dagColorField?: string | null;
  dagEdgeWidthField?: string | null;
  dagEdgeColorField?: string | null;
  dagNodeLabelField?: 'name' | 'id' | 'type';
  dagNodePalette?: 'blue' | 'teal' | 'purple' | 'orange' | 'viridis';
  dagEdgePalette?: 'blue' | 'teal' | 'purple' | 'orange' | 'viridis';
}

export function encodeTreeState(state: TreeStateInput): string {
  const raw = {
    expandedIds: [...state.expandedIds],
    selectedTypes: Object.fromEntries(state.selectedTypes),
    selectedFsmTypes: Object.fromEntries(state.selectedFsmTypes),
    planId: state.planId,
    operatorId: state.operatorId,
    operatorLabel: state.operatorLabel ?? null,
    zoomStart: state.zoomStart,
    zoomEnd: state.zoomEnd,
    hideTasks: state.hideTasks,
    dagColorField: state.dagColorField ?? null,
    dagEdgeWidthField: state.dagEdgeWidthField ?? null,
    dagEdgeColorField: state.dagEdgeColorField ?? null,
    dagNodeLabelField: state.dagNodeLabelField,
    dagNodePalette: state.dagNodePalette,
    dagEdgePalette: state.dagEdgePalette,
  };
  return compressToEncodedURIComponent(JSON.stringify(raw));
}

export function decodeTreeState(param: string): TreeState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(param);
    if (!decompressed) return null;
    const parsed: unknown = JSON.parse(decompressed);
    const result = treeStateSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

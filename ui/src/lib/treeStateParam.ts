// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import { z } from 'zod';
import { CONTINUOUS_PALETTES, type ContinuousPaletteName } from '@/services/colors';
import { safeRun } from '@/lib/safeUrlState';

const continuousPaletteNames = Object.keys(CONTINUOUS_PALETTES) as [
  ContinuousPaletteName,
  ...ContinuousPaletteName[],
];

const treeStateSchema = z.object({
  expandedIds: z.array(z.string()).catch([]),
  selectedTypes: z.record(z.string(), z.string()).catch({}),
  selectedFsmTypes: z.record(z.string(), z.string().nullable()).catch({}),
  zoomStart: z.number().optional(),
  zoomEnd: z.number().optional(),
  hideTasks: z.boolean().optional(),
});

const dagStateSchema = z.object({
  planId: z.string().optional(),
  operatorId: z.string().optional(),
  operatorLabel: z.string().nullable().optional(),
  dagColorField: z.string().nullable().optional(),
  dagEdgeWidthField: z.string().nullable().optional(),
  dagEdgeColorField: z.string().nullable().optional(),
  dagNodeLabelField: z.enum(['name', 'id', 'type']).optional(),
  dagNodePalette: z.enum(continuousPaletteNames).optional(),
  dagEdgePalette: z.enum(continuousPaletteNames).optional(),
});

const operatorsStateSchema = z.object({
  indexOrder: z.array(z.string()).optional(),
  enabledIndices: z.record(z.string(), z.boolean()).optional(),
  selectedStats: z.array(z.string()).nullable().optional(),
  statOrder: z.array(z.string()).nullable().optional(),
  aggMode: z.enum(['value', 'sum', 'mean', 'min', 'max', 'stdev']).optional(),
  sorting: z
    .array(
      z.object({
        id: z.string(),
        desc: z.boolean(),
      })
    )
    .optional(),
});

/**
 * Backward-compat schema for old combined treeState payloads.
 * New URLs should use `treeState` + `dagState` + `operatorsState` separately.
 */
const legacyCombinedTreeStateSchema = treeStateSchema.extend(dagStateSchema.shape);

export type TreeState = z.infer<typeof treeStateSchema>;
export type DagState = z.infer<typeof dagStateSchema>;
export type OperatorsState = z.infer<typeof operatorsStateSchema>;

export interface TreeStateInput {
  expandedIds: Set<string>;
  selectedTypes: Map<string, string>;
  selectedFsmTypes: Map<string, string | null>;
  zoomStart?: number;
  zoomEnd?: number;
  hideTasks?: boolean;
}

export interface DagStateInput {
  planId?: string;
  operatorId?: string;
  operatorLabel?: string | null;
  dagColorField?: string | null;
  dagEdgeWidthField?: string | null;
  dagEdgeColorField?: string | null;
  dagNodeLabelField?: 'name' | 'id' | 'type';
  dagNodePalette?: ContinuousPaletteName;
  dagEdgePalette?: ContinuousPaletteName;
}

export interface OperatorsStateInput {
  indexOrder?: string[];
  enabledIndices?: Record<string, boolean>;
  selectedStats?: string[] | null;
  statOrder?: string[] | null;
  aggMode?: 'value' | 'sum' | 'mean' | 'min' | 'max' | 'stdev';
  sorting?: Array<{ id: string; desc: boolean }>;
}

export function encodeTreeState(state: TreeStateInput): string {
  return safeRun(
    'encode-tree',
    () => {
      const raw = {
        expandedIds: [...state.expandedIds],
        selectedTypes: Object.fromEntries(state.selectedTypes),
        selectedFsmTypes: Object.fromEntries(state.selectedFsmTypes),
        zoomStart: state.zoomStart,
        zoomEnd: state.zoomEnd,
        hideTasks: state.hideTasks,
      };
      return compressToEncodedURIComponent(JSON.stringify(raw));
    },
    ''
  );
}

export function encodeDagState(state: DagStateInput): string {
  return safeRun(
    'encode-dag',
    () => {
      const raw = {
        planId: state.planId,
        operatorId: state.operatorId,
        operatorLabel: state.operatorLabel ?? null,
        dagColorField: state.dagColorField ?? null,
        dagEdgeWidthField: state.dagEdgeWidthField ?? null,
        dagEdgeColorField: state.dagEdgeColorField ?? null,
        dagNodeLabelField: state.dagNodeLabelField,
        dagNodePalette: state.dagNodePalette,
        dagEdgePalette: state.dagEdgePalette,
      };
      return compressToEncodedURIComponent(JSON.stringify(raw));
    },
    ''
  );
}

export function encodeOperatorsState(state: OperatorsStateInput): string {
  return safeRun(
    'encode-operators',
    () => compressToEncodedURIComponent(JSON.stringify(state)),
    ''
  );
}

export function decodeTreeState(param: string): TreeState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(param);
    if (!decompressed) return null;
    const parsed: unknown = JSON.parse(decompressed);
    const result = treeStateSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('[url-state/decode-tree]', result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('[url-state/decode-tree]', err);
    return null;
  }
}

export function decodeDagState(param: string): DagState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(param);
    if (!decompressed) return null;
    const parsed: unknown = JSON.parse(decompressed);
    const result = dagStateSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('[url-state/decode-dag]', result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('[url-state/decode-dag]', err);
    return null;
  }
}

export function decodeOperatorsState(param: string): OperatorsState | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(param);
    if (!decompressed) return null;
    const parsed: unknown = JSON.parse(decompressed);
    const result = operatorsStateSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('[url-state/decode-operators]', result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('[url-state/decode-operators]', err);
    return null;
  }
}

export function decodeLegacyCombinedTreeState(param: string): (TreeState & DagState) | null {
  try {
    const decompressed = decompressFromEncodedURIComponent(param);
    if (!decompressed) return null;
    const parsed: unknown = JSON.parse(decompressed);
    const result = legacyCombinedTreeStateSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('[url-state/decode-legacy]', result.error);
      return null;
    }
    return result.data;
  } catch (err) {
    console.warn('[url-state/decode-legacy]', err);
    return null;
  }
}

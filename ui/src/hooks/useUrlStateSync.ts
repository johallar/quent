// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useLocation, useNavigate } from '@tanstack/react-router';
import {
  selectedPlanIdAtom,
  selectedNodeIdsAtom,
  selectedOperatorLabelAtom,
  selectedColorField,
  selectedEdgeWidthFieldAtom,
  selectedEdgeColorFieldAtom,
  selectedNodeLabelFieldAtom,
  nodeColorPaletteAtom,
  edgeColorPaletteAtom,
  NODE_LABEL_FIELD,
} from '@/atoms/dag';
import { expandedIdsAtom, selectedFsmTypesAtom, selectedTypesAtom } from '@/atoms/resourceTree';
import { debouncedZoomRangeAtom, hideTasksAtom } from '@/atoms/timeline';
import { encodeTreeState, decodeTreeState } from '@/lib/treeStateParam';

export interface QueryIndexSearch {
  planId?: string;
  operatorId?: string;
  operatorLabel?: string;
  zoomStart?: number;
  zoomEnd?: number;
  hideTasks?: boolean;
  treeState?: string;
}

/**
 * Syncs a fixed set of scalar UI atoms with the URL search params for the query index route.
 *
 * On mount: seeds atoms from URL values (via useHydrateAtoms) so deep links restore state.
 * On change: writes updated atom values back to the URL using replace navigation so the
 * browser history stack is not polluted on every zoom gesture or plan selection.
 */
export function useUrlStateSync(search: QueryIndexSearch) {
  const decodedState = search.treeState ? decodeTreeState(search.treeState) : null;
  useHydrateAtoms([
    [selectedPlanIdAtom, decodedState?.planId ?? search.planId ?? ''],
    [
      selectedNodeIdsAtom,
      decodedState?.operatorId
        ? new Set([decodedState.operatorId])
        : search.operatorId
          ? new Set([search.operatorId])
          : new Set<string>(),
    ],
    [selectedOperatorLabelAtom, decodedState?.operatorLabel ?? search.operatorLabel ?? null],
    [hideTasksAtom, decodedState?.hideTasks ?? search.hideTasks ?? false],
    [selectedColorField, decodedState?.dagColorField ?? null],
    [selectedEdgeWidthFieldAtom, decodedState?.dagEdgeWidthField ?? null],
    [selectedEdgeColorFieldAtom, decodedState?.dagEdgeColorField ?? null],
    [selectedNodeLabelFieldAtom, decodedState?.dagNodeLabelField ?? NODE_LABEL_FIELD.NAME],
    [nodeColorPaletteAtom, decodedState?.dagNodePalette ?? 'blue'],
    [edgeColorPaletteAtom, decodedState?.dagEdgePalette ?? 'teal'],
    [selectedTypesAtom, new Map(Object.entries(decodedState?.selectedTypes ?? {}))],
    [selectedFsmTypesAtom, new Map(Object.entries(decodedState?.selectedFsmTypes ?? {}))],
    [expandedIdsAtom, new Set(decodedState?.expandedIds ?? [])],
  ]);

  const planId = useAtomValue(selectedPlanIdAtom);
  const selectedNodeIds = useAtomValue(selectedNodeIdsAtom);
  const operatorLabel = useAtomValue(selectedOperatorLabelAtom);
  const zoomRange = useAtomValue(debouncedZoomRangeAtom);
  const hideTasks = useAtomValue(hideTasksAtom);
  const selectedTypes = useAtomValue(selectedTypesAtom);
  const selectedFsmTypes = useAtomValue(selectedFsmTypesAtom);
  const expandedIds = useAtomValue(expandedIdsAtom);
  const dagColorField = useAtomValue(selectedColorField);
  const dagEdgeWidthField = useAtomValue(selectedEdgeWidthFieldAtom);
  const dagEdgeColorField = useAtomValue(selectedEdgeColorFieldAtom);
  const dagNodeLabelField = useAtomValue(selectedNodeLabelFieldAtom);
  const dagNodePalette = useAtomValue(nodeColorPaletteAtom);
  const dagEdgePalette = useAtomValue(edgeColorPaletteAtom);

  const operatorId = selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : undefined;

  // Scoping navigate to this route gives TanStack Router the search type context it needs
  // to type-check the search updater function correctly.
  const navigate = useNavigate({ from: '/profile/engine/$engineId/query/$queryId' });
  const { pathname } = useLocation();

  useEffect(() => {
    // zoomRange stays at { start: 0, end: 0 } until QueryResourceTree's useHydrateAtoms
    // runs during its render. Skip URL writes until zoom is properly initialized.
    if (zoomRange.end === 0) return;

    const encoded = encodeTreeState({
      expandedIds,
      selectedTypes,
      selectedFsmTypes,
      planId: planId || undefined,
      operatorId,
      operatorLabel: operatorLabel ?? null,
      zoomStart: zoomRange.start,
      zoomEnd: zoomRange.end,
      hideTasks,
      dagColorField,
      dagEdgeWidthField,
      dagEdgeColorField,
      dagNodeLabelField,
      dagNodePalette,
      dagEdgePalette,
    });

    void navigate({
      to: pathname,
      search: prev => ({
        ...prev,
        planId: undefined,
        operatorId: undefined,
        operatorLabel: undefined,
        zoomStart: undefined,
        zoomEnd: undefined,
        hideTasks: undefined,
        treeState: encoded,
      }),
      replace: true,
    });
  }, [
    expandedIds,
    selectedTypes,
    selectedFsmTypes,
    planId,
    operatorId,
    operatorLabel,
    zoomRange.start,
    zoomRange.end,
    hideTasks,
    dagColorField,
    dagEdgeWidthField,
    dagEdgeColorField,
    dagNodeLabelField,
    dagNodePalette,
    dagEdgePalette,
    pathname,
    navigate,
  ]);
}

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
import {
  decodeDagState,
  decodeLegacyCombinedTreeState,
  decodeOperatorsState,
  decodeTreeState,
  encodeDagState,
  encodeOperatorsState,
  encodeTreeState,
} from '@/lib/treeStateParam';
import { safeRun } from '@/lib/safeUrlState';
import {
  OPERATOR_TABLE_PERSIST_KEY,
  aggModeAtomFamily,
  enabledIndicesAtomFamily,
  indexOrderAtomFamily,
  selectedStatsAtomFamily,
  sortingAtomFamily,
  statOrderAtomFamily,
} from '@/atoms/statGroupTable';

export interface QueryIndexSearch {
  planId?: string;
  operatorId?: string;
  operatorLabel?: string;
  zoomStart?: number;
  zoomEnd?: number;
  hideTasks?: boolean;
  treeState?: string;
  dagState?: string;
  operatorsState?: string;
}

/**
 * Syncs a fixed set of scalar UI atoms with the URL search params for the query index route.
 *
 * On mount: seeds atoms from URL values (via useHydrateAtoms) so deep links restore state.
 * On change: writes updated atom values back to the URL using replace navigation so the
 * browser history stack is not polluted on every zoom gesture or plan selection.
 */
export function useUrlStateSync(search: QueryIndexSearch) {
  const decodedTreeState = search.treeState ? decodeTreeState(search.treeState) : null;
  const decodedDagState = search.dagState ? decodeDagState(search.dagState) : null;
  const legacyCombinedState =
    !decodedDagState && search.treeState ? decodeLegacyCombinedTreeState(search.treeState) : null;
  const decodedOperatorsState = search.operatorsState
    ? decodeOperatorsState(search.operatorsState)
    : null;

  // A non-empty URL param that failed to decode (and where no fallback decoder
  // succeeded) is "bad" — we strip it from the URL on the next write so users
  // don't stay stuck on a poisoned link.
  const hadBadTreeState =
    !!search.treeState && decodedTreeState === null && legacyCombinedState === null;
  const hadBadDagState =
    !!search.dagState && decodedDagState === null && legacyCombinedState === null;
  const hadBadOperatorsState = !!search.operatorsState && decodedOperatorsState === null;

  // Build hydration values inside guards so a malformed payload (e.g. a
  // non-iterable `expandedIds`) cannot throw out of the hook.
  const hydratedPlanId =
    decodedDagState?.planId ?? legacyCombinedState?.planId ?? search.planId ?? '';
  const hydratedNodeIds = safeRun(
    'hydrate-selectedNodeIds',
    () => {
      const id =
        decodedDagState?.operatorId ?? legacyCombinedState?.operatorId ?? search.operatorId;
      return id ? new Set([id]) : new Set<string>();
    },
    new Set<string>()
  );
  const hydratedOperatorLabel =
    decodedDagState?.operatorLabel ??
    legacyCombinedState?.operatorLabel ??
    search.operatorLabel ??
    null;
  const hydratedHideTasks = decodedTreeState?.hideTasks ?? search.hideTasks ?? false;
  const hydratedColorField =
    decodedDagState?.dagColorField ?? legacyCombinedState?.dagColorField ?? null;
  const hydratedEdgeWidthField =
    decodedDagState?.dagEdgeWidthField ?? legacyCombinedState?.dagEdgeWidthField ?? null;
  const hydratedEdgeColorField =
    decodedDagState?.dagEdgeColorField ?? legacyCombinedState?.dagEdgeColorField ?? null;
  const hydratedNodeLabelField =
    decodedDagState?.dagNodeLabelField ??
    legacyCombinedState?.dagNodeLabelField ??
    NODE_LABEL_FIELD.NAME;
  const hydratedNodePalette =
    decodedDagState?.dagNodePalette ?? legacyCombinedState?.dagNodePalette ?? 'blue';
  const hydratedEdgePalette =
    decodedDagState?.dagEdgePalette ?? legacyCombinedState?.dagEdgePalette ?? 'teal';
  const hydratedSelectedTypes = safeRun(
    'hydrate-selectedTypes',
    () => new Map(Object.entries(decodedTreeState?.selectedTypes ?? {})),
    new Map<string, string>()
  );
  const hydratedSelectedFsmTypes = safeRun(
    'hydrate-selectedFsmTypes',
    () => new Map(Object.entries(decodedTreeState?.selectedFsmTypes ?? {})),
    new Map<string, string | null>()
  );
  const hydratedExpandedIds = safeRun(
    'hydrate-expandedIds',
    () => new Set(decodedTreeState?.expandedIds ?? []),
    new Set<string>()
  );
  const hydratedIndexOrder = decodedOperatorsState?.indexOrder ?? null;
  const hydratedEnabledIndices = decodedOperatorsState?.enabledIndices ?? null;
  const hydratedSelectedStats = safeRun(
    'hydrate-selectedStats',
    () =>
      decodedOperatorsState?.selectedStats != null
        ? new Set(decodedOperatorsState.selectedStats)
        : null,
    null as Set<string> | null
  );
  const hydratedStatOrder = decodedOperatorsState?.statOrder ?? null;
  const hydratedAggMode = decodedOperatorsState?.aggMode ?? null;
  const hydratedSorting = decodedOperatorsState?.sorting ?? null;

  useHydrateAtoms([
    [selectedPlanIdAtom, hydratedPlanId],
    [selectedNodeIdsAtom, hydratedNodeIds],
    [selectedOperatorLabelAtom, hydratedOperatorLabel],
    [hideTasksAtom, hydratedHideTasks],
    [selectedColorField, hydratedColorField],
    [selectedEdgeWidthFieldAtom, hydratedEdgeWidthField],
    [selectedEdgeColorFieldAtom, hydratedEdgeColorField],
    [selectedNodeLabelFieldAtom, hydratedNodeLabelField],
    [nodeColorPaletteAtom, hydratedNodePalette],
    [edgeColorPaletteAtom, hydratedEdgePalette],
    [selectedTypesAtom, hydratedSelectedTypes],
    [selectedFsmTypesAtom, hydratedSelectedFsmTypes],
    [expandedIdsAtom, hydratedExpandedIds],
    [indexOrderAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedIndexOrder],
    [enabledIndicesAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedEnabledIndices],
    [selectedStatsAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedSelectedStats],
    [statOrderAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedStatOrder],
    [aggModeAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedAggMode],
    [sortingAtomFamily(OPERATOR_TABLE_PERSIST_KEY), hydratedSorting],
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
  const operatorIndexOrder = useAtomValue(indexOrderAtomFamily(OPERATOR_TABLE_PERSIST_KEY));
  const operatorEnabledIndices = useAtomValue(enabledIndicesAtomFamily(OPERATOR_TABLE_PERSIST_KEY));
  const operatorSelectedStats = useAtomValue(selectedStatsAtomFamily(OPERATOR_TABLE_PERSIST_KEY));
  const operatorStatOrder = useAtomValue(statOrderAtomFamily(OPERATOR_TABLE_PERSIST_KEY));
  const operatorAggMode = useAtomValue(aggModeAtomFamily(OPERATOR_TABLE_PERSIST_KEY));
  const operatorSorting = useAtomValue(sortingAtomFamily(OPERATOR_TABLE_PERSIST_KEY));

  const operatorId = selectedNodeIds.size > 0 ? [...selectedNodeIds][0] : undefined;

  // Scoping navigate to this route gives TanStack Router the search type context it needs
  // to type-check the search updater function correctly.
  const navigate = useNavigate({ from: '/profile/engine/$engineId/query/$queryId' });
  const { pathname } = useLocation();

  useEffect(() => {
    safeRun(
      'write-effect',
      () => {
        const isTimelineRoute = pathname.endsWith('/timeline');
        const isOperatorsRoute = pathname.endsWith('/operators');

        // zoomRange stays at { start: 0, end: 0 } until QueryResourceTree's useHydrateAtoms
        // runs during its render. Skip timeline writes until zoom is properly initialized.
        if (isTimelineRoute && zoomRange.end === 0) return;

        const encodedDagState = encodeDagState({
          planId: planId || undefined,
          operatorId,
          operatorLabel: operatorLabel ?? null,
          dagColorField,
          dagEdgeWidthField,
          dagEdgeColorField,
          dagNodeLabelField,
          dagNodePalette,
          dagEdgePalette,
        });

        const encodedTreeState = encodeTreeState({
          expandedIds,
          selectedTypes,
          selectedFsmTypes,
          zoomStart: zoomRange.start,
          zoomEnd: zoomRange.end,
          hideTasks,
        });

        const encodedOperatorsState = encodeOperatorsState({
          indexOrder: operatorIndexOrder ?? undefined,
          enabledIndices: operatorEnabledIndices ?? undefined,
          selectedStats: operatorSelectedStats ? [...operatorSelectedStats] : operatorSelectedStats,
          statOrder: operatorStatOrder ?? undefined,
          aggMode: operatorAggMode ?? undefined,
          sorting: operatorSorting ?? undefined,
        });

        // Empty string from a failed encode -> drop the param entirely. A bad
        // incoming param is also force-cleared so a corrupted link self-heals.
        const dagParam = hadBadDagState ? undefined : encodedDagState || undefined;
        const treeParam = isTimelineRoute
          ? hadBadTreeState
            ? undefined
            : encodedTreeState || undefined
          : undefined;
        const opsParam = isOperatorsRoute
          ? hadBadOperatorsState
            ? undefined
            : encodedOperatorsState || undefined
          : undefined;

        safeRun(
          'navigate',
          () => {
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
                dagState: dagParam,
                treeState: treeParam,
                operatorsState: opsParam,
              }),
              replace: true,
            });
          },
          undefined
        );
      },
      undefined
    );
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
    operatorIndexOrder,
    operatorEnabledIndices,
    operatorSelectedStats,
    operatorStatOrder,
    operatorAggMode,
    operatorSorting,
    pathname,
    navigate,
    hadBadTreeState,
    hadBadDagState,
    hadBadOperatorsState,
  ]);
}

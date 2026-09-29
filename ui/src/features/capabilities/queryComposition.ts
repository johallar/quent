// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, type FeatureRegistry } from '@quent/features';

const QUERY_TABS = [
  {
    id: 'timeline',
    label: 'Timeline',
    to: '/profile/engine/$engineId/query/$queryId/timeline',
  },
  {
    id: 'operators',
    label: 'Operators',
    to: '/profile/engine/$engineId/query/$queryId/operators',
  },
  {
    id: 'entities',
    label: 'Entities',
    to: '/profile/engine/$engineId/query/$queryId/entities',
  },
] as const;

export interface QueryComposition {
  readonly showQueryPlan: boolean;
  readonly showOperatorGantt: boolean;
  readonly showDataFlow: boolean;
  readonly showNvtx: boolean;
  readonly tabs: readonly (typeof QUERY_TABS)[number][];
}

export type QueryTabId = (typeof QUERY_TABS)[number]['id'];

export function resolveQueryComposition(features: FeatureRegistry): QueryComposition {
  const showQueryPlan = features.has(FEATURE_IDS.queryPlan);
  const showTimeline = features.has(FEATURE_IDS.queryEngineResource);
  const showEntities = features.has(FEATURE_IDS.fsm);
  return {
    showQueryPlan,
    showOperatorGantt: showQueryPlan && showTimeline,
    showDataFlow: showQueryPlan && features.has(FEATURE_IDS.queryEngineDataFlow),
    showNvtx: showTimeline && features.has(FEATURE_IDS.nvtx),
    tabs: QUERY_TABS.filter(tab => {
      if (tab.id === 'timeline') {
        return showTimeline;
      }
      if (tab.id === 'operators') {
        return showQueryPlan;
      }
      return showEntities;
    }),
  };
}

export function resolveAvailableQueryTab(
  composition: QueryComposition,
  requestedTab: QueryTabId
): QueryTabId | null {
  return composition.tabs.some(tab => tab.id === requestedTab)
    ? requestedTab
    : (composition.tabs[0]?.id ?? null);
}

export function queryTabRoute(tab: QueryTabId): (typeof QUERY_TABS)[number]['to'] {
  return QUERY_TABS.find(candidate => candidate.id === tab)!.to;
}

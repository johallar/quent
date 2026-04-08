// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAtomValue, useStore } from 'jotai';
import { fetchBulkTimelines, DEFAULT_STALE_TIME } from '@/services/api';
import type { QueryEntities } from '~quent/types/QueryEntities';
import type { TimelineRequest } from '~quent/types/TimelineRequest';
import type { TaskFilter } from '~quent/types/TaskFilter';
import type { ZoomRange } from '@/components/timeline/TimelineController';
import { TreeTableItem } from '@/components/resource-tree/types';
import {
  findItemById,
  buildBulkParamsForItem,
  collectVisibleEntries,
  getAdaptiveNumBins,
  getResourceTypeName,
  getFsmTypeName,
} from '@/lib/timeline.utils';
import {
  timelineCacheKey,
  timelineDataAtom,
  zoomRangeAtom,
  debouncedZoomRangeAtom,
  bulkInitializedAtom,
  visibleEntriesAtom,
} from '@/atoms/timeline';
import { selectedNodeIdsAtom } from '@/atoms/dag';
import {
  useBulkTimelineFetch,
  buildMergedBulkEntries,
  applyBulkTimelineResponse,
} from './useBulkTimelineFetch';

const ZOOM_DEBOUNCE_MS = 150;
const TIMELINE_DEBUG_KEY = 'quent:timeline-debug';

function isTimelineDebugEnabled(): boolean {
  return true;
  // if (!import.meta.env.DEV || typeof window === 'undefined') return false;
  // return window.localStorage.getItem(TIMELINE_DEBUG_KEY) === '1';
}

// useBulkTimelines — manages bulk fetching via Jotai atoms + TanStack Query
export function useBulkTimelines({
  engineId,
  queryId,
  rootItem,
  expandedIds,
  selectedTypes,
  groupFsmFilters,
  entities,
}: {
  engineId: string;
  queryId: string;
  rootItem: TreeTableItem;
  expandedIds: Set<string>;
  selectedTypes: Map<string, string>;
  groupFsmFilters?: Map<string, string | null>;
  entities: QueryEntities;
}) {
  const store = useStore();
  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const selectedNodeIds = useAtomValue(selectedNodeIdsAtom);
  const operatorId = selectedNodeIds.size > 0 ? selectedNodeIds.values().next().value! : null;

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  // Reset the bulk-initialized flag whenever the query changes so that stale state from a
  // previous query never causes individual ResourceTimeline components to fire /single
  // requests before this query's bulk fetch has completed.
  useEffect(() => {
    store.set(bulkInitializedAtom, false);
    return () => {
      store.set(bulkInitializedAtom, false);
    };
  }, [queryId, store]);

  const debouncedZoomRange = useAtomValue(debouncedZoomRangeAtom);
  const bulkConfig = useMemo(
    () => ({
      num_bins: getAdaptiveNumBins(),
      start: debouncedZoomRange.start,
      end: debouncedZoomRange.end,
    }),
    [debouncedZoomRange]
  );

  const baseVisibleEntries = useMemo(
    () =>
      collectVisibleEntries(
        [rootItem],
        expandedIds,
        selectedTypes,
        entities,
        bulkConfig,
        groupFsmFilters
      ),
    [rootItem, expandedIds, selectedTypes, entities, bulkConfig, groupFsmFilters]
  );
  useEffect(() => {
    store.set(visibleEntriesAtom, baseVisibleEntries);
  }, [baseVisibleEntries, store]);

  const bulkQuery = useBulkTimelineFetch({
    engineId,
    queryId,
    debouncedZoomRange,
    entries: baseVisibleEntries,
    operatorId,
  });
  const debugEnabled = isTimelineDebugEnabled();

  useEffect(() => {
    if (!debugEnabled) return;
    console.warn('[timeline/bulk-reset]', {
      queryId,
      operatorId,
      visibleEntryCount: Object.keys(baseVisibleEntries).length,
    });
  }, [debugEnabled, queryId, operatorId, baseVisibleEntries]);

  useEffect(() => {
    if (!debugEnabled) return;
    console.warn('[timeline/bulk-query]', {
      queryId,
      operatorId,
      status: bulkQuery.status,
      fetchStatus: bulkQuery.fetchStatus,
      isFetching: bulkQuery.isFetching,
      isFetched: bulkQuery.isFetched,
      hasData: Boolean(bulkQuery.data),
      visibleEntryCount: Object.keys(baseVisibleEntries).length,
    });
  }, [
    debugEnabled,
    queryId,
    operatorId,
    bulkQuery.status,
    bulkQuery.fetchStatus,
    bulkQuery.isFetching,
    bulkQuery.isFetched,
    bulkQuery.data,
    baseVisibleEntries,
  ]);

  useEffect(() => {
    // Mark initialization complete only after this query's bulk request has settled.
    // This avoids reusing stale placeholder data from a previous query, which can
    // prematurely unlock /single fallback requests for every visible timeline row.
    if (bulkQuery.isFetched) {
      store.set(bulkInitializedAtom, true);
      if (debugEnabled) {
        console.warn('[timeline/bulk-initialized]', {
          queryId,
          operatorId,
          hasData: Boolean(bulkQuery.data),
          visibleEntryCount: Object.keys(baseVisibleEntries).length,
        });
      }
    }
  }, [
    bulkQuery.isFetched,
    bulkQuery.data,
    store,
    debugEnabled,
    queryId,
    operatorId,
    baseVisibleEntries,
  ]);

  // Zoom change handler — stable, uses store imperatively
  const handleZoomChange = useCallback(
    (range: ZoomRange) => {
      store.set(zoomRangeAtom, range);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        store.set(debouncedZoomRangeAtom, range);
        debounceTimerRef.current = null;
      }, ZOOM_DEBOUNCE_MS);
    },
    [store]
  );

  // Expand handler — fetches base + operator data for newly expanded children
  const handleExpand = useCallback(
    async (itemId: string, isExpanded: boolean) => {
      if (!isExpanded) return;

      const item = findItemById(rootItem, itemId);
      if (!item?.children) return;

      const zoom = store.get(debouncedZoomRangeAtom);
      const expandConfig = {
        num_bins: getAdaptiveNumBins(),
        start: zoom.start,
        end: zoom.end,
      };

      const newBaseEntries: Record<string, TimelineRequest<TaskFilter>> = {};
      for (const child of item.children) {
        const params = buildBulkParamsForItem(
          child,
          selectedTypes,
          entities,
          expandConfig,
          groupFsmFilters
        );
        const resourceTypeName = getResourceTypeName(params);
        const fsmTypeName = getFsmTypeName(params);
        const key = timelineCacheKey({ resourceId: child.id, resourceTypeName, fsmTypeName });
        if (!store.get(timelineDataAtom(key))) {
          newBaseEntries[child.id] = params;
        }
      }

      if (Object.keys(newBaseEntries).length === 0) return;

      const {
        entries: expandEntries,
        idToMeta: expandIdToMeta,
        requestKey: expandRequestKey,
      } = buildMergedBulkEntries(newBaseEntries, operatorId);

      try {
        const response = await queryClient.fetchQuery({
          queryKey: ['bulkTimelines', engineId, queryId, zoom, expandRequestKey],
          queryFn: () =>
            fetchBulkTimelines(engineId, {
              entries: expandEntries,
              app_params: { query_id: queryId },
            }),
          staleTime: DEFAULT_STALE_TIME,
        });

        applyBulkTimelineResponse(response, expandIdToMeta, store);
      } catch {
        // Individual ResourceTimeline components will fall back to self-fetch
      }
    },
    [
      rootItem,
      store,
      selectedTypes,
      groupFsmFilters,
      entities,
      queryClient,
      engineId,
      queryId,
      operatorId,
    ]
  );

  return { handleZoomChange, handleExpand } as const;
}

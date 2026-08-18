// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { useEntityList } from '@quent/client';
import {
  useBulkInitialized,
  useDebouncedZoomRange,
  useLongEntityDensity,
  useReturnedTimelineNumBins,
  useSelectedNodeIds,
} from '@quent/hooks';
import { type FsmTypeDecl, MAX_TIMELINE_BINS } from '@quent/utils';
import {
  Button,
  LONG_ENTITIES_TIMELINE_HEIGHT,
  LongEntitiesGantt,
  Skeleton,
  buildLongEntityEntries,
  getLongEntitiesThreshold,
} from '@quent/components';

const ENTITIES_PER_PAGE = 100;

type LongEntitiesRowProps = {
  engineId: string;
  queryId: string;
  /** The resource this row's entities are scoped to. */
  resourceId: string;
  durationSeconds: number;
  fsmTypes: { [key in string]?: FsmTypeDecl };
  isDark: boolean;
  /** Defaults to all states; resource scope keeps states used on this row's resource. */
  fsmStateScope?: 'all' | 'resource';
};

/**
 * Per-resource long-entities Gantt. Fetches the resource's entities (ranked by
 * longest usage) as soon as the row is shown and renders them as a compact
 * stacked Gantt directly under the timeline.
 */
export function LongEntitiesRow({
  engineId,
  queryId,
  resourceId,
  durationSeconds,
  fsmTypes,
  isDark,
  fsmStateScope = 'resource',
}: LongEntitiesRowProps) {
  const selectedNodeIds = useSelectedNodeIds();
  const debouncedZoomRange = useDebouncedZoomRange();
  const bulkInitialized = useBulkInitialized();
  const longEntityDensity = useLongEntityDensity();
  const returnedNumBins = useReturnedTimelineNumBins(resourceId);
  const [maxEntities, setMaxEntities] = useState(ENTITIES_PER_PAGE);
  const operatorIds = useMemo(() => [...selectedNodeIds], [selectedNodeIds]);
  const zoomWindow =
    debouncedZoomRange.end > debouncedZoomRange.start
      ? debouncedZoomRange
      : { start: 0, end: durationSeconds };

  const numBins = returnedNumBins ?? (bulkInitialized ? MAX_TIMELINE_BINS * 2 : undefined);
  const minUsageSeconds =
    numBins == null
      ? null
      : getLongEntitiesThreshold(zoomWindow.end - zoomWindow.start, numBins, longEntityDensity);

  const { data, isFetching, isPlaceholderData } = useEntityList(
    {
      engineId,
      queryId,
      window: zoomWindow,
      operatorIds,
      minUsageSeconds,
      sortDir: 'Desc',
      maxItems: maxEntities,
      filter: { scope: { Resource: { resource_id: resourceId } } },
    },
    { enabled: numBins != null }
  );

  const entities = useMemo(() => data?.items ?? [], [data]);
  const entries = useMemo(
    () =>
      buildLongEntityEntries(
        entities,
        fsmTypes,
        isDark ? 'dark' : 'light',
        fsmStateScope === 'resource' ? new Set([resourceId]) : null
      ),
    [entities, fsmStateScope, fsmTypes, isDark, resourceId]
  );
  const totalEntities = data?.total ?? entities.length;
  const hasMoreEntities = entities.length < totalEntities;
  const isLoadingMore = isPlaceholderData && entities.length < maxEntities;
  const showMoreButton = hasMoreEntities && (!isLoadingMore || maxEntities < totalEntities);

  if (minUsageSeconds == null || (!data && isFetching)) {
    return (
      <div
        role="status"
        aria-label="Loading entities"
        className="flex flex-col justify-center gap-1.5 overflow-hidden px-2"
        style={{ height: LONG_ENTITIES_TIMELINE_HEIGHT }}
      >
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="ml-[18%] h-3 w-1/2" />
        <Skeleton className="ml-[55%] h-3 w-1/4" />
      </div>
    );
  }

  return (
    <div>
      <LongEntitiesGantt
        entries={entries}
        durationSeconds={durationSeconds}
        minUsageSeconds={minUsageSeconds}
        height={LONG_ENTITIES_TIMELINE_HEIGHT}
        isDark={isDark}
      />

      {showMoreButton && (
        <div className="flex justify-center border-t border-border/50 py-1">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-4 px-1 text-[10px]"
            disabled={isFetching}
            onClick={event => {
              event.stopPropagation();
              setMaxEntities(current => current + ENTITIES_PER_PAGE);
            }}
          >
            {isLoadingMore ? 'Loading...' : `Show more (${entities.length} of ${totalEntities})`}
          </Button>
        </div>
      )}
    </div>
  );
}

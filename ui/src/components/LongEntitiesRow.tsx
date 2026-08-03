// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useEntityList } from '@quent/client';
import { useDebouncedZoomRange, useSelectedNodeIds } from '@quent/hooks';
import type { FsmTypeDecl } from '@quent/utils';
import {
  LONG_ENTITIES_TIMELINE_HEIGHT,
  LongEntitiesGantt,
  buildLongEntityEntries,
  getLongEntitiesThreshold,
} from '@quent/components';

/** Max entities fetched per resource; longest-usage-first, so this keeps the top N. */
const MAX_ENTITIES = 200;

type LongEntitiesRowProps = {
  engineId: string;
  queryId: string;
  /** The resource this row's entities are scoped to. */
  resourceId: string;
  durationSeconds: number;
  fsmTypes: { [key in string]?: FsmTypeDecl };
  isDark: boolean;
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
}: LongEntitiesRowProps) {
  const selectedNodeIds = useSelectedNodeIds();
  const debouncedZoomRange = useDebouncedZoomRange();
  const operatorIds = useMemo(() => [...selectedNodeIds], [selectedNodeIds]);
  const window =
    debouncedZoomRange.end > debouncedZoomRange.start
      ? debouncedZoomRange
      : { start: 0, end: durationSeconds };
  const minUsageSeconds = getLongEntitiesThreshold(window.end - window.start);

  const { data, isFetching } = useEntityList({
    engineId,
    queryId,
    window,
    operatorIds,
    minUsageSeconds,
    sortDir: 'Desc',
    maxItems: MAX_ENTITIES,
    filter: { scope: { Resource: { resource_id: resourceId } } },
  });

  const entries = useMemo(
    () => (data ? buildLongEntityEntries(data.items, fsmTypes, isDark ? 'dark' : 'light') : []),
    [data, fsmTypes, isDark]
  );

  if (!data && isFetching) {
    return (
      <div
        className="flex items-center px-2 text-sm text-muted-foreground"
        style={{ height: LONG_ENTITIES_TIMELINE_HEIGHT }}
      >
        Loading entities…
      </div>
    );
  }

  return (
    <LongEntitiesGantt
      entries={entries}
      durationSeconds={durationSeconds}
      height={LONG_ENTITIES_TIMELINE_HEIGHT}
      isDark={isDark}
    />
  );
}

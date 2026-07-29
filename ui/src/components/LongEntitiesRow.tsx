// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useEntityList } from '@quent/client';
import { useSelectedNodeIds } from '@quent/hooks';
import type { FsmTypeDecl } from '@quent/utils';
import {
  DEFAULT_TIMELINE_HEIGHT,
  LongEntitiesGantt,
  buildLongEntityEntries,
} from '@quent/components';

/** Max entities fetched per resource; longest-usage-first, so this keeps the top N. */
const MAX_ENTITIES = 200;
// Stress-test the Gantt with nearly every task.
const MIN_USAGE_SECONDS = 0.001;

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
  // The entity endpoint filters by a single operator; honor the DAG selection
  // only when exactly one operator is picked, otherwise show all.
  const operatorId = selectedNodeIds.size === 1 ? [...selectedNodeIds][0]! : null;

  const { data, isFetching } = useEntityList({
    engineId,
    queryId,
    window: { start: 0, end: durationSeconds },
    operatorId,
    minUsageSeconds: MIN_USAGE_SECONDS,
    sortDir: 'Desc',
    maxItems: MAX_ENTITIES,
    filter: { scope: { Resource: { resource_id: resourceId } } },
  });

  const entries = useMemo(
    () =>
      data ? buildLongEntityEntries(data.items, fsmTypes, isDark ? 'dark' : 'light') : [],
    [data, fsmTypes, isDark]
  );

  if (!data && isFetching) {
    return (
      <div
        className="flex items-center px-2 text-sm text-muted-foreground"
        style={{ height: DEFAULT_TIMELINE_HEIGHT }}
      >
        Loading long entities…
      </div>
    );
  }

  return (
    <LongEntitiesGantt
      entries={entries}
      durationSeconds={durationSeconds}
      height={DEFAULT_TIMELINE_HEIGHT}
      isDark={isDark}
    />
  );
}

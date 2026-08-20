// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  LONG_ENTITIES_ROW_TYPE,
  longEntitiesRowId,
  resourceIdFromLongEntitiesRowId,
  type TreeTableItem,
} from '@quent/components';
import {
  EntityTypeKey,
  type EntityRef,
  type FiniteStateMachine,
  type QueryBundle,
} from '@quent/utils';
import { LongEntitiesRow } from '@/components/LongEntitiesRow';
import type { ResourceTimelineSubRow } from '@/components/ResourceTimelinesTree';

interface LongEntitiesTimelineSubRowOptions {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
  isDark: boolean;
  onEntitySelect?: (fsm: FiniteStateMachine) => void;
  selectedEntityId?: string;
  onBackgroundClick?: () => void;
}

function createLongEntitiesRow(resourceId: string): TreeTableItem {
  return {
    id: longEntitiesRowId(resourceId),
    type: LONG_ENTITIES_ROW_TYPE,
    entity: {} as TreeTableItem['entity'],
  };
}

function injectLongEntitiesRows(item: TreeTableItem): TreeTableItem {
  if (!item.children?.length) return { ...item };
  const children: TreeTableItem[] = [];
  for (const child of item.children) {
    children.push(injectLongEntitiesRows(child));
    if (child.type === EntityTypeKey.Resource) {
      children.push(createLongEntitiesRow(child.id));
    }
  }
  return { ...item, children };
}

export function createLongEntitiesTimelineSubRow({
  engineId,
  queryBundle,
  isDark,
  onEntitySelect,
  selectedEntityId,
  onBackgroundClick,
}: LongEntitiesTimelineSubRowOptions): ResourceTimelineSubRow {
  return {
    id: 'long-entities',
    injectRows: injectLongEntitiesRows,
    matches: item => item.type === LONG_ENTITIES_ROW_TYPE,
    renderLabel: () => (
      <span className="flex items-center">
        <span aria-hidden className="mr-4 h-4 w-4 shrink-0" />
        <span className="text-xs leading-none text-muted-foreground">Entities</span>
      </span>
    ),
    renderTimeline: item => {
      const resourceId = resourceIdFromLongEntitiesRowId(item.id);
      if (resourceId == null) return null;
      return (
        <LongEntitiesRow
          engineId={engineId}
          queryId={queryBundle.query_id}
          resourceId={resourceId}
          durationSeconds={queryBundle.duration_s}
          fsmTypes={queryBundle.entities.fsm_types}
          isDark={isDark}
          onEntitySelect={onEntitySelect}
          selectedEntityId={selectedEntityId}
          onBackgroundClick={onBackgroundClick}
        />
      );
    },
  };
}

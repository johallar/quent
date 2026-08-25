// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  DEFAULT_TIMELINE_HEIGHT,
  OPERATOR_TIMELINE_ROW_TYPE,
  OperatorGanttChart,
  getWorkerIdsFromPlanTree,
  operatorTimelineRowId,
  operatorsWithActiveSpansForWorker,
  workerIdFromOperatorTimelineRowId,
  type TreeTableItem,
} from '@quent/components';
import type { EntityRef, QueryBundle } from '@quent/utils';
import type { ResourceTimelineSubRow } from './ResourceTimelinesTree';

interface OperatorGanttTimelineSubRowOptions {
  queryBundle: QueryBundle<EntityRef>;
  isDark: boolean;
}

function createOperatorTimelineRow(workerId: string): TreeTableItem {
  return {
    id: operatorTimelineRowId(workerId),
    type: OPERATOR_TIMELINE_ROW_TYPE,
    entity: {} as TreeTableItem['entity'],
  };
}

function injectOperatorTimelineRows(item: TreeTableItem, workerIds: Set<string>): TreeTableItem {
  const transformedChildren = item.children?.map(child =>
    injectOperatorTimelineRows(child, workerIds)
  );
  if (!workerIds.has(item.id)) {
    return transformedChildren?.length ? { ...item, children: transformedChildren } : { ...item };
  }
  return {
    ...item,
    children: [createOperatorTimelineRow(item.id), ...(transformedChildren ?? [])],
  };
}

export function createOperatorGanttTimelineSubRow({
  queryBundle,
  isDark,
}: OperatorGanttTimelineSubRowOptions): ResourceTimelineSubRow {
  const workerIds = new Set(getWorkerIdsFromPlanTree(queryBundle.plan_tree));
  const entriesByWorker = new Map<string, ReturnType<typeof operatorsWithActiveSpansForWorker>>();
  for (const workerId of workerIds) {
    entriesByWorker.set(workerId, operatorsWithActiveSpansForWorker(queryBundle, workerId));
  }

  return {
    id: 'operator-gantt',
    injectRows: rootItem => injectOperatorTimelineRows(rootItem, workerIds),
    matches: item => item.type === OPERATOR_TIMELINE_ROW_TYPE,
    renderLabel: () => (
      <span className="flex items-center">
        <span aria-hidden className="mr-4 h-4 w-4 shrink-0" />
        <span className="text-xs leading-none text-muted-foreground">Operators</span>
      </span>
    ),
    renderTimeline: item => {
      const workerId = workerIdFromOperatorTimelineRowId(item.id);
      const operators = workerId != null ? (entriesByWorker.get(workerId) ?? []) : [];
      return (
        <OperatorGanttChart
          operators={operators}
          durationSeconds={queryBundle.duration_s}
          height={DEFAULT_TIMELINE_HEIGHT}
          isDark={isDark}
        />
      );
    },
  };
}

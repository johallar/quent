// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  LONG_ENTITIES_ROW_TYPE,
  OPERATOR_TIMELINE_ROW_TYPE,
  longEntitiesRowId,
  operatorTimelineRowId,
} from '@quent/components';
import type { TreeTableItem } from '@quent/components';
import { EntityTypeKey } from '@quent/utils';

export type ResourceChartType = 'operators' | 'entities';
export type ResourceChartAggregateState = 'all' | 'mixed' | 'none';

export const RESOURCE_CHART_ORDER: ResourceChartType[] = ['operators', 'entities'];

export function getEffectiveResourceCharts(
  selections: Map<string, ResourceChartType[]>,
  resourceId: string,
  workerIds: Set<string>
): ResourceChartType[] {
  const selected = selections.get(resourceId);
  if (selected) return selected;
  return workerIds.has(resourceId) ? ['operators'] : ['entities'];
}

export function collectResourceIds(item: TreeTableItem): string[] {
  const ids: string[] = [];

  function walk(node: TreeTableItem) {
    if (node.type === EntityTypeKey.Resource) ids.push(node.id);
    node.children?.forEach(walk);
  }

  walk(item);
  return ids;
}

export function collectItemIds(item: TreeTableItem): string[] {
  const ids: string[] = [];

  function walk(node: TreeTableItem) {
    ids.push(node.id);
    node.children?.forEach(walk);
  }

  walk(item);
  return ids;
}

function createChartRow(
  resourceId: string,
  chart: ResourceChartType,
  isExpanded: boolean
): TreeTableItem {
  return {
    id: chart === 'operators' ? operatorTimelineRowId(resourceId) : longEntitiesRowId(resourceId),
    type: chart === 'operators' ? OPERATOR_TIMELINE_ROW_TYPE : LONG_ENTITIES_ROW_TYPE,
    entity: {} as TreeTableItem['entity'],
    rowMinHeight: 0,
    estimatedRowHeight: 0,
    isChartExpanded: isExpanded,
  };
}

export function injectResourceChartRows(
  item: TreeTableItem,
  selections: Map<string, ResourceChartType[]>,
  workerIds: Set<string>,
  expandedSelections = selections
): TreeTableItem {
  const children: TreeTableItem[] = [];
  const selected = getEffectiveResourceCharts(selections, item.id, workerIds);
  const expanded = getEffectiveResourceCharts(expandedSelections, item.id, workerIds);

  if (
    item.type !== EntityTypeKey.Resource &&
    workerIds.has(item.id) &&
    selected.includes('operators')
  ) {
    children.push(createChartRow(item.id, 'operators', expanded.includes('operators')));
  }

  for (const child of item.children ?? []) {
    children.push(injectResourceChartRows(child, selections, workerIds, expandedSelections));
    if (child.type !== EntityTypeKey.Resource) continue;

    const childSelection = getEffectiveResourceCharts(selections, child.id, workerIds);
    const childExpandedSelection = getEffectiveResourceCharts(
      expandedSelections,
      child.id,
      workerIds
    );
    for (const chart of RESOURCE_CHART_ORDER) {
      if (childSelection.includes(chart) && (chart !== 'operators' || workerIds.has(child.id))) {
        children.push(createChartRow(child.id, chart, childExpandedSelection.includes(chart)));
      }
    }
  }

  return children.length > 0 ? { ...item, children } : { ...item };
}

export function getResourceChartAggregateState(
  chart: ResourceChartType,
  resourceIds: string[],
  selections: Map<string, ResourceChartType[]>,
  workerIds: Set<string>
): ResourceChartAggregateState {
  const selectedCount = resourceIds.filter(resourceId =>
    getEffectiveResourceCharts(selections, resourceId, workerIds).includes(chart)
  ).length;

  if (selectedCount === 0) return 'none';
  if (selectedCount === resourceIds.length) return 'all';
  return 'mixed';
}

export function setChartForResources(
  selections: Map<string, ResourceChartType[]>,
  resourceIds: string[],
  workerIds: Set<string>,
  chart: ResourceChartType,
  selected: boolean
): Map<string, ResourceChartType[]> {
  const next = new Map(selections);

  for (const resourceId of resourceIds) {
    const current = new Set(getEffectiveResourceCharts(selections, resourceId, workerIds));
    if (selected) current.add(chart);
    else current.delete(chart);
    next.set(
      resourceId,
      RESOURCE_CHART_ORDER.filter(candidate => current.has(candidate))
    );
  }

  return next;
}

export function setAllResourceCharts(
  resourceIds: string[],
  workerIds: Set<string>,
  selected: boolean
): Map<string, ResourceChartType[]> {
  return new Map(
    resourceIds.map(resourceId => [
      resourceId,
      selected
        ? RESOURCE_CHART_ORDER.filter(chart => chart !== 'operators' || workerIds.has(resourceId))
        : [],
    ])
  );
}

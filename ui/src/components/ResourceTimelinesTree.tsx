// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
import { fetchSingleTimeline, DEFAULT_STALE_TIME } from '@quent/client';
import {
  DEFAULT_TIMELINE_HEIGHT,
  LONG_ENTITIES_ROW_TYPE,
  OPERATOR_TIMELINE_ROW_TYPE,
  OperatorGanttChart,
  ResourceColumn,
  UsageColumn,
  buildBulkParamsForItem,
  collectResourceTypesFromTree,
  collectVisibleEntries,
  findItemById,
  getAdaptiveNumBins,
  getWorkerIdsFromPlanTree,
  longEntitiesRowId,
  operatorTimelineRowId,
  operatorsWithActiveSpansForWorker,
  resourceIdFromLongEntitiesRowId,
  transformResourceTree,
  workerIdFromOperatorTimelineRowId,
  type TreeTableItem,
} from '@quent/components';
import { useBulkTimelines, useHighlightedItemIds } from '@quent/hooks';
import {
  EntityTypeKey,
  type EntityRef,
  type EntityRefKey,
  type OperatorFilter,
  type QueryBundle,
  type QueryFilter,
  type ResourceTree,
  type SingleTimelineRequest,
} from '@quent/utils';
import {
  rootResourceTypeAtom,
  selectedFsmTypesAtom,
  selectedTypesAtom,
} from '@/atoms/resourceTree';
import { useExpandedIds } from '@/hooks/useExpandedIds';
import { LongEntitiesRow } from '@/components/LongEntitiesRow';
import {
  TimelineTreeTable,
  useTimelineTreeSetup,
  type TimelineTreeControls,
  type TimelineTreeModel,
} from '@/components/TimelineTreeTable';

function getRootResourceGroupId(resourceTree: ResourceTree<EntityRef>): string | null {
  if (!('ResourceGroup' in resourceTree)) return null;
  const [, entityId] = Object.entries(resourceTree.ResourceGroup.id)[0] as [EntityRefKey, string];
  return entityId;
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

function GanttRowLabel({ children }: { children: string }) {
  return (
    <span className="flex items-center">
      <span aria-hidden className="mr-4 h-4 w-4 shrink-0" />
      <span className="text-xs leading-none text-muted-foreground">{children}</span>
    </span>
  );
}

export interface ResourceTimelinesTreeModel extends TimelineTreeModel, TimelineTreeControls {
  rootItem: TreeTableItem;
}

interface ResourceTimelinesTreeProps {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
}

interface UseResourceTimelinesTreeModelProps extends ResourceTimelinesTreeProps {
  isDark: boolean;
}

// QueryResourceTree reuses the model to combine multiple trees in one table.
// eslint-disable-next-line react-refresh/only-export-components
export function useResourceTimelinesTreeModel({
  engineId,
  queryBundle,
  isDark,
}: UseResourceTimelinesTreeModelProps): ResourceTimelinesTreeModel {
  const { entities, resource_tree: resourceTree } = queryBundle;
  const durationSeconds = queryBundle.duration_s;
  const [selectedTypes, setSelectedTypes] = useAtom(selectedTypesAtom);
  const [selectedFsmTypes, setSelectedFsmTypes] = useAtom(selectedFsmTypesAtom);
  const [rootResourceType, setRootResourceType] = useAtom(rootResourceTypeAtom);

  const rootItem = useMemo(
    () => transformResourceTree(entities, resourceTree),
    [resourceTree, entities]
  );
  const highlightedItemIds = useHighlightedItemIds(rootItem);
  const resourceTypeOptions = useMemo(() => collectResourceTypesFromTree([rootItem]), [rootItem]);

  useEffect(() => {
    if (rootResourceType != null) return;
    const initial = resourceTypeOptions[0];
    if (initial) setRootResourceType(initial);
  }, [rootResourceType, resourceTypeOptions, setRootResourceType]);

  const { expandedIds, handleExpandChange } = useExpandedIds(rootItem.id);
  const { handleZoomChange, handleExpand } = useBulkTimelines({
    engineId,
    queryId: queryBundle.query_id,
    rootItem,
    expandedIds,
    selectedTypes,
    groupFsmFilters: selectedFsmTypes,
    entities,
    collectVisibleEntriesFn: collectVisibleEntries,
    buildBulkParamsFn: buildBulkParamsForItem,
    findItemByIdFn: findItemById,
  });

  const onExpandChange = useCallback(
    (itemId: string, isExpanded: boolean) => {
      handleExpandChange(itemId, isExpanded);
      handleExpand(itemId, isExpanded);
    },
    [handleExpandChange, handleExpand]
  );

  const rootResourceGroupId = useMemo(() => getRootResourceGroupId(resourceTree), [resourceTree]);
  const { data: fetchedRootTimeline } = useQuery({
    queryKey: [
      'resourceGroupTimeline',
      'root',
      engineId,
      queryBundle.query_id,
      rootResourceGroupId,
      durationSeconds,
      rootResourceType,
    ],
    queryFn: () => {
      const request: SingleTimelineRequest<QueryFilter, OperatorFilter> = {
        entry: {
          ResourceGroup: {
            resource_group_id: rootResourceGroupId!,
            resource_type_name: rootResourceType ?? '',
            long_entities_threshold_s: null,
            entity_filter: { entity_type_name: null },
            app_params: { operator_ids: [] },
            config: {
              num_bins: getAdaptiveNumBins(),
              start: 0,
              end: durationSeconds,
            },
          },
        },
        app_params: { query_id: queryBundle.query_id },
      };
      return fetchSingleTimeline(engineId, request, durationSeconds);
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: rootResourceGroupId != null && !!rootResourceType,
    placeholderData: keepPreviousData,
  });

  const workerIdsFromPlanTree = useMemo(
    () => new Set(getWorkerIdsFromPlanTree(queryBundle.plan_tree)),
    [queryBundle.plan_tree]
  );
  const tree = useMemo(
    () => injectLongEntitiesRows(injectOperatorTimelineRows(rootItem, workerIdsFromPlanTree)),
    [rootItem, workerIdsFromPlanTree]
  );
  const operatorEntriesByWorker = useMemo(() => {
    const entries = new Map<string, ReturnType<typeof operatorsWithActiveSpansForWorker>>();
    for (const workerId of workerIdsFromPlanTree) {
      entries.set(workerId, operatorsWithActiveSpansForWorker(queryBundle, workerId));
    }
    return entries;
  }, [queryBundle, workerIdsFromPlanTree]);

  const renderLabel = useCallback(
    (item: TreeTableItem) => {
      if (item.type === OPERATOR_TIMELINE_ROW_TYPE) {
        return <GanttRowLabel>Operators</GanttRowLabel>;
      }
      if (item.type === LONG_ENTITIES_ROW_TYPE) {
        return <GanttRowLabel>Entities</GanttRowLabel>;
      }

      const selectedType = selectedTypes.get(item.id) || item.availableResourceTypes?.[0] || '';
      const availableFsmTypes = selectedType
        ? entities.resource_types[selectedType]?.used_by
        : undefined;
      return (
        <ResourceColumn
          item={item}
          selectedType={selectedType}
          onTypeChange={(itemId, newType) => {
            setSelectedTypes(previous => new Map(previous).set(itemId, newType));
            if (itemId === rootItem.id) {
              setRootResourceType(newType);
            }
          }}
          availableFsmTypes={availableFsmTypes}
          selectedFsmType={selectedFsmTypes.get(item.id) ?? null}
          onFsmChange={(itemId, fsmType) => {
            setSelectedFsmTypes(previous => new Map(previous).set(itemId, fsmType));
          }}
        />
      );
    },
    [
      entities.resource_types,
      rootItem.id,
      selectedFsmTypes,
      selectedTypes,
      setRootResourceType,
      setSelectedFsmTypes,
      setSelectedTypes,
    ]
  );

  const renderTimeline = useCallback(
    (item: TreeTableItem) => {
      if (item.type === OPERATOR_TIMELINE_ROW_TYPE) {
        const workerId = workerIdFromOperatorTimelineRowId(item.id);
        const operators = workerId != null ? (operatorEntriesByWorker.get(workerId) ?? []) : [];
        return (
          <OperatorGanttChart
            operators={operators}
            durationSeconds={durationSeconds}
            height={DEFAULT_TIMELINE_HEIGHT}
            isDark={isDark}
          />
        );
      }
      if (item.type === LONG_ENTITIES_ROW_TYPE) {
        const resourceId = resourceIdFromLongEntitiesRowId(item.id);
        if (resourceId == null) return null;
        return (
          <LongEntitiesRow
            engineId={engineId}
            queryId={queryBundle.query_id}
            resourceId={resourceId}
            durationSeconds={durationSeconds}
            fsmTypes={entities.fsm_types}
            isDark={isDark}
          />
        );
      }
      return (
        <UsageColumn
          item={item}
          engineId={engineId}
          queryBundle={queryBundle}
          selectedTypes={selectedTypes}
          selectedFsmTypes={selectedFsmTypes}
          durationSeconds={durationSeconds}
          isDark={isDark}
        />
      );
    },
    [
      durationSeconds,
      engineId,
      entities.fsm_types,
      isDark,
      operatorEntriesByWorker,
      queryBundle,
      selectedFsmTypes,
      selectedTypes,
    ]
  );

  return {
    rootItem,
    tree,
    initialSelectedItemId: rootItem.id,
    expandedIds,
    highlightedItemIds,
    timelineData: fetchedRootTimeline,
    onExpandChange,
    onZoomChange: handleZoomChange,
    renderLabel,
    renderTimeline,
  };
}

export function ResourceTimelinesTree({ engineId, queryBundle }: ResourceTimelinesTreeProps) {
  const { durationSeconds, isDark } = useTimelineTreeSetup(queryBundle);
  const resourceTree = useResourceTimelinesTreeModel({ engineId, queryBundle, isDark });

  return (
    <TimelineTreeTable
      durationSeconds={durationSeconds}
      isDark={isDark}
      trees={[resourceTree]}
      controls={resourceTree}
    />
  );
}

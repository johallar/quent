// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Column, TreeTable } from '@quent/components';
import { useCallback, useEffect, useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useAtom } from 'jotai';
import { useHighlightedItemIds, useBulkTimelines, useHydrateTimelineAtoms } from '@quent/hooks';
import { ResourceTree, QueryBundle, EntityTypeKey } from '@quent/utils';
import type { EntityRef, SingleTimelineRequest, QueryFilter, OperatorFilter } from '@quent/utils';
import { TimelineController, TimelineRuler } from '@quent/components';
import { collectResourceTypesFromTree } from '@quent/components';
import { EntityRefKey } from '@quent/utils';
import { TreeTableItem } from '@quent/components';
import { ResourceColumn } from '@quent/components';
import { UsageColumn } from '@quent/components';
import { DEFAULT_TIMELINE_HEIGHT } from '@quent/components';
import { fetchSingleTimeline, DEFAULT_STALE_TIME } from '@quent/client';
import {
  transformResourceTree,
  getAdaptiveNumBins,
  nanosToMs,
  collectVisibleEntries,
  buildBulkParamsForItem,
  findItemById,
} from '@quent/components';
import { useExpandedIds } from '@/hooks/useExpandedIds';
import {
  selectedTypesAtom,
  selectedFsmTypesAtom,
  rootResourceTypeAtom,
  resourceChartsByResourceIdAtom,
} from '@/atoms/resourceTree';
import { TimelineToolbar } from '@quent/components';
import { useTheme, THEME_DARK } from '@/contexts/ThemeContext';
import {
  OperatorGanttChart,
  OPERATOR_TIMELINE_ROW_TYPE,
  getWorkerIdsFromPlanTree,
  operatorsWithActiveSpansForWorker,
  workerIdFromOperatorTimelineRowId,
} from '@quent/components';
import { LONG_ENTITIES_ROW_TYPE, resourceIdFromLongEntitiesRowId } from '@quent/components';
import { LongEntitiesRow } from '@/components/LongEntitiesRow';
import { ResourceChartMenu } from '@/components/ResourceChartMenu';
import { ResourceChartGlobalMenu } from '@/components/ResourceChartGlobalMenu';
import { AnimatedResourceChartRow } from '@/components/AnimatedResourceChartRow';
import { useAnimatedResourceCharts } from '@/hooks/useAnimatedResourceCharts';
import {
  RESOURCE_CHART_ORDER,
  collectItemIds,
  collectResourceIds,
  getEffectiveResourceCharts,
  getResourceChartAggregateState,
  injectResourceChartRows,
  setAllResourceCharts,
  setChartForResources,
} from '@/lib/resourceCharts';
import type { ResourceChartType } from '@/lib/resourceCharts';

function getRootResourceGroupId(resourceTree: ResourceTree<EntityRef>): string | null {
  if (!('ResourceGroup' in resourceTree)) return null;
  const [, entityId] = Object.entries(resourceTree.ResourceGroup.id)[0] as [EntityRefKey, string];
  return entityId;
}

function GanttRowLabel({ children }: { children: string }) {
  return (
    <span className="flex items-center">
      <span aria-hidden className="mr-4 h-4 w-4 shrink-0" />
      <span className="text-xs leading-none text-muted-foreground">{children}</span>
    </span>
  );
}
interface QueryResourceTreeProps {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
}

export function QueryResourceTree(props: QueryResourceTreeProps) {
  return <QueryResourceTreeContent {...props} />;
}

function QueryResourceTreeContent({ queryBundle, engineId }: QueryResourceTreeProps) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const { entities, resource_tree: resourceTree } = queryBundle;
  const [selectedTypes, setSelectedTypes] = useAtom(selectedTypesAtom);
  const [selectedFsmTypes, setSelectedFsmTypes] = useAtom(selectedFsmTypesAtom);
  const [resourceChartsByResourceId, setResourceChartsByResourceId] = useAtom(
    resourceChartsByResourceIdAtom
  );

  const startTime = queryBundle.start_time_unix_ns;
  const durationSeconds = queryBundle.duration_s;
  const startTimeMs = useMemo(() => nanosToMs(startTime), [startTime]);

  useHydrateTimelineAtoms({
    zoomRange: { start: 0, end: durationSeconds },
    debouncedZoomRange: { start: 0, end: durationSeconds },
    startTimeMs,
  });

  const rootItem = useMemo(
    () => transformResourceTree(entities, resourceTree),
    [resourceTree, entities]
  );

  const highlightedItemIds = useHighlightedItemIds(rootItem);

  const resourceTypeOptions = useMemo(() => collectResourceTypesFromTree([rootItem]), [rootItem]);

  const [rootResourceType, setRootResourceType] = useAtom(rootResourceTypeAtom);

  // Seed once per query when the atom is unset and options are available.
  useEffect(() => {
    if (rootResourceType != null) return;
    const initial = resourceTypeOptions[0];
    if (initial) setRootResourceType(initial);
  }, [rootResourceType, resourceTypeOptions, setRootResourceType]);

  const rootResourceGroupId = useMemo(() => getRootResourceGroupId(resourceTree), [resourceTree]);

  const { expandedIds, handleExpandChange } = useExpandedIds(rootItem.id);
  const controlledExpandedIds = expandedIds;

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

  const itemIds = useMemo(() => collectItemIds(rootItem), [rootItem]);
  const resourceIds = useMemo(() => collectResourceIds(rootItem), [rootItem]);
  const operatorItemIds = useMemo(
    () => itemIds.filter(itemId => workerIdsFromPlanTree.has(itemId)),
    [itemIds, workerIdsFromPlanTree]
  );
  const chartTargetIds = useMemo(() => {
    const resourceIdSet = new Set(resourceIds);
    return itemIds.filter(itemId => resourceIdSet.has(itemId) || workerIdsFromPlanTree.has(itemId));
  }, [itemIds, resourceIds, workerIdsFromPlanTree]);
  const selectedResourceCharts = useMemo(() => {
    const resourceIdSet = new Set(resourceIds);
    const selections = new Map<string, ResourceChartType[]>();

    for (const itemId of chartTargetIds) {
      selections.set(
        itemId,
        getEffectiveResourceCharts(
          resourceChartsByResourceId,
          itemId,
          workerIdsFromPlanTree
        ).filter(
          chart =>
            (chart === 'operators' && workerIdsFromPlanTree.has(itemId)) ||
            (chart === 'entities' && resourceIdSet.has(itemId))
        )
      );
    }

    return selections;
  }, [chartTargetIds, resourceChartsByResourceId, resourceIds, workerIdsFromPlanTree]);
  const renderedResourceCharts = useAnimatedResourceCharts(selectedResourceCharts);

  const availableGlobalCharts = useMemo(
    () => RESOURCE_CHART_ORDER.filter(chart => chart !== 'operators' || operatorItemIds.length > 0),
    [operatorItemIds]
  );

  const globalChartStates = useMemo(
    () => ({
      operators: getResourceChartAggregateState(
        'operators',
        operatorItemIds,
        resourceChartsByResourceId,
        workerIdsFromPlanTree
      ),
      entities: getResourceChartAggregateState(
        'entities',
        resourceIds,
        resourceChartsByResourceId,
        workerIdsFromPlanTree
      ),
    }),
    [operatorItemIds, resourceChartsByResourceId, resourceIds, workerIdsFromPlanTree]
  );

  const handleResourceChartSelectionChange = useCallback(
    (resourceId: string, charts: ResourceChartType[]) => {
      setResourceChartsByResourceId(previous => new Map(previous).set(resourceId, charts));
    },
    [setResourceChartsByResourceId]
  );

  const handleToggleGlobalChart = useCallback(
    (chart: ResourceChartType, selected: boolean) => {
      const eligibleResourceIds = chart === 'operators' ? operatorItemIds : resourceIds;
      setResourceChartsByResourceId(previous =>
        setChartForResources(previous, eligibleResourceIds, workerIdsFromPlanTree, chart, selected)
      );
    },
    [operatorItemIds, resourceIds, setResourceChartsByResourceId, workerIdsFromPlanTree]
  );

  const handleShowAllCharts = useCallback(() => {
    setResourceChartsByResourceId(
      setAllResourceCharts(chartTargetIds, workerIdsFromPlanTree, true)
    );
  }, [chartTargetIds, setResourceChartsByResourceId, workerIdsFromPlanTree]);

  const handleHideAllCharts = useCallback(() => {
    setResourceChartsByResourceId(
      setAllResourceCharts(chartTargetIds, workerIdsFromPlanTree, false)
    );
  }, [chartTargetIds, setResourceChartsByResourceId, workerIdsFromPlanTree]);

  const treeData = useMemo(
    () => [
      injectResourceChartRows(
        rootItem,
        renderedResourceCharts,
        workerIdsFromPlanTree,
        selectedResourceCharts
      ),
    ],
    [renderedResourceCharts, rootItem, selectedResourceCharts, workerIdsFromPlanTree]
  );

  /** Operator entries per worker id (for expandable gantt under each worker resource). */
  const operatorEntriesByWorker = useMemo(() => {
    const map = new Map<string, ReturnType<typeof operatorsWithActiveSpansForWorker>>();
    for (const workerId of workerIdsFromPlanTree) {
      map.set(workerId, operatorsWithActiveSpansForWorker(queryBundle, workerId));
    }
    return map;
  }, [queryBundle, workerIdsFromPlanTree]);

  const columns = useMemo(() => {
    return [
      {
        key: 'resource',
        label: 'Resource',
        widthIndex: 0,
        isFirst: true,
        headerContent: (
          <div className="flex h-full w-full items-center gap-2 px-3 text-xs font-semibold text-muted-foreground select-none">
            <span>Resource</span>
            <div className="flex-1" />
            <ResourceChartGlobalMenu
              availableCharts={availableGlobalCharts}
              chartStates={globalChartStates}
              onToggleChart={handleToggleGlobalChart}
              onShowAll={handleShowAllCharts}
              onHideAll={handleHideAllCharts}
            />
          </div>
        ),
        render: ({ item }: { item: TreeTableItem; level: number }) => {
          switch (item.type) {
            case OPERATOR_TIMELINE_ROW_TYPE: {
              return <GanttRowLabel>Operators</GanttRowLabel>;
            }
            case LONG_ENTITIES_ROW_TYPE: {
              return <GanttRowLabel>Entities</GanttRowLabel>;
            }
            default: {
              const selectedType =
                selectedTypes.get(item.id) || item.availableResourceTypes?.[0] || '';
              const isResource = item.type === EntityTypeKey.Resource;
              const resourceTypeName =
                isResource && 'type_name' in item.entity
                  ? (item.entity.type_name as string)
                  : selectedType;
              const availableFsmTypes = resourceTypeName
                ? entities.resource_types[resourceTypeName]?.used_by
                : undefined;
              const availableCharts = RESOURCE_CHART_ORDER.filter(
                chart =>
                  (chart === 'operators' && workerIdsFromPlanTree.has(item.id)) ||
                  (chart === 'entities' && isResource)
              );
              const selectedCharts = getEffectiveResourceCharts(
                resourceChartsByResourceId,
                item.id,
                workerIdsFromPlanTree
              );
              const itemLabel =
                (item.entity as { instance_name?: string }).instance_name || item.id;
              return (
                <ResourceColumn
                  item={item}
                  selectedType={selectedType}
                  onTypeChange={(itemId, newType) => {
                    setSelectedTypes(prev => new Map(prev).set(itemId, newType));
                    if (itemId === rootItem.id) {
                      setRootResourceType(newType);
                    }
                  }}
                  availableFsmTypes={availableFsmTypes}
                  selectedFsmType={selectedFsmTypes.get(item.id) ?? null}
                  onFsmChange={(itemId, fsmType) => {
                    setSelectedFsmTypes(prev => new Map(prev).set(itemId, fsmType));
                  }}
                  trailingActions={
                    availableCharts.length > 0 ? (
                      <ResourceChartMenu
                        resourceLabel={itemLabel}
                        availableCharts={availableCharts}
                        selectedCharts={selectedCharts}
                        onSelectionChange={charts =>
                          handleResourceChartSelectionChange(item.id, charts)
                        }
                      />
                    ) : undefined
                  }
                />
              );
            }
          }
        },
      },
      {
        key: 'usage',
        label: 'Usage',
        widthIndex: 1,
        headerContent: (
          <div className="h-full overflow-hidden flex items-center py-1">
            <TimelineController
              durationSeconds={durationSeconds}
              timelineData={fetchedRootTimeline}
              onZoomChange={handleZoomChange}
              isDark={isDark}
            />
          </div>
        ),
        subHeaderContent: <TimelineRuler isDark={isDark} />,
        render: ({ item }: { item: TreeTableItem }) => {
          switch (item.type) {
            case OPERATOR_TIMELINE_ROW_TYPE: {
              const workerId = workerIdFromOperatorTimelineRowId(item.id);
              const operators =
                workerId != null ? (operatorEntriesByWorker.get(workerId) ?? []) : [];
              return (
                <AnimatedResourceChartRow expanded={item.isChartExpanded ?? true}>
                  <OperatorGanttChart
                    operators={operators}
                    durationSeconds={durationSeconds}
                    height={DEFAULT_TIMELINE_HEIGHT}
                    isDark={isDark}
                  />
                </AnimatedResourceChartRow>
              );
            }
            case LONG_ENTITIES_ROW_TYPE: {
              const resourceId = resourceIdFromLongEntitiesRowId(item.id);
              if (resourceId == null) return null;
              return (
                <AnimatedResourceChartRow expanded={item.isChartExpanded ?? true}>
                  <LongEntitiesRow
                    engineId={engineId}
                    queryId={queryBundle.query_id}
                    resourceId={resourceId}
                    durationSeconds={durationSeconds}
                    fsmTypes={entities.fsm_types}
                    isDark={isDark}
                  />
                </AnimatedResourceChartRow>
              );
            }
            default: {
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
            }
          }
        },
      },
    ] satisfies Column<TreeTableItem>[];
  }, [
    durationSeconds,
    fetchedRootTimeline,
    isDark,
    selectedTypes,
    setSelectedTypes,
    selectedFsmTypes,
    setSelectedFsmTypes,
    setRootResourceType,
    entities,
    rootItem,
    engineId,
    queryBundle,
    handleZoomChange,
    operatorEntriesByWorker,
    availableGlobalCharts,
    globalChartStates,
    handleToggleGlobalChart,
    handleShowAllCharts,
    handleHideAllCharts,
    workerIdsFromPlanTree,
    resourceChartsByResourceId,
    handleResourceChartSelectionChange,
  ]);

  return (
    <div className="flex min-w-0 flex-col h-full w-full">
      <TimelineToolbar durationSeconds={durationSeconds} />
      <div className="min-w-0 flex-1 min-h-0">
        <TreeTable<TreeTableItem>
          data={treeData}
          columns={columns}
          initialSelectedItemId={rootItem.id}
          columnWidths={[275, 'auto']}
          onExpandChange={onExpandChange}
          highlightedItemIds={highlightedItemIds}
          controlledExpandedIds={controlledExpandedIds}
          virtualized
          // Estimate for virtualization
          rowHeight={DEFAULT_TIMELINE_HEIGHT}
        />
      </div>
    </div>
  );
}

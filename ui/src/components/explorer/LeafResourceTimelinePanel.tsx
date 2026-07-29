// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import {
  Input,
  ResourceColumn,
  TimelineController,
  TimelineRuler,
  TimelineToolbar,
  UsageColumn,
  buildBulkParamsForItem,
  thinScrollbarClass,
  transformResourceTree,
} from '@quent/components';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@quent/components';
import {
  useBulkTimelineFetch,
  useDebouncedZoomRange,
  useSelectedNodeIds,
  useSetBulkInitialized,
  useTimelineZoomHandler,
} from '@quent/hooks';
import { MAX_TIMELINE_BINS } from '@quent/utils';
import type { EntityRef, QueryBundle } from '@quent/utils';
import {
  filterLeafResources,
  flattenLeafResources,
  getLeafResourceType,
  resolveFocusedResourceId,
} from './explorer.utils';

const ALL_RESOURCE_TYPES = '__all_resource_types__';
const EMPTY_SELECTIONS = new Map<string, string>();
const ignoreTypeChange = () => {};

type LeafResourceTimelinePanelProps = {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
  focusedResourceId: string | null;
  onFocusedResourceChange: (resourceId: string | null) => void;
  isDark: boolean;
};

export function LeafResourceTimelinePanel({
  engineId,
  queryBundle,
  focusedResourceId,
  onFocusedResourceChange,
  isDark,
}: LeafResourceTimelinePanelProps) {
  const [search, setSearch] = useState('');
  const [resourceType, setResourceType] = useState<string | null>(null);
  const debouncedZoomRange = useDebouncedZoomRange();
  const handleZoomChange = useTimelineZoomHandler();
  const selectedNodeIds = useSelectedNodeIds();
  const setBulkInitialized = useSetBulkInitialized();
  const operatorId = selectedNodeIds.size === 1 ? [...selectedNodeIds][0]! : null;

  const rootItem = useMemo(
    () => transformResourceTree(queryBundle.entities, queryBundle.resource_tree),
    [queryBundle.entities, queryBundle.resource_tree]
  );
  const resources = useMemo(() => flattenLeafResources(rootItem), [rootItem]);
  const resourceTypes = useMemo(
    () => [...new Set(resources.map(getLeafResourceType).filter(Boolean))].sort(),
    [resources]
  );
  const visibleResources = useMemo(
    () => filterLeafResources(resources, search, resourceType),
    [resourceType, resources, search]
  );

  useEffect(() => {
    const nextFocusedId = resolveFocusedResourceId(focusedResourceId, visibleResources);
    if (nextFocusedId !== focusedResourceId) onFocusedResourceChange(nextFocusedId);
  }, [focusedResourceId, onFocusedResourceChange, visibleResources]);

  const timelineEntries = useMemo(
    () =>
      Object.fromEntries(
        visibleResources.map(resource => [
          resource.id,
          buildBulkParamsForItem(resource, EMPTY_SELECTIONS, queryBundle.entities, {
            num_bins: MAX_TIMELINE_BINS,
            start: debouncedZoomRange.start,
            end: debouncedZoomRange.end,
          }),
        ])
      ),
    [debouncedZoomRange.end, debouncedZoomRange.start, queryBundle.entities, visibleResources]
  );

  const bulkData = useBulkTimelineFetch({
    engineId,
    queryId: queryBundle.query_id,
    debouncedZoomRange,
    entries: timelineEntries,
    operatorId,
    enabled: visibleResources.length > 0,
  });

  useEffect(() => {
    if (bulkData) setBulkInitialized(true);
  }, [bulkData, setBulkInitialized]);

  return (
    <section className="flex h-full min-h-0 min-w-0 flex-col bg-card">
      <div className="border-b border-border">
        <TimelineToolbar durationSeconds={queryBundle.duration_s} />
        <div className="flex h-11 items-center gap-2 px-3">
          <Input
            aria-label="Filter resources"
            className="h-8 min-w-0 flex-1"
            placeholder="Filter leaf resources"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <Select
            value={resourceType ?? ALL_RESOURCE_TYPES}
            onValueChange={value => setResourceType(value === ALL_RESOURCE_TYPES ? null : value)}
          >
            <SelectTrigger className="h-8 w-44" aria-label="Filter by resource type">
              <SelectValue placeholder="All resource types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RESOURCE_TYPES}>All resource types</SelectItem>
              {resourceTypes.map(type => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
            {visibleResources.length} / {resources.length}
          </span>
        </div>
      </div>

      <div className="grid h-[50px] shrink-0 grid-cols-[260px_minmax(0,1fr)] border-b border-border">
        <div className="flex items-center border-r border-border px-3 text-xs font-semibold text-muted-foreground">
          Leaf resource
        </div>
        <TimelineController
          durationSeconds={queryBundle.duration_s}
          onZoomChange={handleZoomChange}
          isDark={isDark}
        />
      </div>
      <div className="grid h-[22px] shrink-0 grid-cols-[260px_minmax(0,1fr)] border-b border-border">
        <div className="border-r border-border" />
        <TimelineRuler isDark={isDark} />
      </div>

      <div className={`min-h-0 flex-1 overflow-y-auto ${thinScrollbarClass}`}>
        {visibleResources.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            No leaf resources match the current filters
          </div>
        ) : (
          visibleResources.map(resource => {
            const selectedType = getLeafResourceType(resource);
            const isFocused = resource.id === focusedResourceId;
            return (
              <div
                key={resource.id}
                data-focused={isFocused}
                className="grid min-h-[45px] grid-cols-[260px_minmax(0,1fr)] border-b border-border/60 data-[focused=true]:bg-primary/10"
              >
                <button
                  type="button"
                  className="min-w-0 border-r border-border px-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onFocusedResourceChange(resource.id)}
                >
                  <ResourceColumn
                    item={resource}
                    selectedType={selectedType}
                    onTypeChange={ignoreTypeChange}
                  />
                </button>
                <UsageColumn
                  item={resource}
                  engineId={engineId}
                  queryBundle={queryBundle}
                  selectedTypes={EMPTY_SELECTIONS}
                  durationSeconds={queryBundle.duration_s}
                  isDark={isDark}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

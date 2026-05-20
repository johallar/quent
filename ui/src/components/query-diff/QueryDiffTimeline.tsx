// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Triangle } from 'lucide-react';
import {
  DEFAULT_STALE_TIME,
  fetchQueryProfileDiffTimeline,
  type QueryProfileDiffResponse,
  type QueryProfileDiffTimelineRequest,
} from '@quent/client';
import {
  DataText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Timeline,
  TimelineController,
  TimelineRuler,
  collectResourceTypesFromTree,
  transformResourceTree,
  getAdaptiveNumBins,
} from '@quent/components';
import { useSetDebouncedZoomRange, useSetZoomRange } from '@quent/hooks';
import {
  cn,
  formatDuration,
  type EntityRef,
  type EntityRefKey,
  type QueryBundle,
  type QueryFilter,
  type SingleTimelineRequest,
  type TaskFilter,
} from '@quent/utils';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import {
  getDiffNegativeColor,
  getDiffPositiveColor,
  getQueryDiffQueryColors,
} from './QueryDiffColors';
import { buildDiffTimelineData } from './QueryDiffTimeline.utils';

interface QueryDiffTimelineProps {
  engineId: string;
  diff: QueryProfileDiffResponse;
  queryABundle: QueryBundle<EntityRef>;
  queryBBundle: QueryBundle<EntityRef>;
}

interface TimelineTarget {
  rootResourceGroupId: string;
  resourceTypes: string[];
}

const TIMELINE_ROW_HEIGHT = 44;
const TIMELINE_START = 0n;
const COMPACT_SELECT_TRIGGER_CLASS = 'h-7 min-w-36 rounded px-2 py-1 text-xs';
const COMPACT_SELECT_ITEM_CLASS = 'py-1 pl-7 pr-2 text-xs';

function getTimelineTarget(bundle: QueryBundle<EntityRef>): TimelineTarget | null {
  if (!('ResourceGroup' in bundle.resource_tree)) return null;

  const [, rootResourceGroupId] = Object.entries(bundle.resource_tree.ResourceGroup.id)[0] as [
    EntityRefKey,
    string,
  ];
  const rootItem = transformResourceTree(bundle.entities, bundle.resource_tree);

  return {
    rootResourceGroupId,
    resourceTypes: collectResourceTypesFromTree([rootItem]),
  };
}

function getSharedResourceTypes(a: string[], b: string[]): string[] {
  const bSet = new Set(b);
  return a.filter(type => bSet.has(type));
}

function buildRootTimelineRequest({
  queryId,
  rootResourceGroupId,
  resourceTypeName,
  durationSeconds,
}: {
  queryId: string;
  rootResourceGroupId: string;
  resourceTypeName: string;
  durationSeconds: number;
}): SingleTimelineRequest<QueryFilter, TaskFilter> {
  return {
    entry: {
      ResourceGroup: {
        resource_group_id: rootResourceGroupId,
        resource_type_name: resourceTypeName,
        long_entities_threshold_s: null,
        entity_filter: { entity_type_name: null },
        app_params: { operator_id: null },
        config: {
          num_bins: getAdaptiveNumBins(),
          start: 0,
          end: durationSeconds,
        },
      },
    },
    app_params: { query_id: queryId },
  };
}

function TimelineLane({
  label,
  detail,
  color,
  children,
  className,
}: {
  label: string;
  detail?: React.ReactNode;
  color?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'grid min-h-0 grid-cols-[9rem_minmax(0,1fr)] border-t border-border',
        className
      )}
      style={{ height: TIMELINE_ROW_HEIGHT }}
    >
      <div className="flex min-w-0 flex-col justify-center border-r border-border px-3">
        <span className="flex min-w-0 items-center gap-1 text-xs font-semibold">
          {color && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
          )}
          <span className="truncate">{label}</span>
        </span>
        {detail && <span className="truncate text-[11px] text-muted-foreground">{detail}</span>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function QueryDiffTimeline({
  engineId,
  diff,
  queryABundle,
  queryBBundle,
}: QueryDiffTimelineProps) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const paletteTheme = isDark ? 'dark' : 'light';
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();

  const queryAId = diff.query_a.id;
  const queryBId = diff.query_b.id;
  const queryColors = useMemo(
    () => getQueryDiffQueryColors({ queryAId, queryBId, theme: paletteTheme }),
    [paletteTheme, queryAId, queryBId]
  );
  const diffPositiveColor = getDiffPositiveColor(paletteTheme);
  const diffNegativeColor = getDiffNegativeColor(paletteTheme);

  const targetA = useMemo(() => getTimelineTarget(queryABundle), [queryABundle]);
  const targetB = useMemo(() => getTimelineTarget(queryBBundle), [queryBBundle]);
  const sharedResourceTypes = useMemo(
    () => getSharedResourceTypes(targetA?.resourceTypes ?? [], targetB?.resourceTypes ?? []),
    [targetA?.resourceTypes, targetB?.resourceTypes]
  );
  const [resourceType, setResourceType] = useState('');

  useEffect(() => {
    if (sharedResourceTypes.length === 0) {
      setResourceType('');
      return;
    }
    setResourceType(prev => (sharedResourceTypes.includes(prev) ? prev : sharedResourceTypes[0]!));
  }, [sharedResourceTypes]);

  const durationSeconds = Math.max(queryABundle.duration_s, queryBBundle.duration_s);

  useEffect(() => {
    if (durationSeconds <= 0) return;
    const full = { start: 0, end: durationSeconds };
    setZoomRange(full);
    setDebouncedZoomRange(full);
  }, [durationSeconds, queryAId, queryBId, setZoomRange, setDebouncedZoomRange]);

  const requestA = useMemo(() => {
    if (!targetA || !resourceType) return null;
    return buildRootTimelineRequest({
      queryId: queryABundle.query_id,
      rootResourceGroupId: targetA.rootResourceGroupId,
      resourceTypeName: resourceType,
      durationSeconds: queryABundle.duration_s,
    });
  }, [queryABundle.duration_s, queryABundle.query_id, resourceType, targetA]);

  const requestB = useMemo(() => {
    if (!targetB || !resourceType) return null;
    return buildRootTimelineRequest({
      queryId: queryBBundle.query_id,
      rootResourceGroupId: targetB.rootResourceGroupId,
      resourceTypeName: resourceType,
      durationSeconds: queryBBundle.duration_s,
    });
  }, [queryBBundle.duration_s, queryBBundle.query_id, resourceType, targetB]);

  const timelineDiffRequest = useMemo<QueryProfileDiffTimelineRequest | null>(() => {
    if (!requestA || !requestB || durationSeconds <= 0) return null;
    return {
      timelines: [requestA, requestB],
      delta_config: {
        num_bins: getAdaptiveNumBins(),
        start: 0,
        end: durationSeconds,
      },
    };
  }, [durationSeconds, requestA, requestB]);

  const timelineDiff = useQuery({
    queryKey: [
      'queryDiffTimeline',
      engineId,
      queryAId,
      queryBId,
      targetA?.rootResourceGroupId,
      targetB?.rootResourceGroupId,
      timelineDiffRequest,
    ],
    queryFn: () => fetchQueryProfileDiffTimeline(engineId, timelineDiffRequest!),
    enabled: Boolean(timelineDiffRequest && engineId),
    staleTime: DEFAULT_STALE_TIME,
  });

  const comparison = useMemo(() => {
    if (!timelineDiff.data || durationSeconds <= 0) return null;
    const resourceTypeDecl =
      queryABundle.entities.resource_types[resourceType] ??
      queryBBundle.entities.resource_types[resourceType];
    return buildDiffTimelineData({
      timelineDiff: timelineDiff.data,
      theme: paletteTheme,
      capacities: resourceTypeDecl?.capacities,
      quantitySpecs: queryABundle.quantity_specs ?? queryBBundle.quantity_specs,
      fsmTypes: queryABundle.entities.fsm_types ?? queryBBundle.entities.fsm_types,
      queryColors,
    });
  }, [
    durationSeconds,
    paletteTheme,
    queryABundle.entities.fsm_types,
    queryABundle.entities.resource_types,
    queryABundle.quantity_specs,
    queryBBundle.entities.fsm_types,
    queryBBundle.entities.resource_types,
    queryBBundle.quantity_specs,
    queryColors,
    resourceType,
    timelineDiff.data,
  ]);

  const isLoading = Boolean(resourceType) && timelineDiff.isLoading;
  const hasError = timelineDiff.isError;

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline Delta
          </div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <DataText className="max-w-48 truncate">
              {diff.query_a.instance_name ?? queryAId}
            </DataText>
            <Triangle
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="delta"
              role="img"
            />
            <DataText className="max-w-48 truncate">
              {diff.query_b.instance_name ?? queryBId}
            </DataText>
            {durationSeconds > 0 && <span>{formatDuration(durationSeconds * 1_000)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {comparison && (
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex shrink-0">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: diffNegativeColor }}
                />
                B lower
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: diffPositiveColor }}
                />
                B higher
              </span>
            </div>
          )}
          <Select
            value={resourceType}
            onValueChange={setResourceType}
            disabled={sharedResourceTypes.length <= 1}
          >
            <SelectTrigger className={COMPACT_SELECT_TRIGGER_CLASS} aria-label="Resource type">
              <SelectValue placeholder="Resource type" />
            </SelectTrigger>
            <SelectContent>
              {sharedResourceTypes.length === 0 ? (
                <SelectItem
                  value="no-resource-types"
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No shared resource types
                </SelectItem>
              ) : (
                sharedResourceTypes.map(type => (
                  <SelectItem key={type} value={type} className={COMPACT_SELECT_ITEM_CLASS}>
                    <DataText>{type}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          Loading timeline...
        </div>
      ) : hasError ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-destructive">
          Failed to load timeline delta
        </div>
      ) : !resourceType || !targetA || !targetB ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          No shared resource type available for timeline delta.
        </div>
      ) : comparison ? (
        <div className="min-w-0">
          <div className="border-t border-border">
            <TimelineController
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              height={40}
              onZoomChange={range => {
                setZoomRange(range);
                setDebouncedZoomRange(range);
              }}
              isDark={isDark}
            />
          </div>
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] border-t border-border">
            <div className="border-r border-border" />
            <TimelineRuler startTime={TIMELINE_START} isDark={isDark} />
          </div>
          <TimelineLane
            label="Query A"
            color={queryColors.queryA}
            detail={<DataText>{diff.query_a.instance_name ?? queryAId}</DataText>}
          >
            <Timeline
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={comparison.queryA.timestamps}
              series={comparison.queryA.series}
              showTooltip={false}
              isDark={isDark}
            />
          </TimelineLane>
          <TimelineLane
            label="Query B"
            color={queryColors.queryB}
            detail={<DataText>{diff.query_b.instance_name ?? queryBId}</DataText>}
          >
            <Timeline
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={comparison.queryB.timestamps}
              series={comparison.queryB.series}
              showTooltip={false}
              isDark={isDark}
            />
          </TimelineLane>
          <TimelineLane label="Delta" detail="A - B" className="border-b-0">
            <Timeline
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={comparison.delta.timestamps}
              series={comparison.delta.series}
              showTooltip={false}
              isDark={isDark}
            />
          </TimelineLane>
        </div>
      ) : null}
    </div>
  );
}

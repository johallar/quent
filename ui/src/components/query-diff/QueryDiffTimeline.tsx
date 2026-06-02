// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Triangle } from 'lucide-react';
import {
  DEFAULT_STALE_TIME,
  fetchQueryProfileDiffTimeline,
  fetchSingleTimeline,
  queryBundleQueryOptions,
  type DiffQuerySummary,
  type QueryDiff,
  type DiffTimelineRequest,
} from '@quent/client';
import {
  buildBinnedTimelineSeries,
  Button,
  DataText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Timeline,
  TimelineController,
  TimelineRuler,
  type TimelineSeries,
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
  type PaletteTheme,
  type QueryBundle,
  type QueryFilter,
  type SingleTimelineRequest,
  type TaskFilter,
} from '@quent/utils';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import {
  getDiffDivergingColors,
  getDiffNegativeColor,
  getDiffPositiveColor,
  getQueryDiffQueryColors,
} from './QueryDiffColors';
import {
  QueryDiffTimelineHeatmap,
  type QueryDiffTimelineHeatmapRow,
} from './QueryDiffTimelineHeatmap';
import { QueryDiffTimelineLine } from './QueryDiffTimelineLine';
import { QueryDiffTimelineWithTooltip } from './QueryDiffTimelineTooltip';
import { buildDiffHeatmapRowData, buildDiffTimelineData } from './QueryDiffTimeline.utils';

interface QueryDiffTimelineProps {
  baselineEngineId: string;
  comparisonEngineId: string;
  diff: QueryDiff;
  baselineBundle: QueryBundle<EntityRef>;
  comparisonBundle: QueryBundle<EntityRef>;
  comparisonIndex?: number;
}

export interface QueryDiffTimelineListComparison {
  id: string;
  comparisonIndex: number;
  comparisonEngineId: string;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
}

interface QueryDiffTimelineListComparisonWithBundle extends QueryDiffTimelineListComparison {
  comparisonBundle: QueryBundle<EntityRef>;
}

interface QueryDiffTimelineListProps {
  baselineEngineId: string;
  baselineBundle: QueryBundle<EntityRef>;
  comparisons: QueryDiffTimelineListComparison[];
}

interface TimelineTarget {
  rootResourceGroupId: string;
  resourceTypes: string[];
}

const TIMELINE_ROW_HEIGHT = 85;
const HEATMAP_ROW_HEIGHT = Math.round((TIMELINE_ROW_HEIGHT * 2) / 3);
const TIMELINE_START = 0n;
const COMPACT_SELECT_TRIGGER_CLASS = 'h-7 min-w-36 rounded px-2 py-1 text-xs';
const COMPACT_SELECT_ITEM_CLASS = 'py-1 pl-7 pr-2 text-xs';
type QueryDiffTimelineView = 'overlay' | 'heatmap' | 'line';
type QueryDiffCompactTimelineView = Exclude<QueryDiffTimelineView, 'overlay'>;

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

function bundleQuerySummary(bundle: QueryBundle<EntityRef>): DiffQuerySummary {
  return {
    id: bundle.entities.query.id,
    engine_id: bundle.entities.engine.id,
    instance_name: bundle.entities.query.instance_name ?? null,
    query_group_id: bundle.entities.query_group.id,
    query_group_name: bundle.entities.query_group.instance_name ?? null,
  };
}

function querySummaryLabel(query: DiffQuerySummary): string {
  return query.instance_name ?? query.id;
}

function getBaselineResourceTypesSharedWithComparisons(
  baselineTarget: TimelineTarget | null,
  comparisonTargets: Array<TimelineTarget | null>
): string[] {
  if (!baselineTarget) return [];
  return baselineTarget.resourceTypes.filter(type =>
    comparisonTargets.some(target => target?.resourceTypes.includes(type))
  );
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

function buildPairTimelineDiffRequest({
  baselineEngineId,
  baselineQueryId,
  baselineTarget,
  comparisonEngineId,
  comparisonQueryId,
  comparisonTarget,
  resourceType,
  durationSeconds,
}: {
  baselineEngineId: string;
  baselineQueryId: string;
  baselineTarget: TimelineTarget | null;
  comparisonEngineId: string;
  comparisonQueryId: string;
  comparisonTarget: TimelineTarget | null;
  resourceType: string;
  durationSeconds: number;
}): DiffTimelineRequest | null {
  if (!baselineTarget || !comparisonTarget || !resourceType || durationSeconds <= 0) return null;

  const baselineRequest = buildRootTimelineRequest({
    queryId: baselineQueryId,
    rootResourceGroupId: baselineTarget.rootResourceGroupId,
    resourceTypeName: resourceType,
    durationSeconds,
  });
  const comparisonRequest = buildRootTimelineRequest({
    queryId: comparisonQueryId,
    rootResourceGroupId: comparisonTarget.rootResourceGroupId,
    resourceTypeName: resourceType,
    durationSeconds,
  });

  return {
    timelines: [
      { engine_id: baselineEngineId, timeline: baselineRequest },
      { engine_id: comparisonEngineId, timeline: comparisonRequest },
    ],
    delta_config: {
      num_bins: getAdaptiveNumBins(),
      start: 0,
      end: durationSeconds,
    },
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

function recolorTimelineSeries(series: TimelineSeries, color: string): TimelineSeries {
  return Object.fromEntries(
    Object.entries(series).map(([name, entry]) => [
      name,
      {
        ...entry,
        color,
      },
    ])
  );
}

function QueryDiffTimelinePairRows({
  comparison,
  baselineEngineId,
  baselineQueryId,
  baselineTarget,
  resourceType,
  durationSeconds,
  positiveColor,
  negativeColor,
}: {
  comparison: QueryDiffTimelineListComparisonWithBundle;
  baselineEngineId: string;
  baselineQueryId: string;
  baselineTarget: TimelineTarget | null;
  resourceType: string;
  durationSeconds: number;
  positiveColor: string;
  negativeColor: string;
}) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const paletteTheme = isDark ? 'dark' : 'light';
  const comparisonTarget = useMemo(
    () => getTimelineTarget(comparison.comparisonBundle),
    [comparison.comparisonBundle]
  );
  const canRenderResourceType = Boolean(
    baselineTarget && comparisonTarget?.resourceTypes.includes(resourceType)
  );
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId,
        comparisonQueryId: comparison.comparisonQuery.id,
        comparisonIndex: comparison.comparisonIndex,
        theme: paletteTheme,
      }),
    [baselineQueryId, comparison.comparisonQuery.id, comparison.comparisonIndex, paletteTheme]
  );

  const timelineDiffRequest = useMemo<DiffTimelineRequest | null>(() => {
    if (!canRenderResourceType) return null;
    return buildPairTimelineDiffRequest({
      baselineEngineId,
      baselineQueryId,
      baselineTarget,
      comparisonEngineId: comparison.comparisonEngineId,
      comparisonQueryId: comparison.comparisonBundle.query_id,
      comparisonTarget,
      resourceType,
      durationSeconds,
    });
  }, [
    baselineEngineId,
    baselineQueryId,
    baselineTarget,
    canRenderResourceType,
    comparison.comparisonEngineId,
    comparison.comparisonBundle.query_id,
    comparisonTarget,
    durationSeconds,
    resourceType,
  ]);

  const timelineDiff = useQuery({
    queryKey: [
      'queryDiffTimelineListPair',
      baselineEngineId,
      baselineQueryId,
      comparison.comparisonEngineId,
      comparison.comparisonQuery.id,
      baselineTarget?.rootResourceGroupId,
      comparisonTarget?.rootResourceGroupId,
      timelineDiffRequest,
    ],
    queryFn: () => fetchQueryProfileDiffTimeline(timelineDiffRequest!),
    enabled: Boolean(timelineDiffRequest),
    staleTime: DEFAULT_STALE_TIME,
  });

  const timelineData = useMemo(() => {
    if (!timelineDiff.data || durationSeconds <= 0) return null;
    const resourceTypeDecl = comparison.comparisonBundle.entities.resource_types[resourceType];
    return buildDiffTimelineData({
      timelineDiff: timelineDiff.data,
      theme: paletteTheme,
      capacities: resourceTypeDecl?.capacities,
      quantitySpecs: comparison.comparisonBundle.quantity_specs,
      fsmTypes: comparison.comparisonBundle.entities.fsm_types,
      queryColors,
    });
  }, [
    comparison.comparisonBundle.entities.fsm_types,
    comparison.comparisonBundle.entities.resource_types,
    comparison.comparisonBundle.quantity_specs,
    durationSeconds,
    paletteTheme,
    queryColors,
    resourceType,
    timelineDiff.data,
  ]);

  const comparisonName = querySummaryLabel(comparison.comparisonQuery);
  const tooltipData = useMemo(() => {
    if (!timelineData) return null;
    return {
      label: comparisonName,
      ...buildDiffHeatmapRowData(timelineData),
    };
  }, [comparisonName, timelineData]);

  if (!canRenderResourceType) {
    return (
      <TimelineLane label={comparisonName} color={queryColors.comparison}>
        <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
          No shared resource type available.
        </div>
      </TimelineLane>
    );
  }

  if (timelineDiff.isLoading) {
    return (
      <TimelineLane label={comparisonName} color={queryColors.comparison}>
        <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
          Loading timeline...
        </div>
      </TimelineLane>
    );
  }

  if (timelineDiff.isError || !timelineData || !tooltipData) {
    return (
      <TimelineLane label={comparisonName} color={queryColors.comparison}>
        <div className="flex h-full items-center px-3 text-xs text-destructive">
          Failed to load timeline delta
        </div>
      </TimelineLane>
    );
  }

  return (
    <>
      <TimelineLane
        label="Comparison"
        color={queryColors.comparison}
        detail={<DataText>{comparisonName}</DataText>}
      >
        <QueryDiffTimelineWithTooltip
          startTime={TIMELINE_START}
          durationSeconds={durationSeconds}
          timestamps={timelineData.comparisonWithDelta.timestamps}
          series={timelineData.comparisonWithDelta.series}
          tooltipData={tooltipData}
          positiveColor={positiveColor}
          negativeColor={negativeColor}
          isDark={isDark}
        />
      </TimelineLane>
    </>
  );
}

function QueryDiffTimelineHeatmapRows({
  view,
  baselineEngineId,
  baselineQueryId,
  baselineBundle,
  baselineTarget,
  comparisons,
  resourceType,
  durationSeconds,
  fallbackTimestamps,
  isDark,
  paletteTheme,
  colorScheme,
  positiveColor,
  negativeColor,
}: {
  view: QueryDiffCompactTimelineView;
  baselineEngineId: string;
  baselineQueryId: string;
  baselineBundle: QueryBundle<EntityRef>;
  baselineTarget: TimelineTarget | null;
  comparisons: QueryDiffTimelineListComparisonWithBundle[];
  resourceType: string;
  durationSeconds: number;
  fallbackTimestamps: number[];
  isDark: boolean;
  paletteTheme: PaletteTheme;
  colorScheme: readonly string[];
  positiveColor: string;
  negativeColor: string;
}) {
  const comparisonTargets = useMemo(
    () => comparisons.map(comparison => getTimelineTarget(comparison.comparisonBundle)),
    [comparisons]
  );
  const requests = useMemo(
    () =>
      comparisons.map((comparison, index) => {
        const comparisonTarget = comparisonTargets[index] ?? null;
        if (!comparisonTarget?.resourceTypes.includes(resourceType)) return null;
        return buildPairTimelineDiffRequest({
          baselineEngineId,
          baselineQueryId,
          baselineTarget,
          comparisonEngineId: comparison.comparisonEngineId,
          comparisonQueryId: comparison.comparisonBundle.query_id,
          comparisonTarget,
          resourceType,
          durationSeconds,
        });
      }),
    [
      baselineEngineId,
      baselineQueryId,
      baselineTarget,
      comparisonTargets,
      comparisons,
      durationSeconds,
      resourceType,
    ]
  );

  const timelineDiffQueries = useQueries({
    queries: comparisons.map((comparison, index) => ({
      queryKey: [
        'queryDiffTimelineHeatmapPair',
        baselineEngineId,
        baselineQueryId,
        comparison.comparisonEngineId,
        comparison.comparisonQuery.id,
        baselineTarget?.rootResourceGroupId,
        comparisonTargets[index]?.rootResourceGroupId,
        requests[index],
      ],
      queryFn: () => fetchQueryProfileDiffTimeline(requests[index]!),
      enabled: Boolean(requests[index]),
      staleTime: DEFAULT_STALE_TIME,
    })),
  });

  const activeRequestCount = requests.filter(Boolean).length;
  const isLoading = timelineDiffQueries.some((query, index) => requests[index] && query.isLoading);
  const hasError = timelineDiffQueries.some((query, index) => requests[index] && query.isError);

  if (activeRequestCount > 0 && isLoading) {
    return (
      <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
        Loading timeline {view}...
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="flex h-28 items-center justify-center border-t border-border text-xs text-destructive">
        Failed to load timeline {view}
      </div>
    );
  }

  const rows = comparisons.map((comparison, index): QueryDiffTimelineHeatmapRow => {
    const comparisonTarget = comparisonTargets[index] ?? null;
    const queryColors = getQueryDiffQueryColors({
      baselineQueryId,
      comparisonQueryId: comparison.comparisonQuery.id,
      comparisonIndex: comparison.comparisonIndex,
      theme: paletteTheme,
    });
    const baseRow = {
      id: comparison.id,
      label: querySummaryLabel(comparison.comparisonQuery),
      detail: `Comparison ${comparison.comparisonIndex + 1}`,
      color: queryColors.comparison,
    };

    if (!comparisonTarget?.resourceTypes.includes(resourceType)) {
      return {
        ...baseRow,
        timestamps: fallbackTimestamps,
        baselineValues: [],
        comparisonValues: [],
        signedDeltaValues: [],
        relativeValues: [],
        colorValues: [],
        formatter: value => String(value),
        disabledMessage: 'No shared resource type',
      };
    }

    const timelineDiff = timelineDiffQueries[index]?.data;
    if (!timelineDiff) {
      return {
        ...baseRow,
        timestamps: fallbackTimestamps,
        baselineValues: [],
        comparisonValues: [],
        signedDeltaValues: [],
        relativeValues: [],
        colorValues: [],
        formatter: value => String(value),
        disabledMessage: 'No timeline data',
      };
    }

    const resourceTypeDecl =
      baselineBundle.entities.resource_types[resourceType] ??
      comparison.comparisonBundle.entities.resource_types[resourceType];
    const timelineData = buildDiffTimelineData({
      timelineDiff,
      theme: paletteTheme,
      capacities: resourceTypeDecl?.capacities,
      quantitySpecs: baselineBundle.quantity_specs ?? comparison.comparisonBundle.quantity_specs,
      fsmTypes: baselineBundle.entities.fsm_types ?? comparison.comparisonBundle.entities.fsm_types,
      queryColors,
    });

    return {
      ...baseRow,
      ...buildDiffHeatmapRowData(timelineData),
    };
  });
  return view === 'heatmap' ? (
    <QueryDiffTimelineHeatmap
      rows={rows}
      timestamps={fallbackTimestamps}
      rowHeight={HEATMAP_ROW_HEIGHT}
      durationSeconds={durationSeconds}
      isDark={isDark}
      colorScheme={colorScheme}
      positiveColor={positiveColor}
      negativeColor={negativeColor}
    />
  ) : (
    <QueryDiffTimelineLine
      rows={rows}
      timestamps={fallbackTimestamps}
      rowHeight={HEATMAP_ROW_HEIGHT}
      durationSeconds={durationSeconds}
      isDark={isDark}
      positiveColor={positiveColor}
      negativeColor={negativeColor}
    />
  );
}

export function QueryDiffTimelineList({
  baselineEngineId,
  baselineBundle,
  comparisons,
}: QueryDiffTimelineListProps) {
  const comparisonBundles = useQueries({
    queries: comparisons.map(comparison => ({
      ...queryBundleQueryOptions({
        engineId: comparison.comparisonEngineId,
        queryId: comparison.comparisonQuery.id,
      }),
      enabled: Boolean(comparison.comparisonEngineId && comparison.comparisonQuery.id),
    })),
  });
  const comparisonsWithBundles = useMemo(
    () =>
      comparisons.flatMap((comparison, index) => {
        const comparisonBundle = comparisonBundles[index]?.data;
        if (!comparisonBundle) return [];
        return [{ ...comparison, comparisonBundle }];
      }),
    [comparisonBundles, comparisons]
  );
  const comparisonBundlesLoading = comparisonBundles.some(query => query.isLoading);
  const comparisonBundlesError = comparisonBundles.find(query => query.error)?.error;

  if (comparisonBundlesLoading && comparisonsWithBundles.length === 0) {
    return (
      <div className="shrink-0 border-b border-border bg-card">
        <div className="px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline Delta
          </div>
        </div>
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          Loading timeline...
        </div>
      </div>
    );
  }

  if (comparisonBundlesError && comparisonsWithBundles.length === 0) {
    return (
      <div className="shrink-0 border-b border-border bg-card">
        <div className="px-4 py-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline Delta
          </div>
        </div>
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-destructive">
          Failed to load timeline
        </div>
      </div>
    );
  }

  return (
    <QueryDiffTimelineListContent
      baselineEngineId={baselineEngineId}
      baselineBundle={baselineBundle}
      comparisons={comparisonsWithBundles}
    />
  );
}

function QueryDiffTimelineListContent({
  baselineEngineId,
  baselineBundle,
  comparisons,
}: {
  baselineEngineId: string;
  baselineBundle: QueryBundle<EntityRef>;
  comparisons: QueryDiffTimelineListComparisonWithBundle[];
}) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const paletteTheme = isDark ? 'dark' : 'light';
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();
  const baselineTarget = useMemo(() => getTimelineTarget(baselineBundle), [baselineBundle]);
  const comparisonTargets = useMemo(
    () => comparisons.map(comparison => getTimelineTarget(comparison.comparisonBundle)),
    [comparisons]
  );
  const sharedResourceTypes = useMemo(
    () => getBaselineResourceTypesSharedWithComparisons(baselineTarget, comparisonTargets),
    [baselineTarget, comparisonTargets]
  );
  const [resourceType, setResourceType] = useState('');
  const [timelineView, setTimelineView] = useState<QueryDiffTimelineView>('overlay');
  const durationSeconds = Math.max(
    baselineBundle.duration_s,
    ...comparisons.map(comparison => comparison.comparisonBundle.duration_s)
  );
  const baselineName = baselineBundle.entities.query.instance_name ?? baselineBundle.query_id;
  const comparisonCountLabel =
    comparisons.length === 1 ? '1 comparison query' : `${comparisons.length} comparison queries`;
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: baselineBundle.query_id,
        comparisonQueryId: comparisons[0]?.comparisonQuery.id ?? '',
        theme: paletteTheme,
      }),
    [baselineBundle.query_id, comparisons, paletteTheme]
  );
  const diffPositiveColor = getDiffPositiveColor(paletteTheme);
  const diffNegativeColor = getDiffNegativeColor(paletteTheme);
  const diffColorScheme = getDiffDivergingColors(paletteTheme);

  useEffect(() => {
    if (sharedResourceTypes.length === 0) {
      setResourceType('');
      return;
    }
    setResourceType(prev => (sharedResourceTypes.includes(prev) ? prev : sharedResourceTypes[0]!));
  }, [sharedResourceTypes]);

  useEffect(() => {
    if (durationSeconds <= 0) return;
    const full = { start: 0, end: durationSeconds };
    setZoomRange(full);
    setDebouncedZoomRange(full);
  }, [durationSeconds, baselineBundle.query_id, setZoomRange, setDebouncedZoomRange]);

  const baselineRequest = useMemo(() => {
    if (!baselineTarget || !resourceType) return null;
    return buildRootTimelineRequest({
      queryId: baselineBundle.query_id,
      rootResourceGroupId: baselineTarget.rootResourceGroupId,
      resourceTypeName: resourceType,
      durationSeconds,
    });
  }, [baselineBundle.query_id, baselineTarget, durationSeconds, resourceType]);

  const baselineTimeline = useQuery({
    queryKey: [
      'queryDiffTimelineListBaseline',
      baselineEngineId,
      baselineBundle.query_id,
      baselineTarget?.rootResourceGroupId,
      baselineRequest,
    ],
    queryFn: () => fetchSingleTimeline(baselineEngineId, baselineRequest!, durationSeconds),
    enabled: Boolean(baselineRequest),
    staleTime: DEFAULT_STALE_TIME,
  });

  const baselineTimelineData = useMemo(() => {
    if (!baselineTimeline.data) return null;
    const resourceTypeDecl = baselineBundle.entities.resource_types[resourceType];
    const row = buildBinnedTimelineSeries(
      baselineTimeline.data.data,
      baselineTimeline.data.config,
      TIMELINE_START,
      paletteTheme,
      resourceTypeDecl?.capacities,
      baselineBundle.quantity_specs,
      baselineBundle.entities.fsm_types
    );
    return {
      ...row,
      series: recolorTimelineSeries(row.series, queryColors.baseline),
    };
  }, [
    baselineBundle.entities.fsm_types,
    baselineBundle.entities.resource_types,
    baselineBundle.quantity_specs,
    baselineTimeline.data,
    paletteTheme,
    queryColors.baseline,
    resourceType,
  ]);

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline Delta
          </div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <DataText className="max-w-48 truncate">{baselineName}</DataText>
            <span>vs</span>
            <span>{comparisonCountLabel}</span>
            {durationSeconds > 0 && <span>{formatDuration(durationSeconds * 1_000)}</span>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            role="group"
            aria-label="Timeline chart type"
            className="inline-flex h-7 shrink-0 items-center gap-0 rounded border border-border bg-background p-0.5"
          >
            {(['overlay', 'heatmap', 'line'] as const).map(view => {
              const isActive = timelineView === view;
              return (
                <Button
                  key={view}
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={isActive}
                  className={cn(
                    'h-6 rounded px-2 text-xs font-normal text-muted-foreground',
                    isActive && 'bg-muted font-semibold text-foreground shadow'
                  )}
                  onClick={() => setTimelineView(view)}
                >
                  {view === 'overlay' ? 'Overlay' : view === 'heatmap' ? 'Heatmap' : 'Line'}
                </Button>
              );
            })}
          </div>
          {comparisons.length > 0 && (
            <div className="hidden items-center gap-2 text-[11px] text-muted-foreground sm:flex shrink-0">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: diffNegativeColor }}
                />
                Comparison lower
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: diffPositiveColor }}
                />
                Comparison higher
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

      {!resourceType || !baselineTarget ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          No shared resource type available for timeline delta.
        </div>
      ) : baselineTimeline.isLoading ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          Loading timeline...
        </div>
      ) : baselineTimeline.isError || !baselineTimelineData ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-destructive">
          Failed to load timeline delta
        </div>
      ) : (
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
            label="Baseline"
            color={queryColors.baseline}
            detail={<DataText>{baselineName}</DataText>}
          >
            <Timeline
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={baselineTimelineData.timestamps}
              series={baselineTimelineData.series}
              showTooltip={false}
              isDark={isDark}
            />
          </TimelineLane>
          {timelineView === 'overlay' ? (
            comparisons.map(comparison => (
              <QueryDiffTimelinePairRows
                key={comparison.id}
                comparison={comparison}
                baselineEngineId={baselineEngineId}
                baselineQueryId={baselineBundle.query_id}
                baselineTarget={baselineTarget}
                resourceType={resourceType}
                durationSeconds={durationSeconds}
                positiveColor={diffPositiveColor}
                negativeColor={diffNegativeColor}
              />
            ))
          ) : (
            <QueryDiffTimelineHeatmapRows
              view={timelineView}
              baselineEngineId={baselineEngineId}
              baselineQueryId={baselineBundle.query_id}
              baselineBundle={baselineBundle}
              baselineTarget={baselineTarget}
              comparisons={comparisons}
              resourceType={resourceType}
              durationSeconds={durationSeconds}
              fallbackTimestamps={baselineTimelineData.timestamps}
              isDark={isDark}
              paletteTheme={paletteTheme}
              colorScheme={diffColorScheme}
              positiveColor={diffPositiveColor}
              negativeColor={diffNegativeColor}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function QueryDiffTimeline({
  baselineEngineId,
  comparisonEngineId,
  diff,
  baselineBundle,
  comparisonBundle,
  comparisonIndex = 0,
}: QueryDiffTimelineProps) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const paletteTheme = isDark ? 'dark' : 'light';
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();

  const baselineQuery = useMemo(() => bundleQuerySummary(baselineBundle), [baselineBundle]);
  const comparisonQuery = useMemo(
    () => diff.query ?? bundleQuerySummary(comparisonBundle),
    [comparisonBundle, diff.query]
  );
  const baselineQueryId = baselineQuery.id;
  const comparisonQueryId = comparisonQuery.id;
  const baselineName = querySummaryLabel(baselineQuery);
  const comparisonName = querySummaryLabel(comparisonQuery);
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId,
        comparisonQueryId,
        comparisonIndex,
        theme: paletteTheme,
      }),
    [baselineQueryId, comparisonIndex, comparisonQueryId, paletteTheme]
  );
  const diffPositiveColor = getDiffPositiveColor(paletteTheme);
  const diffNegativeColor = getDiffNegativeColor(paletteTheme);

  const baselineTarget = useMemo(() => getTimelineTarget(baselineBundle), [baselineBundle]);
  const comparisonTarget = useMemo(() => getTimelineTarget(comparisonBundle), [comparisonBundle]);
  const sharedResourceTypes = useMemo(
    () =>
      getSharedResourceTypes(
        baselineTarget?.resourceTypes ?? [],
        comparisonTarget?.resourceTypes ?? []
      ),
    [baselineTarget?.resourceTypes, comparisonTarget?.resourceTypes]
  );
  const [resourceType, setResourceType] = useState('');

  useEffect(() => {
    if (sharedResourceTypes.length === 0) {
      setResourceType('');
      return;
    }
    setResourceType(prev => (sharedResourceTypes.includes(prev) ? prev : sharedResourceTypes[0]!));
  }, [sharedResourceTypes]);

  const durationSeconds = Math.max(baselineBundle.duration_s, comparisonBundle.duration_s);

  useEffect(() => {
    if (durationSeconds <= 0) return;
    const full = { start: 0, end: durationSeconds };
    setZoomRange(full);
    setDebouncedZoomRange(full);
  }, [durationSeconds, baselineQueryId, comparisonQueryId, setZoomRange, setDebouncedZoomRange]);

  const baselineRequest = useMemo(() => {
    if (!baselineTarget || !resourceType) return null;
    return buildRootTimelineRequest({
      queryId: baselineBundle.query_id,
      rootResourceGroupId: baselineTarget.rootResourceGroupId,
      resourceTypeName: resourceType,
      durationSeconds,
    });
  }, [baselineBundle.query_id, baselineTarget, durationSeconds, resourceType]);

  const comparisonRequest = useMemo(() => {
    if (!comparisonTarget || !resourceType) return null;
    return buildRootTimelineRequest({
      queryId: comparisonBundle.query_id,
      rootResourceGroupId: comparisonTarget.rootResourceGroupId,
      resourceTypeName: resourceType,
      durationSeconds,
    });
  }, [comparisonBundle.query_id, comparisonTarget, durationSeconds, resourceType]);

  const timelineDiffRequest = useMemo<DiffTimelineRequest | null>(() => {
    if (!baselineRequest || !comparisonRequest || durationSeconds <= 0) return null;
    return {
      timelines: [
        { engine_id: baselineEngineId, timeline: baselineRequest },
        { engine_id: comparisonEngineId, timeline: comparisonRequest },
      ],
      delta_config: {
        num_bins: getAdaptiveNumBins(),
        start: 0,
        end: durationSeconds,
      },
    };
  }, [baselineEngineId, baselineRequest, comparisonEngineId, comparisonRequest, durationSeconds]);

  const timelineDiff = useQuery({
    queryKey: [
      'queryDiffTimeline',
      baselineEngineId,
      baselineQueryId,
      comparisonEngineId,
      comparisonQueryId,
      baselineTarget?.rootResourceGroupId,
      comparisonTarget?.rootResourceGroupId,
      timelineDiffRequest,
    ],
    queryFn: () => fetchQueryProfileDiffTimeline(timelineDiffRequest!),
    enabled: Boolean(timelineDiffRequest),
    staleTime: DEFAULT_STALE_TIME,
  });

  const comparison = useMemo(() => {
    if (!timelineDiff.data || durationSeconds <= 0) return null;
    const resourceTypeDecl =
      baselineBundle.entities.resource_types[resourceType] ??
      comparisonBundle.entities.resource_types[resourceType];
    return buildDiffTimelineData({
      timelineDiff: timelineDiff.data,
      theme: paletteTheme,
      capacities: resourceTypeDecl?.capacities,
      quantitySpecs: baselineBundle.quantity_specs ?? comparisonBundle.quantity_specs,
      fsmTypes: baselineBundle.entities.fsm_types ?? comparisonBundle.entities.fsm_types,
      queryColors,
    });
  }, [
    baselineBundle.entities.fsm_types,
    baselineBundle.entities.resource_types,
    baselineBundle.quantity_specs,
    comparisonBundle.entities.fsm_types,
    comparisonBundle.entities.resource_types,
    comparisonBundle.quantity_specs,
    durationSeconds,
    paletteTheme,
    queryColors,
    resourceType,
    timelineDiff.data,
  ]);

  const isLoading = Boolean(resourceType) && timelineDiff.isLoading;
  const hasError = timelineDiff.isError;
  const tooltipData = useMemo(() => {
    if (!comparison) return null;
    return {
      label: comparisonName,
      ...buildDiffHeatmapRowData(comparison),
    };
  }, [comparison, comparisonName]);

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
        <div className="min-w-0">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline Delta
          </div>
          <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
            <DataText className="max-w-48 truncate">{baselineName}</DataText>
            <Triangle
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-label="delta"
              role="img"
            />
            <DataText className="max-w-48 truncate">{comparisonName}</DataText>
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
                Comparison lower
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: diffPositiveColor }}
                />
                Comparison higher
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
      ) : !resourceType || !baselineTarget || !comparisonTarget ? (
        <div className="flex h-28 items-center justify-center border-t border-border text-xs text-muted-foreground">
          No shared resource type available for timeline delta.
        </div>
      ) : comparison && tooltipData ? (
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
            label="Baseline"
            color={queryColors.baseline}
            detail={<DataText>{baselineName}</DataText>}
          >
            <QueryDiffTimelineWithTooltip
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={comparison.baseline.timestamps}
              series={comparison.baseline.series}
              tooltipData={tooltipData}
              positiveColor={diffPositiveColor}
              negativeColor={diffNegativeColor}
              isDark={isDark}
            />
          </TimelineLane>
          <TimelineLane
            label="Comparison"
            color={queryColors.comparison}
            detail={<DataText>{comparisonName}</DataText>}
          >
            <QueryDiffTimelineWithTooltip
              startTime={TIMELINE_START}
              durationSeconds={durationSeconds}
              timestamps={comparison.comparisonWithDelta.timestamps}
              series={comparison.comparisonWithDelta.series}
              tooltipData={tooltipData}
              positiveColor={diffPositiveColor}
              negativeColor={diffNegativeColor}
              isDark={isDark}
            />
          </TimelineLane>
        </div>
      ) : null}
    </div>
  );
}

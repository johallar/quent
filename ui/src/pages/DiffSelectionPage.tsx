// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronDown, Plus, X } from 'lucide-react';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  queryProfileDiffQueryOptions,
  queryBundleQueryOptions,
  type DiffQuerySummary,
  type DiffRequest,
} from '@quent/client';
import type { Engine, Query, QueryGroup } from '@quent/utils';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@quent/components';
import { cn } from '@quent/utils';
import { QueryDiffTable } from '@/components/query-diff/QueryDiffTable';
import { QueryDiffOverviewStats } from '@/components/query-diff/QueryDiffStats';
import { QueryDiffTimelineList } from '@/components/query-diff/QueryDiffTimeline';
import { getQueryDiffQueryColors } from '@/components/query-diff/QueryDiffColors';
import { QueryDiffLegend, type QueryDiffLegendItem } from '@/components/query-diff/QueryDiffLegend';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

interface DiffSelectionPageProps {
  initialBaselineQueryId?: string;
  initialComparisonQueryIds?: readonly string[];
}

interface QuerySideState {
  engineId: string;
  groupId: string;
  queryId: string;
}

interface ComparisonQueryState extends QuerySideState {
  id: string;
}

interface QuerySelectorColumnProps {
  label: string;
  idPrefix: string;
  side: QuerySideState;
  engines: Engine[];
  queryGroups: QueryGroup[];
  queriesByGroup: Record<string, Query[]>;
  queriesLoading: boolean;
  action?: React.ReactNode;
  onEngineChange: (engineId: string) => void;
  onGroupChange: (groupId: string) => void;
  onQueryChange: (queryId: string) => void;
}

interface QueryLocation {
  engineId: string;
  groupId: string;
}

const COMPACT_SELECT_TRIGGER_CLASS =
  'h-7 min-w-0 rounded px-2 py-1 text-xs [&_svg]:h-3 [&_svg]:w-3';
const COMPACT_SELECT_ITEM_CLASS = 'py-1 pl-7 pr-2 text-xs';
const EMPTY_QUERY_GROUPS: QueryGroup[] = [];
const EMPTY_QUERIES_BY_GROUP: Record<string, Query[]> = {};

let pendingSelectionOpenAfterNavigation: boolean | null = null;
let nextComparisonId = 1;

function makeQuerySide(queryId = ''): QuerySideState {
  return { engineId: '', groupId: '', queryId };
}

function makeComparisonQuery(queryId = ''): ComparisonQueryState {
  return {
    id: `comparison-${nextComparisonId++}`,
    ...makeQuerySide(queryId),
  };
}

function makeComparisonQueries(queryIds: readonly string[] = []): ComparisonQueryState[] {
  const initialQueryIds = queryIds.length > 0 ? queryIds : [''];
  return initialQueryIds.map(queryId => makeComparisonQuery(queryId));
}

function toQuerySide(side: QuerySideState): QuerySideState {
  return {
    engineId: side.engineId,
    groupId: side.groupId,
    queryId: side.queryId,
  };
}

function isQuerySideComplete(side: QuerySideState): boolean {
  return Boolean(side.engineId && side.groupId && side.queryId);
}

function queryIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function parseComparisonQueryIds(comparisonQueryIds: string): string[] {
  return comparisonQueryIds
    .split(',')
    .map(queryId => queryId.trim())
    .filter(Boolean);
}

function formatComparisonQueryIds(comparisons: readonly QuerySideState[]): string {
  return comparisons
    .map(comparison => comparison.queryId)
    .filter(Boolean)
    .join(',');
}

function getInitialSelectionOpen(baselineQueryId: string, comparisonQueryIds: readonly string[]) {
  if (pendingSelectionOpenAfterNavigation !== null) {
    const selectionOpen = pendingSelectionOpenAfterNavigation;
    pendingSelectionOpenAfterNavigation = null;
    return selectionOpen;
  }
  return !(baselineQueryId && comparisonQueryIds.length > 0);
}

function findGroupForQuery(
  queryId: string,
  queriesByGroup: Record<string, Query[]>
): string | undefined {
  if (!queryId) return undefined;
  return Object.entries(queriesByGroup).find(([, queries]) =>
    queries.some(query => query.id === queryId)
  )?.[0];
}

function queryLabel(query: Query): string {
  return query.instance_name ?? query.id;
}

function engineLabel(engine: Engine): string {
  return engine.instance_name ?? engine.id;
}

function engineDisplayLabel(engineId: string, engines: Engine[], emptyLabel: string): string {
  if (!engineId) return emptyLabel;
  const engine = engines.find(item => item.id === engineId);
  return engine ? engineLabel(engine) : engineId;
}

function querySummaryFromBundle(bundle: {
  entities: {
    engine: { id: string; instance_name?: string | null };
    query_group: { id: string; instance_name?: string | null };
    query: { id: string; instance_name?: string | null };
  };
}): DiffQuerySummary {
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

function findQueryById(
  queryId: string,
  queriesByGroup: Record<string, Query[]>
): Query | undefined {
  if (!queryId) return undefined;
  return Object.values(queriesByGroup)
    .flat()
    .find(query => query.id === queryId);
}

function queryDisplayLabel(
  queryId: string,
  queriesByGroup: Record<string, Query[]>,
  emptyLabel: string
): string {
  if (!queryId) return emptyLabel;
  const query = findQueryById(queryId, queriesByGroup);
  return query ? queryLabel(query) : queryId;
}

function useQueryCatalog(engineId: string) {
  const { data: queryGroupsData, isLoading: queryGroupsLoading } = useQuery({
    queryKey: ['list_coordinators', engineId],
    queryFn: () => fetchListCoordinators(engineId),
    enabled: Boolean(engineId),
  });
  const queryGroups = queryGroupsData ?? EMPTY_QUERY_GROUPS;

  const { data: queriesByGroupData, isLoading: queriesLoading } = useQuery({
    queryKey: ['diff_queries_by_group', engineId, queryGroups.map(group => group.id).join('\0')],
    queryFn: async () => {
      const entries = await Promise.all(
        queryGroups.map(
          async group => [group.id, await fetchListQueries(engineId, group.id)] as const
        )
      );
      return Object.fromEntries(entries);
    },
    enabled: Boolean(engineId && queryGroups.length > 0),
  });
  const queriesByGroup = queriesByGroupData ?? EMPTY_QUERIES_BY_GROUP;

  return {
    queryGroups,
    queriesByGroup,
    queriesLoading: queryGroupsLoading || queriesLoading,
  };
}

function useQueryLocations(queryIds: string[], engines: Engine[]) {
  const uniqueQueryIds = useMemo(() => [...new Set(queryIds.filter(Boolean))], [queryIds]);
  const engineIds = useMemo(() => engines.map(engine => engine.id), [engines]);

  return useQuery({
    queryKey: ['diff_query_locations', engineIds.join('\0'), uniqueQueryIds.join('\0')],
    queryFn: async () => {
      const wantedQueryIds = new Set(uniqueQueryIds);
      const locations: Record<string, QueryLocation> = {};

      await Promise.all(
        engines.map(async engine => {
          const queryGroups = await fetchListCoordinators(engine.id);
          await Promise.all(
            queryGroups.map(async group => {
              const queries = await fetchListQueries(engine.id, group.id);
              for (const query of queries) {
                if (!wantedQueryIds.has(query.id) || locations[query.id]) continue;
                locations[query.id] = { engineId: engine.id, groupId: group.id };
              }
            })
          );
        })
      );

      return locations;
    },
    enabled: uniqueQueryIds.length > 0 && engines.length > 0,
  });
}

function QuerySelectorColumn({
  label,
  idPrefix,
  side,
  engines,
  queryGroups,
  queriesByGroup,
  queriesLoading,
  action,
  onEngineChange,
  onGroupChange,
  onQueryChange,
}: QuerySelectorColumnProps) {
  const queries = side.groupId ? (queriesByGroup[side.groupId] ?? []) : [];
  return (
    <div className="min-w-0 border border-border bg-card">
      <div className="flex min-h-9 items-center justify-between gap-2 border-b border-border px-3 py-1.5">
        <h2 className="text-xs font-semibold">{label}</h2>
        {action}
      </div>
      <div className="grid gap-2 p-2 sm:grid-cols-3">
        <div className="min-w-0">
          <label
            htmlFor={`${idPrefix}-engine`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Engine
          </label>
          <Select value={side.engineId} onValueChange={onEngineChange}>
            <SelectTrigger id={`${idPrefix}-engine`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Engine" />
            </SelectTrigger>
            <SelectContent>
              {engines.length === 0 ? (
                <SelectItem
                  value={`${label}-no-engines`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No engines
                </SelectItem>
              ) : (
                engines.map(engine => (
                  <SelectItem
                    key={engine.id}
                    value={engine.id}
                    className={COMPACT_SELECT_ITEM_CLASS}
                  >
                    <DataText>{engineLabel(engine)}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${idPrefix}-group`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Query Group
          </label>
          <Select
            value={side.groupId}
            onValueChange={onGroupChange}
            disabled={!side.engineId || queriesLoading}
          >
            <SelectTrigger id={`${idPrefix}-group`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Query Group" />
            </SelectTrigger>
            <SelectContent>
              {queryGroups.length === 0 ? (
                <SelectItem
                  value={`${label}-no-groups`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No query groups
                </SelectItem>
              ) : (
                queryGroups.map(group => (
                  <SelectItem key={group.id} value={group.id} className={COMPACT_SELECT_ITEM_CLASS}>
                    <DataText>{group.instance_name ?? group.id}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${idPrefix}-query`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Query
          </label>
          <Select
            value={side.queryId}
            onValueChange={onQueryChange}
            disabled={queriesLoading || !side.groupId}
          >
            <SelectTrigger id={`${idPrefix}-query`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Query" />
            </SelectTrigger>
            <SelectContent>
              {queries.length === 0 ? (
                <SelectItem
                  value={`${label}-no-queries`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No queries
                </SelectItem>
              ) : (
                queries.map(query => (
                  <SelectItem key={query.id} value={query.id} className={COMPACT_SELECT_ITEM_CLASS}>
                    <DataText>{queryLabel(query)}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

interface ComparisonQuerySelectorColumnProps {
  label: string;
  idPrefix: string;
  side: ComparisonQueryState;
  engines: Engine[];
  action?: React.ReactNode;
  onEngineChange: (engineId: string) => void;
  onGroupChange: (groupId: string) => void;
  onQueryChange: (queryId: string) => void;
}

function ComparisonQuerySelectorColumn({
  label,
  idPrefix,
  side,
  engines,
  action,
  onEngineChange,
  onGroupChange,
  onQueryChange,
}: ComparisonQuerySelectorColumnProps) {
  const catalog = useQueryCatalog(side.engineId);

  return (
    <QuerySelectorColumn
      label={label}
      idPrefix={idPrefix}
      side={side}
      engines={engines}
      queryGroups={catalog.queryGroups}
      queriesByGroup={catalog.queriesByGroup}
      queriesLoading={catalog.queriesLoading}
      action={action}
      onEngineChange={onEngineChange}
      onGroupChange={onGroupChange}
      onQueryChange={onQueryChange}
    />
  );
}

interface DiffDashboardProps {
  baselineQuery: QuerySideState;
  comparisonQueries: ComparisonQueryState[];
}

type DiffDashboardTab = 'overview' | 'operator' | 'timelines';

const DIFF_DASHBOARD_TABS: Array<{ id: DiffDashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'operator', label: 'Operator' },
  { id: 'timelines', label: 'Timelines' },
];

function DiffDashboard({ baselineQuery, comparisonQueries }: DiffDashboardProps) {
  const [activeTab, setActiveTab] = useState<DiffDashboardTab>('overview');
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const baselineBundle = useQuery({
    ...queryBundleQueryOptions({
      engineId: baselineQuery.engineId,
      queryId: baselineQuery.queryId,
    }),
    enabled: isQuerySideComplete(baselineQuery),
  });
  const comparisonBundles = useQueries({
    queries: comparisonQueries.map(comparisonQuery => ({
      ...queryBundleQueryOptions({
        engineId: comparisonQuery.engineId,
        queryId: comparisonQuery.queryId,
      }),
      enabled: isQuerySideComplete(baselineQuery) && isQuerySideComplete(comparisonQuery),
    })),
  });
  const diffRequest = useMemo<DiffRequest>(
    () => ({
      baseline_query: {
        engine_id: baselineQuery.engineId,
        query_id: baselineQuery.queryId,
      },
      comparison_queries: comparisonQueries.map(comparisonQuery => ({
        engine_id: comparisonQuery.engineId,
        query_id: comparisonQuery.queryId,
      })),
    }),
    [baselineQuery.engineId, baselineQuery.queryId, comparisonQueries]
  );
  const diffResponse = useQuery(queryProfileDiffQueryOptions({ request: diffRequest }));

  const comparisons = useMemo(
    () =>
      baselineBundle.data && diffResponse.data
        ? comparisonQueries.flatMap((comparisonSelection, index) => {
            const comparisonBundle = comparisonBundles[index]?.data;
            const diff = diffResponse.data.comparison_queries[index];
            if (!comparisonBundle || !diff) return [];
            const baselineQuerySummary = querySummaryFromBundle(baselineBundle.data);
            const comparisonQuerySummary = diff.query ?? querySummaryFromBundle(comparisonBundle);
            return [
              {
                id: comparisonSelection.id,
                comparisonIndex: index,
                comparisonSelection,
                baselineQuery: baselineQuerySummary,
                comparisonQuery: comparisonQuerySummary,
                diff,
                baselineBundle: baselineBundle.data,
                comparisonBundle,
              },
            ];
          })
        : [],
    [baselineBundle.data, comparisonBundles, comparisonQueries, diffResponse.data]
  );
  const legendItems = useMemo<QueryDiffLegendItem[]>(() => {
    if (!baselineBundle.data || comparisons.length === 0) return [];

    const baselineQueryEntity = baselineBundle.data.entities.query;
    const baselineColor = getQueryDiffQueryColors({
      baselineQueryId: baselineQueryEntity.id,
      comparisonQueryId: comparisons[0]?.comparisonQuery.id ?? '',
      theme: paletteTheme,
    }).baseline;

    return [
      {
        id: `baseline-${baselineQueryEntity.id}`,
        label: baselineQueryEntity.instance_name ?? baselineQueryEntity.id,
        color: baselineColor,
        roleLabel: 'Baseline',
      },
      ...comparisons.map((comparison, index) => {
        const queryColors = getQueryDiffQueryColors({
          baselineQueryId: baselineQueryEntity.id,
          comparisonQueryId: comparison.comparisonQuery.id,
          comparisonIndex: comparison.comparisonIndex,
          theme: paletteTheme,
        });

        return {
          id: `comparison-${comparison.id}`,
          label: querySummaryLabel(comparison.comparisonQuery),
          color: queryColors.comparison,
          roleLabel: `Comparison ${index + 1}`,
        };
      }),
    ];
  }, [baselineBundle.data, comparisons, paletteTheme]);
  const diffLoading =
    baselineBundle.isLoading ||
    comparisonBundles.some(query => query.isLoading) ||
    diffResponse.isLoading;
  const diffError =
    baselineBundle.error ??
    comparisonBundles.find(query => query.error)?.error ??
    diffResponse.error;
  const baselineLabel = baselineBundle.data?.entities.query.instance_name ?? baselineQuery.queryId;
  const comparisonCountLabel =
    comparisons.length === 1 ? '1 comparison query' : `${comparisons.length} comparison queries`;

  return (
    <section
      className={cn(
        'flex min-h-[34rem] flex-col overflow-hidden border border-border bg-background',
        'h-full min-h-0'
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold uppercase tracking-wide">Dashboard</span>
          <DataText className="max-w-56 truncate">{baselineLabel}</DataText>
          <span>vs</span>
          <span>{comparisonCountLabel}</span>
        </div>
        <QueryDiffLegend items={legendItems} className="ml-auto" />
      </div>
      {diffLoading ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading diff...
        </div>
      ) : diffError ? (
        <div className="flex h-full items-center justify-center text-sm text-destructive">
          Failed to load diff
        </div>
      ) : baselineBundle.data && comparisons.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            role="tablist"
            aria-label="Query diff sections"
            className="inline-flex h-9 shrink-0 items-center justify-center gap-0 border-b border-border bg-card p-1 text-muted-foreground"
          >
            {DIFF_DASHBOARD_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              return (
                <Button
                  key={tab.id}
                  id={`diff-${tab.id}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`diff-${tab.id}-panel`}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-7 rounded-md px-3 text-sm font-normal text-muted-foreground transition-all',
                    isActive && 'bg-muted font-semibold text-foreground shadow'
                  )}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </Button>
              );
            })}
          </div>

          <div
            id={`diff-${activeTab}-panel`}
            role="tabpanel"
            aria-labelledby={`diff-${activeTab}-tab`}
            className="min-h-0 flex-1"
          >
            {activeTab === 'overview' ? (
              <div className="flex h-full min-h-0 flex-col overflow-y-auto">
                <QueryDiffOverviewStats
                  comparisons={comparisons.map(comparison => ({
                    id: comparison.id,
                    baselineQuery: comparison.baselineQuery,
                    comparisonQuery: comparison.comparisonQuery,
                    diff: comparison.diff,
                    baselineBundle: comparison.baselineBundle,
                    comparisonBundle: comparison.comparisonBundle,
                    comparisonIndex: comparison.comparisonIndex,
                  }))}
                />
                <QueryDiffTimelineList
                  baselineEngineId={baselineQuery.engineId}
                  baselineBundle={baselineBundle.data}
                  comparisons={comparisons.map(comparison => ({
                    id: comparison.id,
                    comparisonIndex: comparison.comparisonIndex,
                    comparisonEngineId: comparison.comparisonSelection.engineId,
                    comparisonQuery: comparison.comparisonQuery,
                    diff: comparison.diff,
                    comparisonBundle: comparison.comparisonBundle,
                  }))}
                />
              </div>
            ) : activeTab === 'operator' ? (
              <div className="h-full min-h-0 bg-muted/20 p-3">
                <div className="mx-auto h-full min-h-0 w-full max-w-7xl overflow-hidden border border-border bg-background">
                  <QueryDiffTable
                    baselineQuery={comparisons[0].baselineQuery}
                    comparisons={comparisons.map(comparison => ({
                      id: comparison.id,
                      comparisonQuery: comparison.comparisonQuery,
                      diff: comparison.diff,
                    }))}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-y-auto">
                <QueryDiffTimelineList
                  baselineEngineId={baselineQuery.engineId}
                  baselineBundle={baselineBundle.data}
                  comparisons={comparisons.map(comparison => ({
                    id: comparison.id,
                    comparisonIndex: comparison.comparisonIndex,
                    comparisonEngineId: comparison.comparisonSelection.engineId,
                    comparisonQuery: comparison.comparisonQuery,
                    diff: comparison.diff,
                    comparisonBundle: comparison.comparisonBundle,
                  }))}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DiffSelectionPage({
  initialBaselineQueryId = '',
  initialComparisonQueryIds = [],
}: DiffSelectionPageProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const initialComparisonQueryIdsKey = initialComparisonQueryIds.join('\0');
  const resolvedInitialComparisonQueryIds = useMemo(
    () => (initialComparisonQueryIdsKey ? initialComparisonQueryIdsKey.split('\0') : []),
    [initialComparisonQueryIdsKey]
  );
  const [baselineQuery, setBaselineQuery] = useState<QuerySideState>(() =>
    makeQuerySide(initialBaselineQueryId)
  );
  const [comparisonQueries, setComparisonQueries] = useState<ComparisonQueryState[]>(() =>
    makeComparisonQueries(initialComparisonQueryIds)
  );
  const [selectionOpen, setSelectionOpen] = useState(() =>
    getInitialSelectionOpen(initialBaselineQueryId, initialComparisonQueryIds)
  );
  const primaryComparisonQuery = comparisonQueries.find(query => query.queryId) ??
    comparisonQueries[0] ?? {
      id: 'primary-comparison-query',
      ...makeQuerySide(),
    };

  const completeComparisonQueries = useMemo(
    () => comparisonQueries.filter(isQuerySideComplete),
    [comparisonQueries]
  );
  const diffableComparisonQueries = useMemo(
    () => completeComparisonQueries.filter(query => query.queryId !== baselineQuery.queryId),
    [baselineQuery.queryId, completeComparisonQueries]
  );
  const sameAsBaselineComparisonQueries = useMemo(
    () =>
      completeComparisonQueries.filter(
        query => Boolean(baselineQuery.queryId) && query.queryId === baselineQuery.queryId
      ),
    [baselineQuery.queryId, completeComparisonQueries]
  );

  useEffect(() => {
    setBaselineQuery(prev =>
      prev.queryId === initialBaselineQueryId ? prev : makeQuerySide(initialBaselineQueryId)
    );
    setComparisonQueries(prev => {
      const nextQueryIds = resolvedInitialComparisonQueryIds;
      const currentQueryIds = prev.map(query => query.queryId);
      if (queryIdsEqual(currentQueryIds, nextQueryIds)) {
        return prev.length > 0 ? prev : makeComparisonQueries(nextQueryIds);
      }

      return makeComparisonQueries(nextQueryIds).map((query, index) =>
        prev[index] ? { ...query, id: prev[index].id } : query
      );
    });
  }, [initialBaselineQueryId, resolvedInitialComparisonQueryIds]);

  const { data: engines = [] } = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });

  const unresolvedQueryIds = useMemo(
    () => [
      ...(baselineQuery.queryId && !baselineQuery.engineId ? [baselineQuery.queryId] : []),
      ...comparisonQueries.flatMap(query =>
        query.queryId && !query.engineId ? [query.queryId] : []
      ),
    ],
    [baselineQuery.engineId, baselineQuery.queryId, comparisonQueries]
  );
  const queryLocationResolution = useQueryLocations(unresolvedQueryIds, engines);

  const baselineCatalog = useQueryCatalog(baselineQuery.engineId);
  const primaryComparisonCatalog = useQueryCatalog(primaryComparisonQuery.engineId);

  useEffect(() => {
    const locations = queryLocationResolution.data;
    if (!locations) return;

    setBaselineQuery(prev => {
      if (!prev.queryId || prev.engineId) return prev;
      const location = locations[prev.queryId];
      return location ? { ...prev, engineId: location.engineId, groupId: location.groupId } : prev;
    });
    setComparisonQueries(prev =>
      prev.map(query => {
        if (!query.queryId || query.engineId) return query;
        const location = locations[query.queryId];
        return location
          ? { ...query, engineId: location.engineId, groupId: location.groupId }
          : query;
      })
    );
  }, [queryLocationResolution.data]);

  useEffect(() => {
    setBaselineQuery(prev => {
      if (prev.groupId || !prev.queryId) return prev;
      const groupId = findGroupForQuery(prev.queryId, baselineCatalog.queriesByGroup);
      return groupId ? { ...prev, groupId } : prev;
    });
  }, [baselineCatalog.queriesByGroup, baselineQuery.groupId, baselineQuery.queryId]);

  useEffect(() => {
    setComparisonQueries(prev =>
      prev.map((query, index) => {
        if (index !== 0 || query.groupId || !query.queryId) return query;
        const groupId = findGroupForQuery(query.queryId, primaryComparisonCatalog.queriesByGroup);
        return groupId && groupId !== query.groupId ? { ...query, groupId } : query;
      })
    );
  }, [
    primaryComparisonCatalog.queriesByGroup,
    primaryComparisonQuery.groupId,
    primaryComparisonQuery.queryId,
  ]);

  const baselineEngineSummary = useMemo(
    () => engineDisplayLabel(baselineQuery.engineId, engines, 'Select Engine'),
    [engines, baselineQuery.engineId]
  );
  const primaryComparisonEngineSummary = useMemo(
    () => engineDisplayLabel(primaryComparisonQuery.engineId, engines, 'Select Engine'),
    [engines, primaryComparisonQuery.engineId]
  );
  const baselineSummary = useMemo(
    () =>
      queryDisplayLabel(
        baselineQuery.queryId,
        baselineCatalog.queriesByGroup,
        'Select Baseline Query'
      ),
    [baselineCatalog.queriesByGroup, baselineQuery.queryId]
  );
  const primaryComparisonSummary = useMemo(
    () =>
      queryDisplayLabel(
        primaryComparisonQuery.queryId,
        primaryComparisonCatalog.queriesByGroup,
        'Select Comparison Query'
      ),
    [primaryComparisonCatalog.queriesByGroup, primaryComparisonQuery.queryId]
  );
  const comparisonSummary = useMemo(
    () =>
      completeComparisonQueries.length > 1
        ? `${completeComparisonQueries.length} comparison queries`
        : primaryComparisonSummary,
    [completeComparisonQueries.length, primaryComparisonSummary]
  );
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: baselineQuery.queryId,
        comparisonQueryId: primaryComparisonQuery.queryId,
        theme: paletteTheme,
      }),
    [baselineQuery.queryId, paletteTheme, primaryComparisonQuery.queryId]
  );
  const baselineComplete = isQuerySideComplete(baselineQuery);
  const hasDiffableComparisons = diffableComparisonQueries.length > 0;
  const hasSameAsBaselineComparisons = sameAsBaselineComparisonQueries.length > 0;

  const maybeNavigateToDiff = (
    nextBaseline: QuerySideState,
    nextComparisons: readonly QuerySideState[]
  ) => {
    const comparisonQueryIds = formatComparisonQueryIds(nextComparisons);
    if (!nextBaseline.queryId || !comparisonQueryIds) {
      return;
    }
    pendingSelectionOpenAfterNavigation = selectionOpen;
    navigate({
      to: '/diff/query/$baselineQueryId/compare/$comparisonQueryIds',
      params: {
        baselineQueryId: nextBaseline.queryId,
        comparisonQueryIds: comparisonQueryIds,
      },
    });
  };

  const handleBaselineEngineChange = (engineId: string) => {
    setSelectionOpen(true);
    setBaselineQuery({ engineId, groupId: '', queryId: '' });
  };

  const handleBaselineGroupChange = (groupId: string) => {
    setSelectionOpen(true);
    setBaselineQuery(prev => ({ ...prev, groupId, queryId: '' }));
  };

  const handleBaselineQueryChange = (queryId: string) => {
    const nextBaseline = { ...baselineQuery, queryId };
    setBaselineQuery(nextBaseline);
    maybeNavigateToDiff(nextBaseline, comparisonQueries);
  };

  const handleComparisonEngineChange = (comparisonId: string, engineId: string) => {
    setSelectionOpen(true);
    setComparisonQueries(prev =>
      prev.map(query =>
        query.id === comparisonId ? { ...query, engineId, groupId: '', queryId: '' } : query
      )
    );
  };

  const handleComparisonGroupChange = (comparisonId: string, groupId: string) => {
    setSelectionOpen(true);
    setComparisonQueries(prev =>
      prev.map(query => (query.id === comparisonId ? { ...query, groupId, queryId: '' } : query))
    );
  };

  const handleComparisonQueryChange = (comparisonId: string, queryId: string) => {
    const currentComparison = comparisonQueries.find(query => query.id === comparisonId);
    if (!currentComparison) return;

    const nextComparison = { ...currentComparison, queryId };
    const nextComparisons = comparisonQueries.map(query =>
      query.id === comparisonId ? nextComparison : query
    );
    setComparisonQueries(nextComparisons);
    maybeNavigateToDiff(baselineQuery, nextComparisons);
  };

  const handleAddComparisonQuery = () => {
    setSelectionOpen(true);
    setComparisonQueries(prev => [...prev, makeComparisonQuery()]);
  };

  const handleRemoveComparisonQuery = (comparisonId: string) => {
    const nextComparisons = comparisonQueries.filter(query => query.id !== comparisonId);
    if (nextComparisons.length === 0) return;

    setSelectionOpen(true);
    setComparisonQueries(nextComparisons);
    maybeNavigateToDiff(baselineQuery, nextComparisons);
  };

  const handleMakeBaseline = (comparisonId: string) => {
    const selectedComparison = comparisonQueries.find(query => query.id === comparisonId);
    if (!selectedComparison || !isQuerySideComplete(selectedComparison)) return;

    const nextBaseline = toQuerySide(selectedComparison);
    const nextComparison = { ...selectedComparison, ...baselineQuery };
    const nextComparisons = [
      nextComparison,
      ...comparisonQueries.filter(query => query.id !== comparisonId),
    ];
    setBaselineQuery(nextBaseline);
    setComparisonQueries(nextComparisons);
    maybeNavigateToDiff(nextBaseline, nextComparisons);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Collapsible
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        className="shrink-0 border-b border-border bg-card"
      >
        <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-2">
          <CollapsibleTrigger className="group flex max-w-full items-center justify-center gap-2 rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent/50">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">Query Diff</span>
            <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
              <DataText
                className="inline-block max-w-[18rem] truncate align-bottom"
                style={{ color: baselineQuery.queryId ? queryColors.baseline : undefined }}
              >
                {baselineQuery.engineId
                  ? `${baselineEngineSummary} / ${baselineSummary}`
                  : baselineSummary}
              </DataText>
              <span className="text-muted-foreground">vs</span>
              <DataText
                className="inline-block max-w-[18rem] truncate align-bottom"
                style={{
                  color:
                    primaryComparisonQuery.queryId && completeComparisonQueries.length <= 1
                      ? queryColors.comparison
                      : undefined,
                }}
              >
                {primaryComparisonQuery.engineId && completeComparisonQueries.length <= 1
                  ? `${primaryComparisonEngineSummary} / ${comparisonSummary}`
                  : comparisonSummary}
              </DataText>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden will-change-[height,opacity,transform] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="mx-auto w-full max-w-5xl px-4 pb-3">
            <div className="mx-auto grid w-full max-w-5xl items-center gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <div className="min-w-0 lg:self-center">
                <QuerySelectorColumn
                  label="Baseline Query"
                  idPrefix="baseline-query"
                  side={baselineQuery}
                  engines={engines}
                  queryGroups={baselineCatalog.queryGroups}
                  queriesByGroup={baselineCatalog.queriesByGroup}
                  queriesLoading={baselineCatalog.queriesLoading}
                  onEngineChange={handleBaselineEngineChange}
                  onGroupChange={handleBaselineGroupChange}
                  onQueryChange={handleBaselineQueryChange}
                />
              </div>
              <div className="flex justify-center lg:self-center" aria-hidden="true">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm">
                  <ArrowLeftRight className="h-4 w-4" />
                </div>
              </div>
              <div className="min-w-0 space-y-2">
                {comparisonQueries.map((comparisonQuery, index) => {
                  return (
                    <ComparisonQuerySelectorColumn
                      key={comparisonQuery.id}
                      label={`Comparison Query ${index + 1}`}
                      idPrefix={`comparison-query-${index + 1}`}
                      side={comparisonQuery}
                      engines={engines}
                      action={
                        <div className="flex items-center gap-1">
                          {isQuerySideComplete(comparisonQuery) && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => handleMakeBaseline(comparisonQuery.id)}
                            >
                              Make Baseline
                            </Button>
                          )}
                          {comparisonQueries.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 px-0 text-muted-foreground hover:text-foreground"
                              aria-label={`Remove Comparison Query ${index + 1}`}
                              title="Remove comparison"
                              onClick={() => handleRemoveComparisonQuery(comparisonQuery.id)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      }
                      onEngineChange={engineId =>
                        handleComparisonEngineChange(comparisonQuery.id, engineId)
                      }
                      onGroupChange={groupId =>
                        handleComparisonGroupChange(comparisonQuery.id, groupId)
                      }
                      onQueryChange={queryId =>
                        handleComparisonQueryChange(comparisonQuery.id, queryId)
                      }
                    />
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-sm text-xs"
                  onClick={handleAddComparisonQuery}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Comparison
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="min-h-0 flex-1 px-4 pb-4">
        <div
          className={cn(
            'h-full overflow-hidden border border-border bg-background',
            !hasDiffableComparisons && 'flex items-center justify-center'
          )}
        >
          {queryLocationResolution.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : !baselineQuery.engineId || !comparisonQueries.some(query => query.engineId) ? (
            <div className="text-sm text-muted-foreground">
              Select engines for Baseline Query and at least one comparison query.
            </div>
          ) : !baselineComplete || !hasDiffableComparisons ? (
            <div className="text-sm text-muted-foreground">
              {hasSameAsBaselineComparisons
                ? 'Choose comparison queries different from the baseline.'
                : 'Select Baseline Query and at least one comparison query.'}
            </div>
          ) : (
            <div className="h-full min-h-0 bg-muted/20 p-3">
              <div className="mx-auto h-full min-h-0 w-full max-w-7xl">
                <DiffDashboard
                  baselineQuery={baselineQuery}
                  comparisonQueries={diffableComparisonQueries}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

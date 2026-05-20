// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ChevronDown, Plus } from 'lucide-react';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  queryBundleQueryOptions,
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
import { buildQueryProfileDiffFromBundles } from '@/components/query-diff/queryProfileDiffFromBundles';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

interface DiffSelectionPageProps {
  initialBaselineQueryId?: string;
  initialCompetitorQueryIds?: readonly string[];
}

interface QuerySideState {
  engineId: string;
  groupId: string;
  queryId: string;
}

interface CompetitorQueryState extends QuerySideState {
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
let nextCompetitorId = 1;

function makeQuerySide(queryId = ''): QuerySideState {
  return { engineId: '', groupId: '', queryId };
}

function makeCompetitorQuery(queryId = ''): CompetitorQueryState {
  return {
    id: `competitor-${nextCompetitorId++}`,
    ...makeQuerySide(queryId),
  };
}

function makeCompetitorQueries(queryIds: readonly string[] = []): CompetitorQueryState[] {
  const initialQueryIds = queryIds.length > 0 ? queryIds : [''];
  return initialQueryIds.map(queryId => makeCompetitorQuery(queryId));
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

export function parseCompetitorQueryIds(competitorQueryIds: string): string[] {
  return competitorQueryIds
    .split(',')
    .map(queryId => queryId.trim())
    .filter(Boolean);
}

function formatCompetitorQueryIds(competitors: readonly QuerySideState[]): string {
  return competitors
    .map(competitor => competitor.queryId)
    .filter(Boolean)
    .join(',');
}

function getInitialSelectionOpen(baselineQueryId: string, competitorQueryIds: readonly string[]) {
  if (pendingSelectionOpenAfterNavigation !== null) {
    const selectionOpen = pendingSelectionOpenAfterNavigation;
    pendingSelectionOpenAfterNavigation = null;
    return selectionOpen;
  }
  return !(baselineQueryId && competitorQueryIds.length > 0);
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

interface CompetitorQuerySelectorColumnProps {
  label: string;
  idPrefix: string;
  side: CompetitorQueryState;
  engines: Engine[];
  action?: React.ReactNode;
  onEngineChange: (engineId: string) => void;
  onGroupChange: (groupId: string) => void;
  onQueryChange: (queryId: string) => void;
}

function CompetitorQuerySelectorColumn({
  label,
  idPrefix,
  side,
  engines,
  action,
  onEngineChange,
  onGroupChange,
  onQueryChange,
}: CompetitorQuerySelectorColumnProps) {
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
  competitorQueries: CompetitorQueryState[];
}

type DiffDashboardTab = 'overview' | 'operator' | 'timelines';

const DIFF_DASHBOARD_TABS: Array<{ id: DiffDashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'operator', label: 'Operator' },
  { id: 'timelines', label: 'Timelines' },
];

function DiffDashboard({ baselineQuery, competitorQueries }: DiffDashboardProps) {
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
  const competitorBundles = useQueries({
    queries: competitorQueries.map(competitorQuery => ({
      ...queryBundleQueryOptions({
        engineId: competitorQuery.engineId,
        queryId: competitorQuery.queryId,
      }),
      enabled: isQuerySideComplete(baselineQuery) && isQuerySideComplete(competitorQuery),
    })),
  });

  const comparisons = useMemo(
    () =>
      baselineBundle.data
        ? competitorQueries.flatMap((competitorQuery, index) => {
            const competitorBundle = competitorBundles[index]?.data;
            if (!competitorBundle) return [];
            const diff = buildQueryProfileDiffFromBundles(baselineBundle.data, competitorBundle);
            return [
              {
                id: competitorQuery.id,
                competitorIndex: index,
                competitorQuery,
                diff,
                baselineBundle: baselineBundle.data,
                competitorBundle,
              },
            ];
          })
        : [],
    [baselineBundle.data, competitorBundles, competitorQueries]
  );
  const legendItems = useMemo<QueryDiffLegendItem[]>(() => {
    if (!baselineBundle.data || comparisons.length === 0) return [];

    const baselineQueryEntity = baselineBundle.data.entities.query;
    const baselineColor = getQueryDiffQueryColors({
      baselineQueryId: baselineQueryEntity.id,
      competitorQueryId: comparisons[0]?.diff.query_b.id ?? '',
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
        const competitorQueryEntity = comparison.competitorBundle.entities.query;
        const queryColors = getQueryDiffQueryColors({
          baselineQueryId: baselineQueryEntity.id,
          competitorQueryId: competitorQueryEntity.id,
          competitorIndex: comparison.competitorIndex,
          theme: paletteTheme,
        });

        return {
          id: `comparison-${comparison.id}`,
          label: competitorQueryEntity.instance_name ?? competitorQueryEntity.id,
          color: queryColors.competitor,
          roleLabel: `Comparison ${index + 1}`,
        };
      }),
    ];
  }, [baselineBundle.data, comparisons, paletteTheme]);
  const diffLoading = baselineBundle.isLoading || competitorBundles.some(query => query.isLoading);
  const diffError = baselineBundle.error ?? competitorBundles.find(query => query.error)?.error;
  const baselineLabel = baselineBundle.data?.entities.query.instance_name ?? baselineQuery.queryId;
  const competitorCountLabel =
    comparisons.length === 1 ? '1 competitor query' : `${comparisons.length} competitor queries`;

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
          <span>{competitorCountLabel}</span>
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
                    diff: comparison.diff,
                    baselineBundle: comparison.baselineBundle,
                    competitorBundle: comparison.competitorBundle,
                    competitorIndex: comparison.competitorIndex,
                  }))}
                />
                <QueryDiffTimelineList
                  baselineEngineId={baselineQuery.engineId}
                  baselineBundle={baselineBundle.data}
                  comparisons={comparisons.map(comparison => ({
                    id: comparison.id,
                    competitorIndex: comparison.competitorIndex,
                    competitorEngineId: comparison.competitorQuery.engineId,
                    diff: comparison.diff,
                    competitorBundle: comparison.competitorBundle,
                  }))}
                />
              </div>
            ) : activeTab === 'operator' ? (
              <div className="h-full min-h-0 overflow-y-auto bg-muted/20 p-3">
                <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-3">
                  {comparisons.map((comparison, index) => (
                    <section
                      key={comparison.id}
                      className="flex min-h-[32rem] flex-col overflow-hidden border border-border bg-background"
                    >
                      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground">
                        <span className="font-semibold uppercase tracking-wide">
                          Competitor Query {index + 1}
                        </span>
                        <DataText className="max-w-56 truncate">
                          {comparison.diff.query_b.instance_name ?? comparison.diff.query_b.id}
                        </DataText>
                      </div>
                      <div className="min-h-0 flex-1">
                        <QueryDiffTable diff={comparison.diff} />
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-y-auto">
                <QueryDiffTimelineList
                  baselineEngineId={baselineQuery.engineId}
                  baselineBundle={baselineBundle.data}
                  comparisons={comparisons.map(comparison => ({
                    id: comparison.id,
                    competitorIndex: comparison.competitorIndex,
                    competitorEngineId: comparison.competitorQuery.engineId,
                    diff: comparison.diff,
                    competitorBundle: comparison.competitorBundle,
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
  initialCompetitorQueryIds = [],
}: DiffSelectionPageProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const initialCompetitorQueryIdsKey = initialCompetitorQueryIds.join('\0');
  const resolvedInitialCompetitorQueryIds = useMemo(
    () => (initialCompetitorQueryIdsKey ? initialCompetitorQueryIdsKey.split('\0') : []),
    [initialCompetitorQueryIdsKey]
  );
  const [baselineQuery, setBaselineQuery] = useState<QuerySideState>(() =>
    makeQuerySide(initialBaselineQueryId)
  );
  const [competitorQueries, setCompetitorQueries] = useState<CompetitorQueryState[]>(() =>
    makeCompetitorQueries(initialCompetitorQueryIds)
  );
  const [selectionOpen, setSelectionOpen] = useState(() =>
    getInitialSelectionOpen(initialBaselineQueryId, initialCompetitorQueryIds)
  );
  const primaryCompetitorQuery = competitorQueries.find(query => query.queryId) ??
    competitorQueries[0] ?? {
      id: 'primary-competitor-query',
      ...makeQuerySide(),
    };

  const completeCompetitorQueries = useMemo(
    () => competitorQueries.filter(isQuerySideComplete),
    [competitorQueries]
  );
  const diffableCompetitorQueries = useMemo(
    () => completeCompetitorQueries.filter(query => query.queryId !== baselineQuery.queryId),
    [baselineQuery.queryId, completeCompetitorQueries]
  );
  const sameAsBaselineCompetitorQueries = useMemo(
    () =>
      completeCompetitorQueries.filter(
        query => Boolean(baselineQuery.queryId) && query.queryId === baselineQuery.queryId
      ),
    [baselineQuery.queryId, completeCompetitorQueries]
  );

  useEffect(() => {
    setBaselineQuery(prev =>
      prev.queryId === initialBaselineQueryId ? prev : makeQuerySide(initialBaselineQueryId)
    );
    setCompetitorQueries(prev => {
      const nextQueryIds = resolvedInitialCompetitorQueryIds;
      const currentQueryIds = prev.map(query => query.queryId);
      if (queryIdsEqual(currentQueryIds, nextQueryIds)) {
        return prev.length > 0 ? prev : makeCompetitorQueries(nextQueryIds);
      }

      return makeCompetitorQueries(nextQueryIds).map((query, index) =>
        prev[index] ? { ...query, id: prev[index].id } : query
      );
    });
  }, [initialBaselineQueryId, resolvedInitialCompetitorQueryIds]);

  const { data: engines = [] } = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });

  const unresolvedQueryIds = useMemo(
    () => [
      ...(baselineQuery.queryId && !baselineQuery.engineId ? [baselineQuery.queryId] : []),
      ...competitorQueries.flatMap(query =>
        query.queryId && !query.engineId ? [query.queryId] : []
      ),
    ],
    [baselineQuery.engineId, baselineQuery.queryId, competitorQueries]
  );
  const queryLocationResolution = useQueryLocations(unresolvedQueryIds, engines);

  const baselineCatalog = useQueryCatalog(baselineQuery.engineId);
  const primaryCompetitorCatalog = useQueryCatalog(primaryCompetitorQuery.engineId);

  useEffect(() => {
    const locations = queryLocationResolution.data;
    if (!locations) return;

    setBaselineQuery(prev => {
      if (!prev.queryId || prev.engineId) return prev;
      const location = locations[prev.queryId];
      return location ? { ...prev, engineId: location.engineId, groupId: location.groupId } : prev;
    });
    setCompetitorQueries(prev =>
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
    setCompetitorQueries(prev =>
      prev.map((query, index) => {
        if (index !== 0 || query.groupId || !query.queryId) return query;
        const groupId = findGroupForQuery(query.queryId, primaryCompetitorCatalog.queriesByGroup);
        return groupId && groupId !== query.groupId ? { ...query, groupId } : query;
      })
    );
  }, [
    primaryCompetitorCatalog.queriesByGroup,
    primaryCompetitorQuery.groupId,
    primaryCompetitorQuery.queryId,
  ]);

  const baselineEngineSummary = useMemo(
    () => engineDisplayLabel(baselineQuery.engineId, engines, 'Select Engine'),
    [engines, baselineQuery.engineId]
  );
  const primaryCompetitorEngineSummary = useMemo(
    () => engineDisplayLabel(primaryCompetitorQuery.engineId, engines, 'Select Engine'),
    [engines, primaryCompetitorQuery.engineId]
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
  const primaryCompetitorSummary = useMemo(
    () =>
      queryDisplayLabel(
        primaryCompetitorQuery.queryId,
        primaryCompetitorCatalog.queriesByGroup,
        'Select Competitor Query'
      ),
    [primaryCompetitorCatalog.queriesByGroup, primaryCompetitorQuery.queryId]
  );
  const competitorSummary = useMemo(
    () =>
      completeCompetitorQueries.length > 1
        ? `${completeCompetitorQueries.length} competitor queries`
        : primaryCompetitorSummary,
    [completeCompetitorQueries.length, primaryCompetitorSummary]
  );
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: baselineQuery.queryId,
        competitorQueryId: primaryCompetitorQuery.queryId,
        theme: paletteTheme,
      }),
    [baselineQuery.queryId, paletteTheme, primaryCompetitorQuery.queryId]
  );
  const baselineComplete = isQuerySideComplete(baselineQuery);
  const hasDiffableCompetitors = diffableCompetitorQueries.length > 0;
  const hasSameAsBaselineCompetitors = sameAsBaselineCompetitorQueries.length > 0;

  const maybeNavigateToDiff = (
    nextBaseline: QuerySideState,
    nextCompetitors: readonly QuerySideState[]
  ) => {
    const competitorQueryIds = formatCompetitorQueryIds(nextCompetitors);
    if (!nextBaseline.queryId || !competitorQueryIds) {
      return;
    }
    pendingSelectionOpenAfterNavigation = selectionOpen;
    navigate({
      to: '/diff/query/$baselineQueryId/compare/$competitorQueryIds',
      params: {
        baselineQueryId: nextBaseline.queryId,
        competitorQueryIds: competitorQueryIds,
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
    maybeNavigateToDiff(nextBaseline, competitorQueries);
  };

  const handleCompetitorEngineChange = (competitorId: string, engineId: string) => {
    setSelectionOpen(true);
    setCompetitorQueries(prev =>
      prev.map(query =>
        query.id === competitorId ? { ...query, engineId, groupId: '', queryId: '' } : query
      )
    );
  };

  const handleCompetitorGroupChange = (competitorId: string, groupId: string) => {
    setSelectionOpen(true);
    setCompetitorQueries(prev =>
      prev.map(query => (query.id === competitorId ? { ...query, groupId, queryId: '' } : query))
    );
  };

  const handleCompetitorQueryChange = (competitorId: string, queryId: string) => {
    const currentCompetitor = competitorQueries.find(query => query.id === competitorId);
    if (!currentCompetitor) return;

    const nextCompetitor = { ...currentCompetitor, queryId };
    const nextCompetitors = competitorQueries.map(query =>
      query.id === competitorId ? nextCompetitor : query
    );
    setCompetitorQueries(nextCompetitors);
    maybeNavigateToDiff(baselineQuery, nextCompetitors);
  };

  const handleAddCompetitorQuery = () => {
    setSelectionOpen(true);
    setCompetitorQueries(prev => [...prev, makeCompetitorQuery()]);
  };

  const handleMakeBaseline = (competitorId: string) => {
    const selectedCompetitor = competitorQueries.find(query => query.id === competitorId);
    if (!selectedCompetitor || !isQuerySideComplete(selectedCompetitor)) return;

    const nextBaseline = toQuerySide(selectedCompetitor);
    const nextCompetitor = { ...selectedCompetitor, ...baselineQuery };
    const nextCompetitors = [
      nextCompetitor,
      ...competitorQueries.filter(query => query.id !== competitorId),
    ];
    setBaselineQuery(nextBaseline);
    setCompetitorQueries(nextCompetitors);
    maybeNavigateToDiff(nextBaseline, nextCompetitors);
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
                    primaryCompetitorQuery.queryId && completeCompetitorQueries.length <= 1
                      ? queryColors.competitor
                      : undefined,
                }}
              >
                {primaryCompetitorQuery.engineId && completeCompetitorQueries.length <= 1
                  ? `${primaryCompetitorEngineSummary} / ${competitorSummary}`
                  : competitorSummary}
              </DataText>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden will-change-[height,opacity,transform] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="mx-auto w-full max-w-5xl px-4 pb-3">
            <div className="mx-auto grid w-full max-w-5xl items-start gap-2 lg:grid-cols-2">
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
              <div className="min-w-0 space-y-2">
                {competitorQueries.map((competitorQuery, index) => {
                  return (
                    <CompetitorQuerySelectorColumn
                      key={competitorQuery.id}
                      label={`Competitor Query ${index + 1}`}
                      idPrefix={`competitor-query-${index + 1}`}
                      side={competitorQuery}
                      engines={engines}
                      action={
                        isQuerySideComplete(competitorQuery) ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-[11px]"
                            onClick={() => handleMakeBaseline(competitorQuery.id)}
                          >
                            Make Baseline
                          </Button>
                        ) : null
                      }
                      onEngineChange={engineId =>
                        handleCompetitorEngineChange(competitorQuery.id, engineId)
                      }
                      onGroupChange={groupId =>
                        handleCompetitorGroupChange(competitorQuery.id, groupId)
                      }
                      onQueryChange={queryId =>
                        handleCompetitorQueryChange(competitorQuery.id, queryId)
                      }
                    />
                  );
                })}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-full rounded-sm text-xs"
                  onClick={handleAddCompetitorQuery}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Competitor
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
            !hasDiffableCompetitors && 'flex items-center justify-center'
          )}
        >
          {queryLocationResolution.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : !baselineQuery.engineId || !competitorQueries.some(query => query.engineId) ? (
            <div className="text-sm text-muted-foreground">
              Select engines for Baseline Query and at least one competitor query.
            </div>
          ) : !baselineComplete || !hasDiffableCompetitors ? (
            <div className="text-sm text-muted-foreground">
              {hasSameAsBaselineCompetitors
                ? 'Choose competitor queries different from the baseline.'
                : 'Select Baseline Query and at least one competitor query.'}
            </div>
          ) : (
            <div className="h-full min-h-0 bg-muted/20 p-3">
              <div className="mx-auto h-full min-h-0 w-full max-w-7xl">
                <DiffDashboard
                  baselineQuery={baselineQuery}
                  competitorQueries={diffableCompetitorQueries}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

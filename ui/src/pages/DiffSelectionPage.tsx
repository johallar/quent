// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronDown, X } from 'lucide-react';
import {
  useQueryProfileDiff,
  queryBundleQueryOptions,
  type DiffQuerySummary,
  type DiffRequest,
} from '@quent/client';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataText,
} from '@quent/components';
import { cn } from '@quent/utils';
import { QueryDiffTable } from '@/components/query-diff/QueryDiffTable';
import { QueryDiffOverviewStats } from '@/components/query-diff/QueryDiffStats';
import { QueryDiffTimelineList } from '@/components/query-diff/QueryDiffTimeline';
import { getQueryDiffQueryColors } from '@/components/query-diff/QueryDiffColors';
import { QueryDiffLegend, type QueryDiffLegendItem } from '@/components/query-diff/QueryDiffLegend';
import { QueryPicker } from '@/components/query-diff/QueryPicker';
import {
  useAllQueriesIndex,
  type QueryPickerOption,
} from '@/components/query-diff/useAllQueriesIndex';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

interface DiffSelectionPageProps {
  initialBaselineQueryId?: string;
  initialComparisonQueryIds?: readonly string[];
}

let pendingSelectionOpenAfterNavigation: boolean | null = null;

export function parseComparisonQueryIds(comparisonQueryIds: string): string[] {
  return comparisonQueryIds
    .split(',')
    .map(queryId => queryId.trim())
    .filter(Boolean);
}

function formatComparisonQueryIds(comparisonQueryIds: readonly string[]): string {
  return comparisonQueryIds.filter(Boolean).join(',');
}

function dedupeQueryIds(queryIds: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of queryIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function queryIdsEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function getInitialSelectionOpen(baselineQueryId: string, comparisonQueryIds: readonly string[]) {
  if (pendingSelectionOpenAfterNavigation !== null) {
    const selectionOpen = pendingSelectionOpenAfterNavigation;
    pendingSelectionOpenAfterNavigation = null;
    return selectionOpen;
  }
  return !(baselineQueryId && comparisonQueryIds.length > 0);
}

function querySummaryFromOption(
  queryId: string,
  option: QueryPickerOption | undefined
): DiffQuerySummary {
  return {
    id: queryId,
    engine_id: option?.engineId ?? '',
    instance_name: option?.queryName ?? null,
    query_group_id: option?.groupId ?? null,
    query_group_name: option?.groupName ?? null,
  };
}

function querySummaryLabel(query: DiffQuerySummary): string {
  return query.instance_name ?? query.id;
}

interface DiffDashboardProps {
  baselineEngineId: string;
  baselineQueryId: string;
  comparisons: ReadonlyArray<{ engineId: string; queryId: string }>;
  optionsByQueryId: Map<string, QueryPickerOption>;
}

type DiffDashboardTab = 'overview' | 'operator' | 'timelines';

const DIFF_DASHBOARD_TABS: Array<{ id: DiffDashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'operator', label: 'Operator' },
  { id: 'timelines', label: 'Timelines' },
];

function DiffDashboard({
  baselineEngineId,
  baselineQueryId,
  comparisons,
  optionsByQueryId,
}: DiffDashboardProps) {
  const [activeTab, setActiveTab] = useState<DiffDashboardTab>('overview');
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const baselineBundle = useQuery({
    ...queryBundleQueryOptions({ engineId: baselineEngineId, queryId: baselineQueryId }),
    enabled: Boolean(baselineEngineId && baselineQueryId),
  });
  const diffRequest = useMemo<DiffRequest>(
    () => ({
      baseline_query: { engine_id: baselineEngineId, query_id: baselineQueryId },
      comparison_queries: comparisons.map(c => ({ engine_id: c.engineId, query_id: c.queryId })),
    }),
    [baselineEngineId, baselineQueryId, comparisons]
  );
  const diffResponse = useQueryProfileDiff({ request: diffRequest });

  const comparisonRows = useMemo(
    () =>
      diffResponse.data
        ? comparisons.flatMap((selection, index) => {
            const diff = diffResponse.data.comparison_queries[index];
            if (!diff) return [];
            const baselineQuerySummary = baselineBundle.data
              ? {
                  id: baselineBundle.data.entities.query.id,
                  engine_id: baselineBundle.data.entities.engine.id,
                  instance_name: baselineBundle.data.entities.query.instance_name ?? null,
                  query_group_id: baselineBundle.data.entities.query_group.id,
                  query_group_name: baselineBundle.data.entities.query_group.instance_name ?? null,
                }
              : querySummaryFromOption(baselineQueryId, optionsByQueryId.get(baselineQueryId));
            return [
              {
                id: `comparison-${selection.queryId}-${index}`,
                comparisonIndex: index,
                comparisonEngineId: selection.engineId,
                baselineQuery: baselineQuerySummary,
                comparisonQuery:
                  diff.query ??
                  querySummaryFromOption(
                    selection.queryId,
                    optionsByQueryId.get(selection.queryId)
                  ),
                diff,
              },
            ];
          })
        : [],
    [baselineBundle.data, baselineQueryId, comparisons, diffResponse.data, optionsByQueryId]
  );
  const legendItems = useMemo<QueryDiffLegendItem[]>(() => {
    if (comparisonRows.length === 0) return [];
    const baselineQuerySummary = comparisonRows[0]!.baselineQuery;
    const baselineColor = getQueryDiffQueryColors({
      baselineQueryId: baselineQuerySummary.id,
      comparisonQueryId: comparisonRows[0]?.comparisonQuery.id ?? '',
      theme: paletteTheme,
    }).baseline;

    return [
      {
        id: `baseline-${baselineQuerySummary.id}`,
        label: querySummaryLabel(baselineQuerySummary),
        color: baselineColor,
        roleLabel: 'Baseline',
      },
      ...comparisonRows.map((row, index) => {
        const colors = getQueryDiffQueryColors({
          baselineQueryId: baselineQuerySummary.id,
          comparisonQueryId: row.comparisonQuery.id,
          comparisonIndex: row.comparisonIndex,
          theme: paletteTheme,
        });
        return {
          id: `comparison-${row.id}`,
          label: querySummaryLabel(row.comparisonQuery),
          color: colors.comparison,
          roleLabel: `Comparison ${index + 1}`,
        };
      }),
    ];
  }, [comparisonRows, paletteTheme]);
  const diffLoading = baselineBundle.isLoading || diffResponse.isLoading;
  const diffError = baselineBundle.error ?? diffResponse.error;
  const baselineLabel =
    comparisonRows[0]?.baselineQuery.instance_name ??
    baselineBundle.data?.entities.query.instance_name ??
    optionsByQueryId.get(baselineQueryId)?.queryName ??
    baselineQueryId;
  const comparisonCountLabel =
    comparisonRows.length === 1
      ? '1 comparison query'
      : `${comparisonRows.length} comparison queries`;

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
      ) : comparisonRows.length > 0 ? (
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
                  comparisons={comparisonRows.map(row => ({
                    id: row.id,
                    baselineQuery: row.baselineQuery,
                    comparisonQuery: row.comparisonQuery,
                    diff: row.diff,
                    comparisonIndex: row.comparisonIndex,
                  }))}
                />
                {baselineBundle.data ? (
                  <QueryDiffTimelineList
                    baselineEngineId={baselineEngineId}
                    baselineBundle={baselineBundle.data}
                    comparisons={comparisonRows.map(row => ({
                      id: row.id,
                      comparisonIndex: row.comparisonIndex,
                      comparisonEngineId: row.comparisonEngineId,
                      comparisonQuery: row.comparisonQuery,
                      diff: row.diff,
                    }))}
                  />
                ) : null}
              </div>
            ) : activeTab === 'operator' ? (
              <div className="h-full min-h-0 bg-muted/20 p-3">
                <div className="mx-auto h-full min-h-0 w-full max-w-7xl overflow-hidden border border-border bg-background">
                  <QueryDiffTable
                    baselineQuery={comparisonRows[0].baselineQuery}
                    comparisons={comparisonRows.map(row => ({
                      id: row.id,
                      comparisonQuery: row.comparisonQuery,
                      diff: row.diff,
                    }))}
                  />
                </div>
              </div>
            ) : (
              <div className="h-full min-h-0 overflow-y-auto">
                {baselineBundle.data ? (
                  <QueryDiffTimelineList
                    baselineEngineId={baselineEngineId}
                    baselineBundle={baselineBundle.data}
                    comparisons={comparisonRows.map(row => ({
                      id: row.id,
                      comparisonIndex: row.comparisonIndex,
                      comparisonEngineId: row.comparisonEngineId,
                      comparisonQuery: row.comparisonQuery,
                      diff: row.diff,
                    }))}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    Loading timeline...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface ComparisonChipProps {
  option: QueryPickerOption | undefined;
  queryId: string;
  color: string | undefined;
  onMakeBaseline: () => void;
  onRemove: () => void;
}

function ComparisonChip({ option, queryId, color, onMakeBaseline, onRemove }: ComparisonChipProps) {
  const label = option ? `${option.engineName} / ${option.queryName}` : queryId;
  return (
    <span className="inline-flex h-7 max-w-full items-center gap-1 rounded-sm border border-border bg-card pl-2 pr-0.5 text-xs">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <DataText className="max-w-[18rem] truncate" style={{ color }}>
        {label}
      </DataText>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-5 w-5 px-0 text-muted-foreground hover:text-foreground"
        aria-label={`Make ${label} the baseline`}
        title="Make baseline"
        onClick={onMakeBaseline}
      >
        <ArrowLeftRight className="h-3 w-3" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-5 w-5 px-0 text-muted-foreground hover:text-foreground"
        aria-label={`Remove ${label}`}
        title="Remove comparison"
        onClick={onRemove}
      >
        <X className="h-3 w-3" />
      </Button>
    </span>
  );
}

export function DiffSelectionPage({
  initialBaselineQueryId = '',
  initialComparisonQueryIds = [],
}: DiffSelectionPageProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const initialComparisonKey = initialComparisonQueryIds.join('\0');
  const resolvedInitialComparisonQueryIds = useMemo(
    () => (initialComparisonKey ? initialComparisonKey.split('\0') : []),
    [initialComparisonKey]
  );

  const [baselineQueryId, setBaselineQueryId] = useState(initialBaselineQueryId);
  const [comparisonQueryIds, setComparisonQueryIds] = useState<string[]>(() =>
    dedupeQueryIds(initialComparisonQueryIds)
  );
  const [selectionOpen, setSelectionOpen] = useState(() =>
    getInitialSelectionOpen(initialBaselineQueryId, initialComparisonQueryIds)
  );

  useEffect(() => {
    setBaselineQueryId(prev => (prev === initialBaselineQueryId ? prev : initialBaselineQueryId));
    setComparisonQueryIds(prev => {
      const next = dedupeQueryIds(resolvedInitialComparisonQueryIds);
      return queryIdsEqual(prev, next) ? prev : next;
    });
  }, [initialBaselineQueryId, resolvedInitialComparisonQueryIds]);

  const { options, optionsByQueryId, isLoading: indexLoading } = useAllQueriesIndex();

  const baselineOption = baselineQueryId ? optionsByQueryId.get(baselineQueryId) : undefined;
  const diffableComparisonQueryIds = useMemo(
    () => comparisonQueryIds.filter(queryId => queryId && queryId !== baselineQueryId),
    [comparisonQueryIds, baselineQueryId]
  );
  const sameAsBaselineCount = comparisonQueryIds.filter(
    queryId => Boolean(baselineQueryId) && queryId === baselineQueryId
  ).length;
  const resolvedComparisons = useMemo(
    () =>
      diffableComparisonQueryIds.flatMap(queryId => {
        const option = optionsByQueryId.get(queryId);
        return option ? [{ queryId, engineId: option.engineId }] : [];
      }),
    [diffableComparisonQueryIds, optionsByQueryId]
  );

  const baselineColor = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId,
        comparisonQueryId: comparisonQueryIds[0] ?? '',
        theme: paletteTheme,
      }).baseline,
    [baselineQueryId, comparisonQueryIds, paletteTheme]
  );

  const navigateForSelection = (nextBaseline: string, nextComparisons: readonly string[]) => {
    pendingSelectionOpenAfterNavigation = selectionOpen;
    const diffable = nextComparisons.filter(queryId => queryId && queryId !== nextBaseline);
    if (nextBaseline && diffable.length > 0) {
      navigate({
        to: '/diff/query/$baselineQueryId/compare/$comparisonQueryIds',
        params: {
          baselineQueryId: nextBaseline,
          comparisonQueryIds: formatComparisonQueryIds(diffable),
        },
      });
      return;
    }
    if (nextBaseline) {
      navigate({
        to: '/diff/query/$baselineQueryId',
        params: { baselineQueryId: nextBaseline },
      });
      return;
    }
    navigate({ to: '/diff' });
  };

  const handleBaselineChange = (queryIds: string[]) => {
    const nextBaseline = queryIds[0] ?? '';
    const nextComparisons = comparisonQueryIds.filter(id => id !== nextBaseline);
    setBaselineQueryId(nextBaseline);
    setComparisonQueryIds(nextComparisons);
    navigateForSelection(nextBaseline, nextComparisons);
  };

  const handleComparisonChange = (queryIds: string[]) => {
    const nextComparisons = dedupeQueryIds(queryIds);
    setComparisonQueryIds(nextComparisons);
    navigateForSelection(baselineQueryId, nextComparisons);
  };

  const handleRemoveComparison = (queryId: string) => {
    const nextComparisons = comparisonQueryIds.filter(id => id !== queryId);
    setComparisonQueryIds(nextComparisons);
    navigateForSelection(baselineQueryId, nextComparisons);
  };

  const handleMakeBaseline = (queryId: string) => {
    if (!queryId) return;
    const previousBaseline = baselineQueryId;
    const withoutNewBaseline = comparisonQueryIds.filter(id => id !== queryId);
    const nextComparisons = previousBaseline
      ? dedupeQueryIds([previousBaseline, ...withoutNewBaseline])
      : withoutNewBaseline;
    setBaselineQueryId(queryId);
    setComparisonQueryIds(nextComparisons);
    navigateForSelection(queryId, nextComparisons);
  };

  const baselineSummary = baselineOption?.queryName ?? baselineQueryId ?? 'Select Baseline Query';
  const baselineEngineSummary = baselineOption?.engineName ?? '';
  const comparisonSummary =
    diffableComparisonQueryIds.length === 0
      ? 'Select Comparison Queries'
      : diffableComparisonQueryIds.length === 1
        ? (optionsByQueryId.get(diffableComparisonQueryIds[0])?.queryName ??
          diffableComparisonQueryIds[0])
        : `${diffableComparisonQueryIds.length} comparison queries`;

  const baselineComplete = Boolean(baselineQueryId && baselineOption);
  const hasDiffableComparisons = resolvedComparisons.length > 0;
  const awaitingIndex =
    indexLoading &&
    ((baselineQueryId && !baselineOption) ||
      diffableComparisonQueryIds.some(id => !optionsByQueryId.get(id)));

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
                style={{ color: baselineQueryId ? baselineColor : undefined }}
              >
                {baselineEngineSummary
                  ? `${baselineEngineSummary} / ${baselineSummary}`
                  : baselineSummary}
              </DataText>
              <span className="text-muted-foreground">vs</span>
              <DataText className="inline-block max-w-[18rem] truncate align-bottom">
                {comparisonSummary}
              </DataText>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden will-change-[height,opacity,transform] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="mx-auto w-full max-w-3xl space-y-3 px-4 pb-3">
            <div className="space-y-1.5">
              <label
                htmlFor="diff-baseline-picker"
                className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Baseline Query
              </label>
              <QueryPicker
                id="diff-baseline-picker"
                mode="single"
                options={options}
                loading={indexLoading}
                selectedQueryIds={baselineQueryId ? [baselineQueryId] : []}
                triggerPlaceholder="Select Baseline Query"
                ariaLabel="Baseline Query"
                onChange={handleBaselineChange}
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="diff-comparison-picker"
                className="block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Comparison Queries
              </label>
              <QueryPicker
                id="diff-comparison-picker"
                mode="multi"
                options={options}
                loading={indexLoading}
                selectedQueryIds={comparisonQueryIds}
                disabledQueryIds={baselineQueryId ? [baselineQueryId] : []}
                triggerPlaceholder="Add Comparison Queries"
                ariaLabel="Comparison Queries"
                onChange={handleComparisonChange}
              />
              {comparisonQueryIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {comparisonQueryIds.map((queryId, index) => {
                    const option = optionsByQueryId.get(queryId);
                    const isDiffable = queryId !== baselineQueryId;
                    const color = isDiffable
                      ? getQueryDiffQueryColors({
                          baselineQueryId,
                          comparisonQueryId: queryId,
                          comparisonIndex: index,
                          theme: paletteTheme,
                        }).comparison
                      : undefined;
                    return (
                      <ComparisonChip
                        key={queryId}
                        option={option}
                        queryId={queryId}
                        color={color}
                        onMakeBaseline={() => handleMakeBaseline(queryId)}
                        onRemove={() => handleRemoveComparison(queryId)}
                      />
                    );
                  })}
                </div>
              )}
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
          {awaitingIndex ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : !baselineComplete ? (
            <div className="text-sm text-muted-foreground">
              Select Baseline Query and at least one comparison query.
            </div>
          ) : !hasDiffableComparisons ? (
            <div className="text-sm text-muted-foreground">
              {sameAsBaselineCount > 0
                ? 'Choose comparison queries different from the baseline.'
                : 'Select Baseline Query and at least one comparison query.'}
            </div>
          ) : (
            <div className="h-full min-h-0 bg-muted/20 p-3">
              <div className="mx-auto h-full min-h-0 w-full max-w-7xl">
                <DiffDashboard
                  baselineEngineId={baselineOption!.engineId}
                  baselineQueryId={baselineQueryId}
                  comparisons={resolvedComparisons}
                  optionsByQueryId={optionsByQueryId}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  useQueryProfileDiff,
  queryBundleQueryOptions,
  type DiffQuerySummary,
  type DiffRequest,
  type QueryDiff,
} from '@quent/client';
import { Button, DataText } from '@quent/components';
import { cn } from '@quent/utils';
import { getQueryDiffQueryColors } from './QueryDiffColors';
import { QueryDiffLegend, type QueryDiffLegendItem } from './QueryDiffLegend';
import { QueryDiffOverviewStats } from './QueryDiffStats';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

/** Map from queryId to a DiffQuerySummary used for labels/colors before the bundle resolves. */
export type QuerySummaryLookup = (queryId: string) => DiffQuerySummary;

export interface DiffComparisonRow {
  id: string;
  comparisonIndex: number;
  comparisonEngineId: string;
  baselineQuery: DiffQuerySummary;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
}

interface DiffDashboardProps {
  baselineEngineId: string;
  baselineQueryId: string;
  comparisons: ReadonlyArray<{ engineId: string; queryId: string }>;
  /** Optional summary lookup used while the baseline bundle and diff are loading. */
  resolveSummary?: QuerySummaryLookup;
}

type DiffDashboardTab = 'overview' | 'operator' | 'timelines';

const DIFF_DASHBOARD_TABS: Array<{ id: DiffDashboardTab; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'operator', label: 'Operator' },
  { id: 'timelines', label: 'Timelines' },
];

function querySummaryLabel(query: DiffQuerySummary): string {
  return query.instance_name ?? query.id;
}

function defaultSummary(queryId: string, engineId: string): DiffQuerySummary {
  return {
    id: queryId,
    engine_id: engineId,
    instance_name: null,
    query_group_id: null,
    query_group_name: null,
  };
}

function TabPlaceholder({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function DiffDashboard({
  baselineEngineId,
  baselineQueryId,
  comparisons,
  resolveSummary,
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

  const resolve = useMemo<QuerySummaryLookup>(
    () =>
      resolveSummary ??
      ((queryId: string) =>
        defaultSummary(
          queryId,
          comparisons.find(c => c.queryId === queryId)?.engineId ?? baselineEngineId
        )),
    [baselineEngineId, comparisons, resolveSummary]
  );

  const comparisonRows = useMemo<DiffComparisonRow[]>(
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
              : resolve(baselineQueryId);
            return [
              {
                id: `comparison-${selection.queryId}-${index}`,
                comparisonIndex: index,
                comparisonEngineId: selection.engineId,
                baselineQuery: baselineQuerySummary,
                comparisonQuery: diff.query ?? resolve(selection.queryId),
                diff,
              },
            ];
          })
        : [],
    [baselineBundle.data, baselineQueryId, comparisons, diffResponse.data, resolve]
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
    resolve(baselineQueryId).instance_name ??
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
              </div>
            ) : activeTab === 'operator' ? (
              <TabPlaceholder message="Operator diff table coming soon." />
            ) : (
              <TabPlaceholder message="Timeline diff coming soon." />
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

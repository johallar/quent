// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { ArrowLeftRight, ChevronDown, X } from 'lucide-react';
import type { DiffQuerySummary } from '@quent/client';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataText,
} from '@quent/components';
import { cn } from '@quent/utils';
import { DiffDashboard, type QuerySummaryLookup } from '@/components/query-diff/DiffDashboard';
import { getQueryDiffQueryColors } from '@/components/query-diff/QueryDiffColors';
import { QueryPicker } from '@/components/query-diff/QueryPicker';
import {
  useAllQueriesIndex,
  type QueryPickerOption,
} from '@/components/query-diff/useAllQueriesIndex';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

interface DiffPageProps {
  initialBaselineQueryId?: string;
  initialComparisonQueryIds?: readonly string[];
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

export function DiffPage({
  initialBaselineQueryId = '',
  initialComparisonQueryIds = [],
}: DiffPageProps) {
  const navigate = useNavigate({ from: '/diff' });
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
  const [selectionOpen, setSelectionOpen] = useState(
    () => !(initialBaselineQueryId && initialComparisonQueryIds.length > 0)
  );

  useEffect(() => {
    setBaselineQueryId(prev => (prev === initialBaselineQueryId ? prev : initialBaselineQueryId));
    setComparisonQueryIds(prev => {
      const next = dedupeQueryIds(resolvedInitialComparisonQueryIds);
      return queryIdsEqual(prev, next) ? prev : next;
    });
  }, [initialBaselineQueryId, resolvedInitialComparisonQueryIds]);

  const { options, optionsByQueryId, isLoading: indexLoading } = useAllQueriesIndex();
  const resolveSummary = useMemo<QuerySummaryLookup>(
    () => (queryId: string) => querySummaryFromOption(queryId, optionsByQueryId.get(queryId)),
    [optionsByQueryId]
  );

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

  const navigateForSelection = useCallback(
    (nextBaseline: string, nextComparisons: readonly string[]) => {
      const diffable = nextComparisons.filter(queryId => queryId && queryId !== nextBaseline);
      navigate({
        to: '/diff',
        search: {
          ...(nextBaseline ? { baseline: nextBaseline } : {}),
          ...(diffable.length > 0 ? { compare: [...diffable] } : {}),
        },
        replace: true,
      });
    },
    [navigate]
  );

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

  const baselineSummary = baselineOption?.queryName || baselineQueryId || 'Select Baseline Query';
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
        <div className="mx-auto flex w-full max-w-6xl items-center justify-center gap-1 px-4 py-2">
          <span className="shrink-0 text-xs font-semibold text-muted-foreground">Diff</span>
          <CollapsibleTrigger className="group flex min-w-0 max-w-full items-center justify-center gap-2 rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent/50">
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
          <div className="mx-auto w-full max-w-5xl space-y-2 px-4 pb-3">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              </div>
            </div>
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
                  resolveSummary={resolveSummary}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

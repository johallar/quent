// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Search, Triangle } from 'lucide-react';
import type { DiffQuerySummary, QueryDiff } from '@quent/client';
import {
  Button,
  DataText,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  StatisticCard,
  StatisticMiniBarChart,
  formatStatValue,
  type StatisticCardComparison,
  type StatisticMiniBarChartRow,
} from '@quent/components';
import { cn, type EntityRef, type PaletteTheme, type QueryBundle } from '@quent/utils';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import {
  getDiffNegativeColor,
  getDiffPositiveColor,
  getQueryDiffOperatorTypeColor,
  getQueryDiffQueryColors,
  type QueryDiffQueryColors,
} from './QueryDiffColors';
import {
  buildOperatorTypeRuntimeComparisons,
  buildRuntimeComparisonFromDelta,
  formatDurationSeconds,
  formatPercentDelta,
  formatSignedDurationSeconds,
  getDefaultOperatorDiffStatName,
  getOperatorDiffStatNames,
  type OperatorTypeRuntimeComparison,
  type RuntimeComparison,
} from './QueryDiffStats.utils';

interface QueryDiffStatsProps {
  baselineQuery: DiffQuerySummary;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
  baselineBundle: QueryBundle<EntityRef>;
  comparisonBundle: QueryBundle<EntityRef>;
  comparisonIndex?: number;
}

export interface QueryDiffStatsOverviewComparison {
  id: string;
  baselineQuery: DiffQuerySummary;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
  baselineBundle: QueryBundle<EntityRef>;
  comparisonBundle: QueryBundle<EntityRef>;
  comparisonIndex: number;
}

function runtimeValueStyle(delta: number, paletteTheme: PaletteTheme): CSSProperties | undefined {
  if (delta > 0) return { color: getDiffPositiveColor(paletteTheme) };
  if (delta < 0) return { color: getDiffNegativeColor(paletteTheme) };
  return undefined;
}

function displayDelta(delta: number): number {
  return delta === 0 || Object.is(delta, -0) ? 0 : -delta;
}

function displayPercentDelta(percentDelta: number | null): number | null {
  if (percentDelta === null) return null;
  return percentDelta === 0 || Object.is(percentDelta, -0) ? 0 : -percentDelta;
}

function runtimeComparisons({
  comparison,
  baselineName,
  comparisonName,
  queryColors,
}: {
  comparison: RuntimeComparison;
  baselineName: string;
  comparisonName: string;
  queryColors: QueryDiffQueryColors;
}): StatisticCardComparison[] {
  return [
    {
      id: 'baseline',
      label: baselineName,
      value: formatDurationSeconds(comparison.a),
      color: queryColors.baseline,
    },
    {
      id: 'comparison',
      label: comparisonName,
      value: formatDurationSeconds(comparison.b),
      color: queryColors.comparison,
    },
  ];
}

function RuntimeComparisonCard({
  comparison,
  baselineName,
  comparisonName,
  queryColors,
  paletteTheme,
}: {
  comparison: RuntimeComparison;
  baselineName: string;
  comparisonName: string;
  queryColors: QueryDiffQueryColors;
  paletteTheme: PaletteTheme;
}) {
  const displayedDelta = displayDelta(comparison.delta);
  return (
    <StatisticCard
      title="Total Run Time"
      value={formatSignedDurationSeconds(displayedDelta)}
      valueStyle={runtimeValueStyle(displayedDelta, paletteTheme)}
      secondaryValue={formatPercentDelta(displayPercentDelta(comparison.percentDelta))}
      comparisons={runtimeComparisons({
        comparison,
        baselineName,
        comparisonName,
        queryColors,
      })}
      comparisonSeparator={
        <Triangle
          className="h-3 w-3 shrink-0 text-muted-foreground"
          aria-label="delta"
          role="img"
        />
      }
    />
  );
}

function formatOperatorChartValue(value: number, statName: string): string {
  return statName === 'duration_s'
    ? formatDurationSeconds(value)
    : formatStatValue(value, statName);
}

function resolveOperatorStat(statNames: string[], requestedStat: string): string | null {
  return statNames.includes(requestedStat)
    ? requestedStat
    : getDefaultOperatorDiffStatName(statNames);
}

function OperatorStatSelect({
  statNames,
  value,
  onValueChange,
}: {
  statNames: string[];
  value: string;
  onValueChange: (statName: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filteredStatNames = useMemo(() => {
    if (!search) return statNames;
    const needle = search.toLowerCase();
    return statNames.filter(statName => statName.toLowerCase().includes(needle));
  }, [search, statNames]);

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground">Stat</span>
      <Popover
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="h-7 min-w-40 justify-between gap-2 px-2 text-xs font-normal"
          >
            <DataText className="truncate">{value}</DataText>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="center" side="bottom">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="h-7 pl-7 pr-2 text-xs md:text-xs"
              placeholder="Search stats..."
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
          </div>
          <div role="listbox" className="max-h-52 space-y-0.5 overflow-y-auto">
            {filteredStatNames.map(statName => {
              const selected = statName === value;
              return (
                <button
                  key={statName}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onValueChange(statName);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-left text-xs font-mono outline-none',
                    'transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                    selected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Check
                    className={cn('size-3 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                    strokeWidth={3}
                  />
                  <span className="truncate">{statName}</span>
                </button>
              );
            })}
            {filteredStatNames.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">No stats found</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function OperatorStatChart({
  rows,
  statNames,
  selectedStat,
  onSelectedStatChange,
}: {
  rows: StatisticMiniBarChartRow[];
  statNames: string[];
  selectedStat: string;
  onSelectedStatChange: (statName: string) => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <OperatorStatSelect
        statNames={statNames}
        value={selectedStat}
        onValueChange={onSelectedStatChange}
      />
      <StatisticMiniBarChart
        rows={rows}
        maxRows={rows.length}
        className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]"
      />
    </div>
  );
}

function operatorRuntimeChartRows(
  comparisons: OperatorTypeRuntimeComparison[],
  queryColors: QueryDiffQueryColors,
  statName: string
): StatisticMiniBarChartRow[] {
  return comparisons.map(comparison => ({
    id: comparison.id,
    label: comparison.label,
    labelColor: getQueryDiffOperatorTypeColor(comparison.id),
    title: formatOperatorChartValue(Math.max(comparison.a, comparison.b), statName),
    bars: [
      {
        id: 'baseline',
        value: comparison.a,
        color: queryColors.baseline,
        label: 'Baseline value',
      },
      {
        id: 'comparison',
        value: comparison.b,
        color: queryColors.comparison,
        label: 'Comparison value',
      },
    ],
  }));
}

function aggregateOperatorRuntimeChartRows({
  comparisons,
  paletteTheme,
  statName,
}: {
  comparisons: QueryDiffStatsOverviewComparison[];
  paletteTheme: PaletteTheme;
  statName: string;
}): StatisticMiniBarChartRow[] {
  const rowsByOperatorType = new Map<
    string,
    {
      label: string;
      baselineValue: number;
      comparisonBars: Array<{ id: string; value: number; color: string; label: string }>;
    }
  >();

  for (const comparison of comparisons) {
    const operatorComparisons = buildOperatorTypeRuntimeComparisons(comparison.diff, statName);
    const comparisonName =
      comparison.comparisonQuery.instance_name ?? comparison.comparisonQuery.id;
    const queryColors = getQueryDiffQueryColors({
      baselineQueryId: comparison.baselineQuery.id,
      comparisonQueryId: comparison.comparisonQuery.id,
      comparisonIndex: comparison.comparisonIndex,
      theme: paletteTheme,
    });

    for (const operatorComparison of operatorComparisons) {
      const row = rowsByOperatorType.get(operatorComparison.id) ?? {
        label: operatorComparison.label,
        baselineValue: operatorComparison.a,
        comparisonBars: [],
      };
      row.baselineValue = Math.max(row.baselineValue, operatorComparison.a);
      row.comparisonBars.push({
        id: comparison.id,
        value: operatorComparison.b,
        color: queryColors.comparison,
        label: `${comparisonName} value`,
      });
      rowsByOperatorType.set(operatorComparison.id, row);
    }
  }

  return [...rowsByOperatorType.entries()]
    .map(([operatorType, row]) => ({
      id: operatorType,
      label: row.label,
      labelColor: getQueryDiffOperatorTypeColor(operatorType),
      title: formatOperatorChartValue(
        Math.max(row.baselineValue, ...row.comparisonBars.map(bar => bar.value)),
        statName
      ),
      bars: [
        {
          id: 'baseline',
          value: row.baselineValue,
          color: getQueryDiffQueryColors({
            baselineQueryId: comparisons[0]?.baselineQuery.id ?? '',
            comparisonQueryId: comparisons[0]?.comparisonQuery.id ?? '',
            theme: paletteTheme,
          }).baseline,
          label: 'Baseline value',
        },
        ...row.comparisonBars,
      ],
    }))
    .sort((left, right) => {
      const leftMax = Math.max(...left.bars.map(bar => bar.value));
      const rightMax = Math.max(...right.bars.map(bar => bar.value));
      return rightMax - leftMax;
    });
}

export function QueryDiffStats({
  baselineQuery,
  comparisonQuery,
  diff,
  baselineBundle,
  comparisonBundle,
  comparisonIndex = 0,
}: QueryDiffStatsProps) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const baselineName = baselineQuery.instance_name ?? baselineQuery.id;
  const comparisonName = comparisonQuery.instance_name ?? comparisonQuery.id;
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: baselineQuery.id,
        comparisonQueryId: comparisonQuery.id,
        comparisonIndex,
        theme: paletteTheme,
      }),
    [baselineQuery.id, comparisonQuery.id, comparisonIndex, paletteTheme]
  );
  const operatorStatNames = useMemo(() => getOperatorDiffStatNames([diff]), [diff]);
  const [requestedOperatorStat, setRequestedOperatorStat] = useState('duration_s');
  const selectedOperatorStat = useMemo(
    () => resolveOperatorStat(operatorStatNames, requestedOperatorStat),
    [operatorStatNames, requestedOperatorStat]
  );
  const operatorRuntimeComparisons = useMemo(
    () =>
      selectedOperatorStat ? buildOperatorTypeRuntimeComparisons(diff, selectedOperatorStat) : [],
    [diff, selectedOperatorStat]
  );
  const totalRuntimeComparison = useMemo(
    () =>
      buildRuntimeComparisonFromDelta(
        diff.stat_diffs?.duration,
        baselineBundle.duration_s,
        comparisonBundle.duration_s
      ),
    [baselineBundle.duration_s, comparisonBundle.duration_s, diff.stat_diffs?.duration]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0 lg:grid-cols-2">
        <RuntimeComparisonCard
          comparison={totalRuntimeComparison}
          baselineName={baselineName}
          comparisonName={comparisonName}
          queryColors={queryColors}
          paletteTheme={paletteTheme}
        />
        {selectedOperatorStat && operatorRuntimeComparisons.length > 0 && (
          <StatisticCard
            title="Operator Run Time"
            chart={
              <OperatorStatChart
                rows={operatorRuntimeChartRows(
                  operatorRuntimeComparisons,
                  queryColors,
                  selectedOperatorStat
                )}
                statNames={operatorStatNames}
                selectedStat={selectedOperatorStat}
                onSelectedStatChange={setRequestedOperatorStat}
              />
            }
          />
        )}
      </div>
    </div>
  );
}

export function QueryDiffOverviewStats({
  comparisons,
}: {
  comparisons: QueryDiffStatsOverviewComparison[];
}) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const operatorStatNames = useMemo(
    () => getOperatorDiffStatNames(comparisons.map(comparison => comparison.diff)),
    [comparisons]
  );
  const [requestedOperatorStat, setRequestedOperatorStat] = useState('duration_s');
  const selectedOperatorStat = useMemo(
    () => resolveOperatorStat(operatorStatNames, requestedOperatorStat),
    [operatorStatNames, requestedOperatorStat]
  );

  const totalRuntimeComparisons = useMemo(
    () =>
      comparisons.map(comparison => ({
        ...comparison,
        baselineName: comparison.baselineQuery.instance_name ?? comparison.baselineQuery.id,
        comparisonName: comparison.comparisonQuery.instance_name ?? comparison.comparisonQuery.id,
        runtimeComparison: buildRuntimeComparisonFromDelta(
          comparison.diff.stat_diffs?.duration,
          comparison.baselineBundle.duration_s,
          comparison.comparisonBundle.duration_s
        ),
        queryColors: getQueryDiffQueryColors({
          baselineQueryId: comparison.baselineQuery.id,
          comparisonQueryId: comparison.comparisonQuery.id,
          comparisonIndex: comparison.comparisonIndex,
          theme: paletteTheme,
        }),
      })),
    [comparisons, paletteTheme]
  );
  const operatorRuntimeRows = useMemo(
    () =>
      selectedOperatorStat
        ? aggregateOperatorRuntimeChartRows({
            comparisons,
            paletteTheme,
            statName: selectedOperatorStat,
          })
        : [],
    [comparisons, paletteTheme, selectedOperatorStat]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
        {totalRuntimeComparisons.map(comparison => (
          <RuntimeComparisonCard
            key={comparison.id}
            comparison={comparison.runtimeComparison}
            baselineName={comparison.baselineName}
            comparisonName={comparison.comparisonName}
            queryColors={comparison.queryColors}
            paletteTheme={paletteTheme}
          />
        ))}
        {selectedOperatorStat && operatorRuntimeRows.length > 0 && (
          <StatisticCard
            title="Operator Run Time"
            chart={
              <OperatorStatChart
                rows={operatorRuntimeRows}
                statNames={operatorStatNames}
                selectedStat={selectedOperatorStat}
                onSelectedStatChange={setRequestedOperatorStat}
              />
            }
          />
        )}
      </div>
    </div>
  );
}

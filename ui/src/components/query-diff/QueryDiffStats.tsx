// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type CSSProperties } from 'react';
import { Triangle } from 'lucide-react';
import type { DiffQuerySummary, QueryDiff } from '@quent/client';
import {
  MultiStatStackedBarChart,
  NumberComparisonCard,
  StatisticCard,
  formatStatValue,
  type StatisticMiniBarChartBar,
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

function relativeValueStyle(
  value: number | null,
  paletteTheme: PaletteTheme
): CSSProperties | undefined {
  return value === null ? undefined : runtimeValueStyle(value, paletteTheme);
}

function displayDelta(delta: number): number {
  return delta === 0 || Object.is(delta, -0) ? 0 : -delta;
}

function displayPercentDelta(percentDelta: number | null): number | null {
  if (percentDelta === null) return null;
  return percentDelta === 0 || Object.is(percentDelta, -0) ? 0 : -percentDelta;
}

function runtimeComparisonSeparator() {
  return (
    <Triangle className="h-3 w-3 shrink-0 text-muted-foreground" aria-label="delta" role="img" />
  );
}

function RuntimeNumberComparisonCard({
  comparison,
  baselineName,
  comparisonName,
  queryColors,
  paletteTheme,
  className,
}: {
  comparison: RuntimeComparison;
  baselineName: string;
  comparisonName: string;
  queryColors: QueryDiffQueryColors;
  paletteTheme: PaletteTheme;
  className?: string;
}) {
  const displayedDelta = displayDelta(comparison.delta);
  return (
    <NumberComparisonCard
      title="Total Run Time"
      baselineLabel={baselineName}
      comparisonLabel={comparisonName}
      baselineValue={comparison.a}
      comparisonValue={comparison.b}
      deltaValue={displayedDelta}
      percentDelta={displayPercentDelta(comparison.percentDelta)}
      baselineColor={queryColors.baseline}
      comparisonColor={queryColors.comparison}
      formatValue={formatDurationSeconds}
      formatDeltaValue={formatSignedDurationSeconds}
      formatPercentDelta={formatPercentDelta}
      valueStyle={runtimeValueStyle(displayedDelta, paletteTheme)}
      className={className}
      comparisonSeparator={runtimeComparisonSeparator()}
    />
  );
}

function formatOperatorChartValue(value: number, statName: string): string {
  return statName === 'duration_s'
    ? formatDurationSeconds(value)
    : formatStatValue(value, statName);
}

function formatOperatorChartDeltaValue(value: number, statName: string): string {
  if (statName === 'duration_s') return formatSignedDurationSeconds(value);
  if (value === 0 || Object.is(value, -0)) return formatStatValue(0, statName);
  const formattedValue = formatStatValue(Math.abs(value), statName);
  return value > 0 ? `+${formattedValue}` : `-${formattedValue}`;
}

function queryLabel(query: DiffQuerySummary): string {
  return query.instance_name ?? query.id;
}

function queryTooltipDetails(query: DiffQuerySummary): StatisticMiniBarChartBar['details'] {
  const engineLabel = query.engine_name ?? query.engine_id;
  const queryGroupLabel = query.query_group_name ?? query.query_group_id;

  return [
    { id: 'engine', label: 'Engine', value: engineLabel },
    ...(queryGroupLabel
      ? [{ id: 'query-group', label: 'Query group', value: queryGroupLabel }]
      : []),
  ];
}

function resolveOperatorStat(statNames: string[], requestedStat: string): string | null {
  return statNames.includes(requestedStat)
    ? requestedStat
    : getDefaultOperatorDiffStatName(statNames);
}

function getOverviewStatColumnCount(statCardCount: number): number {
  if (statCardCount <= 0) return 1;
  return statCardCount <= 5 ? statCardCount : 3;
}

function overviewRuntimeCardClassName(index: number, statCardCount: number): string {
  const columnCount = getOverviewStatColumnCount(statCardCount);
  const isEndOfRow = (index + 1) % columnCount === 0 || index === statCardCount - 1;
  return cn(isEndOfRow && 'border-r-0');
}

function operatorRuntimeChartRows(
  comparisons: OperatorTypeRuntimeComparison[],
  queryColors: QueryDiffQueryColors,
  statName: string,
  baselineQuery: DiffQuerySummary,
  comparisonQuery: DiffQuerySummary
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
        label: queryLabel(baselineQuery),
        details: queryTooltipDetails(baselineQuery),
      },
      {
        id: 'comparison',
        value: comparison.b,
        color: queryColors.comparison,
        label: queryLabel(comparisonQuery),
        details: queryTooltipDetails(comparisonQuery),
        deltaValue: displayDelta(comparison.delta),
        percentDelta: displayPercentDelta(comparison.percentDelta),
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
      comparisonBars: StatisticMiniBarChartRow['bars'];
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
        label: comparisonName,
        details: queryTooltipDetails(comparison.comparisonQuery),
        deltaValue: displayDelta(operatorComparison.delta),
        percentDelta: displayPercentDelta(operatorComparison.percentDelta),
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
          label: comparisons[0]?.baselineQuery
            ? queryLabel(comparisons[0].baselineQuery)
            : 'Baseline',
          details: comparisons[0]?.baselineQuery
            ? queryTooltipDetails(comparisons[0].baselineQuery)
            : undefined,
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
        <RuntimeNumberComparisonCard
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
              <MultiStatStackedBarChart
                rows={operatorRuntimeChartRows(
                  operatorRuntimeComparisons,
                  queryColors,
                  selectedOperatorStat,
                  baselineQuery,
                  comparisonQuery
                )}
                statNames={operatorStatNames}
                selectedStat={selectedOperatorStat}
                onSelectedStatChange={setRequestedOperatorStat}
                formatValue={value => formatOperatorChartValue(value, selectedOperatorStat)}
                formatDeltaValue={value =>
                  formatOperatorChartDeltaValue(value, selectedOperatorStat)
                }
                formatPercentDelta={formatPercentDelta}
                getRelativeValueStyle={value => relativeValueStyle(value, paletteTheme)}
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
  const hasOperatorRuntimeChart = Boolean(selectedOperatorStat && operatorRuntimeRows.length > 0);
  const overviewGridStyle = useMemo<CSSProperties>(
    () => ({
      gridTemplateColumns: `repeat(${getOverviewStatColumnCount(totalRuntimeComparisons.length)}, minmax(0, 1fr))`,
    }),
    [totalRuntimeComparisons.length]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0" style={overviewGridStyle}>
        {totalRuntimeComparisons.map((comparison, index) => (
          <RuntimeNumberComparisonCard
            key={comparison.id}
            comparison={comparison.runtimeComparison}
            baselineName={comparison.baselineName}
            comparisonName={comparison.comparisonName}
            queryColors={comparison.queryColors}
            paletteTheme={paletteTheme}
            className={overviewRuntimeCardClassName(index, totalRuntimeComparisons.length)}
          />
        ))}
        {hasOperatorRuntimeChart && selectedOperatorStat && (
          <StatisticCard
            title="Operator Summary"
            className="col-span-full border-r-0 border-t border-border"
            chart={
              <MultiStatStackedBarChart
                rows={operatorRuntimeRows}
                statNames={operatorStatNames}
                selectedStat={selectedOperatorStat}
                onSelectedStatChange={setRequestedOperatorStat}
                formatValue={value => formatOperatorChartValue(value, selectedOperatorStat)}
                formatDeltaValue={value =>
                  formatOperatorChartDeltaValue(value, selectedOperatorStat)
                }
                formatPercentDelta={formatPercentDelta}
                getRelativeValueStyle={value => relativeValueStyle(value, paletteTheme)}
              />
            }
          />
        )}
      </div>
    </div>
  );
}

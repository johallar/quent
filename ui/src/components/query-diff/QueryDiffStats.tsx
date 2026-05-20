// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type CSSProperties } from 'react';
import { Triangle } from 'lucide-react';
import type { QueryProfileDiffResponse } from '@quent/client';
import {
  DataText,
  StatisticCard,
  StatisticMiniBarChart,
  type StatisticCardComparison,
  type StatisticMiniBarChartRow,
} from '@quent/components';
import type { EntityRef, PaletteTheme, QueryBundle } from '@quent/utils';
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
  buildRuntimeComparison,
  formatDurationSeconds,
  formatPercentDelta,
  formatSignedDurationSeconds,
  type OperatorTypeRuntimeComparison,
  type RuntimeComparison,
} from './QueryDiffStats.utils';

interface QueryDiffStatsProps {
  diff: QueryProfileDiffResponse;
  baselineBundle: QueryBundle<EntityRef>;
  competitorBundle: QueryBundle<EntityRef>;
  competitorIndex?: number;
}

export interface QueryDiffStatsOverviewComparison {
  id: string;
  diff: QueryProfileDiffResponse;
  baselineBundle: QueryBundle<EntityRef>;
  competitorBundle: QueryBundle<EntityRef>;
  competitorIndex: number;
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
  competitorName,
  queryColors,
}: {
  comparison: RuntimeComparison;
  baselineName: string;
  competitorName: string;
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
      id: 'competitor',
      label: competitorName,
      value: formatDurationSeconds(comparison.b),
      color: queryColors.competitor,
    },
  ];
}

function RuntimeComparisonCard({
  comparison,
  baselineName,
  competitorName,
  queryColors,
  paletteTheme,
}: {
  comparison: RuntimeComparison;
  baselineName: string;
  competitorName: string;
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
        competitorName,
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

function operatorRuntimeChartRows(
  comparisons: OperatorTypeRuntimeComparison[],
  queryColors: QueryDiffQueryColors
): StatisticMiniBarChartRow[] {
  return comparisons.map(comparison => ({
    id: comparison.id,
    label: comparison.label,
    labelColor: getQueryDiffOperatorTypeColor(comparison.id),
    title: formatDurationSeconds(Math.max(comparison.a, comparison.b)),
    bars: [
      {
        id: 'baseline',
        value: comparison.a,
        color: queryColors.baseline,
        label: 'Baseline value',
      },
      {
        id: 'competitor',
        value: comparison.b,
        color: queryColors.competitor,
        label: 'Competitor value',
      },
    ],
  }));
}

function operatorRuntimeLegend({
  baselineName,
  competitors,
  queryColors,
}: {
  baselineName: string;
  competitors: Array<{ id: string; name: string; color: string }>;
  queryColors: QueryDiffQueryColors;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 gap-y-1">
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className="h-2 w-2 shrink-0" style={{ backgroundColor: queryColors.baseline }} />
        <DataText className="max-w-32 truncate">{baselineName}</DataText>
      </span>
      {competitors.map(competitor => (
        <span key={competitor.id} className="inline-flex min-w-0 items-center gap-1">
          <span className="h-2 w-2 shrink-0" style={{ backgroundColor: competitor.color }} />
          <DataText className="max-w-32 truncate">{competitor.name}</DataText>
        </span>
      ))}
    </div>
  );
}

function aggregateOperatorRuntimeChartRows({
  comparisons,
  paletteTheme,
}: {
  comparisons: QueryDiffStatsOverviewComparison[];
  paletteTheme: PaletteTheme;
}): StatisticMiniBarChartRow[] {
  const rowsByOperatorType = new Map<
    string,
    {
      label: string;
      baselineValue: number;
      competitorBars: Array<{ id: string; value: number; color: string; label: string }>;
    }
  >();

  for (const comparison of comparisons) {
    const operatorComparisons = buildOperatorTypeRuntimeComparisons(comparison.diff);
    const competitorName = comparison.diff.query_b.instance_name ?? comparison.diff.query_b.id;
    const queryColors = getQueryDiffQueryColors({
      baselineQueryId: comparison.diff.query_a.id,
      competitorQueryId: comparison.diff.query_b.id,
      competitorIndex: comparison.competitorIndex,
      theme: paletteTheme,
    });

    for (const operatorComparison of operatorComparisons) {
      const row = rowsByOperatorType.get(operatorComparison.id) ?? {
        label: operatorComparison.label,
        baselineValue: operatorComparison.a,
        competitorBars: [],
      };
      row.baselineValue = Math.max(row.baselineValue, operatorComparison.a);
      row.competitorBars.push({
        id: comparison.id,
        value: operatorComparison.b,
        color: queryColors.competitor,
        label: `${competitorName} value`,
      });
      rowsByOperatorType.set(operatorComparison.id, row);
    }
  }

  return [...rowsByOperatorType.entries()]
    .map(([operatorType, row]) => ({
      id: operatorType,
      label: row.label,
      labelColor: getQueryDiffOperatorTypeColor(operatorType),
      title: formatDurationSeconds(
        Math.max(row.baselineValue, ...row.competitorBars.map(bar => bar.value))
      ),
      bars: [
        {
          id: 'baseline',
          value: row.baselineValue,
          color: getQueryDiffQueryColors({
            baselineQueryId: comparisons[0]?.diff.query_a.id ?? '',
            competitorQueryId: comparisons[0]?.diff.query_b.id ?? '',
            theme: paletteTheme,
          }).baseline,
          label: 'Baseline value',
        },
        ...row.competitorBars,
      ],
    }))
    .sort((left, right) => {
      const leftMax = Math.max(...left.bars.map(bar => bar.value));
      const rightMax = Math.max(...right.bars.map(bar => bar.value));
      return rightMax - leftMax;
    });
}

export function QueryDiffStats({
  diff,
  baselineBundle,
  competitorBundle,
  competitorIndex = 0,
}: QueryDiffStatsProps) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const baselineName = diff.query_a.instance_name ?? diff.query_a.id;
  const competitorName = diff.query_b.instance_name ?? diff.query_b.id;
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: diff.query_a.id,
        competitorQueryId: diff.query_b.id,
        competitorIndex,
        theme: paletteTheme,
      }),
    [competitorIndex, diff.query_a.id, diff.query_b.id, paletteTheme]
  );
  const operatorRuntimeComparisons = useMemo(
    () => buildOperatorTypeRuntimeComparisons(diff),
    [diff]
  );
  const totalRuntimeComparison = useMemo(
    () => buildRuntimeComparison(baselineBundle.duration_s, competitorBundle.duration_s),
    [baselineBundle.duration_s, competitorBundle.duration_s]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0 lg:grid-cols-2">
        <RuntimeComparisonCard
          comparison={totalRuntimeComparison}
          baselineName={baselineName}
          competitorName={competitorName}
          queryColors={queryColors}
          paletteTheme={paletteTheme}
        />
        {operatorRuntimeComparisons.length > 0 && (
          <StatisticCard
            title="Operator Run Time"
            chart={
              <StatisticMiniBarChart
                rows={operatorRuntimeChartRows(operatorRuntimeComparisons, queryColors)}
                maxRows={operatorRuntimeComparisons.length}
                className="h-full overflow-y-auto pr-1 [scrollbar-width:thin]"
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
  const baselineName =
    comparisons[0]?.diff.query_a.instance_name ?? comparisons[0]?.diff.query_a.id ?? 'Baseline';
  const baselineColor = getQueryDiffQueryColors({
    baselineQueryId: comparisons[0]?.diff.query_a.id ?? '',
    competitorQueryId: comparisons[0]?.diff.query_b.id ?? '',
    theme: paletteTheme,
  }).baseline;

  const totalRuntimeComparisons = useMemo(
    () =>
      comparisons.map(comparison => ({
        ...comparison,
        baselineName: comparison.diff.query_a.instance_name ?? comparison.diff.query_a.id,
        competitorName: comparison.diff.query_b.instance_name ?? comparison.diff.query_b.id,
        runtimeComparison: buildRuntimeComparison(
          comparison.baselineBundle.duration_s,
          comparison.competitorBundle.duration_s
        ),
        queryColors: getQueryDiffQueryColors({
          baselineQueryId: comparison.diff.query_a.id,
          competitorQueryId: comparison.diff.query_b.id,
          competitorIndex: comparison.competitorIndex,
          theme: paletteTheme,
        }),
      })),
    [comparisons, paletteTheme]
  );
  const operatorRuntimeRows = useMemo(
    () => aggregateOperatorRuntimeChartRows({ comparisons, paletteTheme }),
    [comparisons, paletteTheme]
  );
  const competitorLegend = useMemo(
    () =>
      totalRuntimeComparisons.map(comparison => ({
        id: comparison.id,
        name: comparison.competitorName,
        color: comparison.queryColors.competitor,
      })),
    [totalRuntimeComparisons]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0 [grid-template-columns:repeat(auto-fit,minmax(20rem,1fr))]">
        {totalRuntimeComparisons.map(comparison => (
          <RuntimeComparisonCard
            key={comparison.id}
            comparison={comparison.runtimeComparison}
            baselineName={comparison.baselineName}
            competitorName={comparison.competitorName}
            queryColors={comparison.queryColors}
            paletteTheme={paletteTheme}
          />
        ))}
        {operatorRuntimeRows.length > 0 && (
          <StatisticCard
            title="Operator Run Time"
            chartLabel={operatorRuntimeLegend({
              baselineName,
              competitors: competitorLegend,
              queryColors: {
                baseline: baselineColor,
                competitor: competitorLegend[0]?.color ?? baselineColor,
              },
            })}
            chart={
              <StatisticMiniBarChart
                rows={operatorRuntimeRows}
                maxRows={operatorRuntimeRows.length}
                className="h-full overflow-y-auto pr-1 [scrollbar-width:thin]"
              />
            }
          />
        )}
      </div>
    </div>
  );
}

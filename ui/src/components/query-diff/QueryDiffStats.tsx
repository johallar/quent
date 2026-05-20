// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type CSSProperties } from 'react';
import { Triangle } from 'lucide-react';
import type { QueryProfileDiffResponse } from '@quent/client';
import {
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

export function QueryDiffStats({ diff, baselineBundle, competitorBundle }: QueryDiffStatsProps) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const baselineName = diff.query_a.instance_name ?? diff.query_a.id;
  const competitorName = diff.query_b.instance_name ?? diff.query_b.id;
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        baselineQueryId: diff.query_a.id,
        competitorQueryId: diff.query_b.id,
        theme: paletteTheme,
      }),
    [diff.query_a.id, diff.query_b.id, paletteTheme]
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
        <StatisticCard
          title="Total Run Time"
          value={formatSignedDurationSeconds(displayDelta(totalRuntimeComparison.delta))}
          valueStyle={runtimeValueStyle(displayDelta(totalRuntimeComparison.delta), paletteTheme)}
          secondaryValue={formatPercentDelta(
            displayPercentDelta(totalRuntimeComparison.percentDelta)
          )}
          comparisons={runtimeComparisons({
            comparison: totalRuntimeComparison,
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

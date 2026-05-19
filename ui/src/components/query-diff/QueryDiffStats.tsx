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
  queryABundle: QueryBundle<EntityRef>;
  queryBBundle: QueryBundle<EntityRef>;
}

function runtimeValueStyle(delta: number, paletteTheme: PaletteTheme): CSSProperties | undefined {
  if (delta > 0) return { color: getDiffPositiveColor(paletteTheme) };
  if (delta < 0) return { color: getDiffNegativeColor(paletteTheme) };
  return undefined;
}

function runtimeComparisons({
  comparison,
  queryAName,
  queryBName,
  queryColors,
}: {
  comparison: RuntimeComparison;
  queryAName: string;
  queryBName: string;
  queryColors: QueryDiffQueryColors;
}): StatisticCardComparison[] {
  return [
    {
      id: 'a',
      label: queryAName,
      value: formatDurationSeconds(comparison.a),
      color: queryColors.queryA,
    },
    {
      id: 'b',
      label: queryBName,
      value: formatDurationSeconds(comparison.b),
      color: queryColors.queryB,
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
      { id: 'a', value: comparison.a, color: queryColors.queryA, label: 'First comparison value' },
      {
        id: 'b',
        value: comparison.b,
        color: queryColors.queryB,
        label: 'Second comparison value',
      },
    ],
  }));
}

export function QueryDiffStats({ diff, queryABundle, queryBBundle }: QueryDiffStatsProps) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const queryAName = diff.query_a.instance_name ?? diff.query_a.id;
  const queryBName = diff.query_b.instance_name ?? diff.query_b.id;
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        queryAId: diff.query_a.id,
        queryBId: diff.query_b.id,
        theme: paletteTheme,
      }),
    [diff.query_a.id, diff.query_b.id, paletteTheme]
  );
  const operatorRuntimeComparisons = useMemo(
    () => buildOperatorTypeRuntimeComparisons(diff),
    [diff]
  );
  const totalRuntimeComparison = useMemo(
    () => buildRuntimeComparison(queryABundle.duration_s, queryBBundle.duration_s),
    [queryABundle.duration_s, queryBBundle.duration_s]
  );

  return (
    <div className="shrink-0 border-b border-border bg-card">
      <div className="grid min-w-0 lg:grid-cols-2">
        <StatisticCard
          title="Total Run Time"
          value={formatSignedDurationSeconds(totalRuntimeComparison.delta)}
          valueStyle={runtimeValueStyle(totalRuntimeComparison.delta, paletteTheme)}
          secondaryValue={formatPercentDelta(totalRuntimeComparison.percentDelta)}
          comparisons={runtimeComparisons({
            comparison: totalRuntimeComparison,
            queryAName,
            queryBName,
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

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiffDelta, DiffQuerySummary, QueryDiff } from '@quent/client';
import type { PaletteTheme, StatValue } from '@quent/utils';
import { formatStatValue } from '@quent/components';
import { getDiffNegativeColor, getDiffPositiveColor } from './QueryDiffColors';

export interface QueryDiffTableEngine {
  id: string;
  label: string;
}

export interface QueryDiffTableCellValues {
  baseline: StatValue;
  comparison: StatValue;
  delta: StatValue;
  percentDelta: number | null;
}

export interface QueryDiffTableRow {
  engineGroupId: string;
  engineGroupLabel: string;
  engines: QueryDiffTableEngine[];
  queryGroupId: string;
  queryGroupLabel: string;
  operatorType: string;
  operatorLabel: string;
  operatorPairId: string;
  operatorAId: string;
  operatorALabel: string;
  operatorBId: string;
  operatorBLabel: string;
  stats: Record<string, StatValue>;
  statDetails: Record<string, QueryDiffTableCellValues>;
}

function getQueryEngine(query: DiffQuerySummary): QueryDiffTableEngine {
  return {
    id: query.engine_id,
    label: query.engine_name ?? query.engine_id,
  };
}

function getQueryGroup(query: DiffQuerySummary): { id: string; label: string } {
  return {
    id: query.query_group_id ?? query.query_group_name ?? '__no_query_group__',
    label: query.query_group_name ?? query.query_group_id ?? 'No Query Group',
  };
}

function displayDeltaValue(value: StatValue): StatValue {
  if (typeof value !== 'number') return value;
  return value === 0 || Object.is(value, -0) ? 0 : -value;
}

function displayPercentDeltaValue(value: number | null): number | null {
  if (value === null) return null;
  const displayedValue = -value;
  return displayedValue === 0 || Object.is(displayedValue, -0) ? 0 : displayedValue;
}

function buildCellValues(stat: DiffDelta): QueryDiffTableCellValues {
  return {
    baseline: stat.stats[0],
    comparison: stat.stats[1],
    delta: displayDeltaValue(stat.delta),
    percentDelta: displayPercentDeltaValue(stat.percent_delta),
  };
}

function formatOperatorPairLabel(
  operatorALabel: string,
  operatorAId: string,
  operatorBLabel: string,
  operatorBId: string
): string {
  return `${operatorALabel} <-> ${operatorBLabel}\n${operatorAId} <-> ${operatorBId}`;
}

export function buildQueryDiffRows(
  _baselineQuery: DiffQuerySummary,
  comparisonQuery: DiffQuerySummary,
  diff: QueryDiff,
  comparisonId = comparisonQuery.id
): QueryDiffTableRow[] {
  const comparisonEngine = getQueryEngine(comparisonQuery);
  const engines = [comparisonEngine];
  const engineGroupId = comparisonEngine.id;
  const engineGroupLabel = comparisonEngine.label;
  const queryGroup = getQueryGroup(comparisonQuery);

  return (diff.operator_diffs ?? []).flatMap(entry => {
    const [operatorA, operatorB] = entry.operators;
    const operatorType = operatorA.operator_type_name ?? operatorB.operator_type_name ?? '-';
    const operatorLabel = formatOperatorPairLabel(
      operatorA.label,
      operatorA.id,
      operatorB.label,
      operatorB.id
    );
    const stats: Record<string, StatValue> = {};
    const statDetails: Record<string, QueryDiffTableCellValues> = {};
    for (const [statName, stat] of Object.entries(entry.stats)) {
      const cellValues = buildCellValues(stat);
      stats[statName] = cellValues.delta;
      statDetails[statName] = cellValues;
    }

    return [
      {
        engineGroupId,
        engineGroupLabel,
        engines,
        queryGroupId: queryGroup.id,
        queryGroupLabel: queryGroup.label,
        operatorType,
        operatorLabel,
        operatorPairId: `${comparisonId}:${operatorA.id}:${operatorB.id}`,
        operatorAId: operatorA.id,
        operatorALabel: operatorA.label,
        operatorBId: operatorB.id,
        operatorBLabel: operatorB.label,
        stats,
        statDetails,
      },
    ];
  });
}

export function formatSignedDiffValue(value: StatValue, statName: string): string {
  const formattedValue = formatStatValue(value, statName);
  if (typeof value !== 'number' || Object.is(value, -0) || value === 0) return formattedValue;
  return value > 0 ? `+${formattedValue}` : formattedValue;
}

export function formatSignedPercentDelta(percentDelta: number | null): string {
  if (percentDelta === null) return '-';
  const displayedValue = percentDelta === 0 || Object.is(percentDelta, -0) ? 0 : percentDelta;
  const formattedValue = `${(displayedValue * 100).toFixed(1)}%`;
  return displayedValue > 0 ? `+${formattedValue}` : formattedValue;
}

export function getDeltaCellStyle(
  value: StatValue,
  maxAbs: number | undefined,
  theme: PaletteTheme = 'light'
): React.CSSProperties | undefined {
  if (typeof value !== 'number' || value === 0 || !maxAbs) return undefined;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const mix = Math.round(14 + intensity * 42);
  const color = value > 0 ? getDiffPositiveColor(theme) : getDiffNegativeColor(theme);
  return {
    backgroundColor: `color-mix(in srgb, ${color} ${mix}%, hsl(var(--card)))`,
  };
}

export function buildMaxAbsByStat(rows: QueryDiffTableRow[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const row of rows) {
    for (const [stat, value] of Object.entries(row.stats)) {
      if (typeof value !== 'number') continue;
      result.set(stat, Math.max(result.get(stat) ?? 0, Math.abs(value)));
    }
  }
  return result;
}

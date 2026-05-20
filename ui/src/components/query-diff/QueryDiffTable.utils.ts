// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiffQuerySummary, QueryDiff } from '@quent/client';
import type { PaletteTheme, StatValue } from '@quent/utils';
import { formatStatValue } from '@quent/components';
import { getDiffNegativeColor, getDiffPositiveColor } from './QueryDiffColors';

export interface QueryDiffTableEngine {
  id: string;
  label: string;
}

export interface QueryDiffTableRow {
  engineGroupId: string;
  engineGroupLabel: string;
  engines: QueryDiffTableEngine[];
  operatorType: string;
  operatorLabel: string;
  operatorPairId: string;
  operatorAId: string;
  operatorALabel: string;
  operatorBId: string;
  operatorBLabel: string;
  stats: Record<string, StatValue>;
}

function getQueryEngine(query: DiffQuerySummary): QueryDiffTableEngine {
  return {
    id: query.engine_id,
    label: query.engine_name ?? query.engine_id,
  };
}

function displayDeltaValue(value: StatValue): StatValue {
  if (typeof value !== 'number') return value;
  return value === 0 || Object.is(value, -0) ? 0 : -value;
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
  diff: QueryDiff
): QueryDiffTableRow[] {
  const comparisonEngine = getQueryEngine(comparisonQuery);
  const engines = [comparisonEngine];
  const engineGroupId = comparisonEngine.id;
  const engineGroupLabel = comparisonEngine.label;

  return (diff.operator_diffs ?? []).flatMap(entry => {
    const [operatorA, operatorB] = entry.operators;
    const operatorType = operatorA.operator_type_name ?? operatorB.operator_type_name ?? '-';
    const operatorLabel = formatOperatorPairLabel(
      operatorA.label,
      operatorA.id,
      operatorB.label,
      operatorB.id
    );
    const stats = Object.fromEntries(
      Object.entries(entry.stats).map(([statName, stat]) => [
        statName,
        displayDeltaValue(stat.delta),
      ])
    );
    return [
      {
        engineGroupId,
        engineGroupLabel,
        engines,
        operatorType,
        operatorLabel,
        operatorPairId: `${operatorA.id}:${operatorB.id}`,
        operatorAId: operatorA.id,
        operatorALabel: operatorA.label,
        operatorBId: operatorB.id,
        operatorBLabel: operatorB.label,
        stats,
      },
    ];
  });
}

export function formatSignedDiffValue(value: StatValue, statName: string): string {
  const formattedValue = formatStatValue(value, statName);
  if (typeof value !== 'number' || Object.is(value, -0) || value === 0) return formattedValue;
  return value > 0 ? `+${formattedValue}` : formattedValue;
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

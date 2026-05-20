// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { QueryProfileDiffResponse } from '@quent/client';
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

function getQueryEngine(query: QueryProfileDiffResponse['query_a']): QueryDiffTableEngine {
  return {
    id: query.engine_id,
    label: query.engine_name ?? query.engine_id,
  };
}

function uniqueEngines(engines: QueryDiffTableEngine[]): QueryDiffTableEngine[] {
  const seen = new Set<string>();
  return engines.filter(engine => {
    if (seen.has(engine.id)) return false;
    seen.add(engine.id);
    return true;
  });
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

export function buildQueryDiffRows(diff: QueryProfileDiffResponse): QueryDiffTableRow[] {
  const engines = uniqueEngines([getQueryEngine(diff.query_a), getQueryEngine(diff.query_b)]);
  const engineGroupId = engines.map(engine => engine.id).join(':');
  const engineGroupLabel = engines.map(engine => engine.label).join(', ');

  return diff.operator_diffs.flatMap(entry => {
    if (!entry.operator_a || !entry.operator_b) return [];
    const operatorType =
      entry.operator_a.operator_type_name ?? entry.operator_b.operator_type_name ?? '-';
    const operatorLabel = formatOperatorPairLabel(
      entry.operator_a.label,
      entry.operator_a.id,
      entry.operator_b.label,
      entry.operator_b.id
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
        operatorPairId: `${entry.operator_a.id}:${entry.operator_b.id}`,
        operatorAId: entry.operator_a.id,
        operatorALabel: entry.operator_a.label,
        operatorBId: entry.operator_b.id,
        operatorBLabel: entry.operator_b.label,
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

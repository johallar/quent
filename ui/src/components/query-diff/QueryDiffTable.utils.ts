// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { QueryProfileDiffResponse } from '@quent/client';
import type { StatValue } from '@quent/utils';

export interface QueryDiffTableRow {
  operatorType: string;
  operatorLabel: string;
  operatorPairId: string;
  stats: Record<string, StatValue>;
}

function formatOperatorRef(label: string, id: string): string {
  return `${label} (${id})`;
}

export function buildQueryDiffRows(diff: QueryProfileDiffResponse): QueryDiffTableRow[] {
  return diff.operator_diffs.flatMap(entry => {
    if (!entry.operator_a || !entry.operator_b) return [];
    const operatorType =
      entry.operator_a.operator_type_name ?? entry.operator_b.operator_type_name ?? '-';
    const operatorLabel = `${formatOperatorRef(entry.operator_a.label, entry.operator_a.id)} / ${formatOperatorRef(entry.operator_b.label, entry.operator_b.id)}`;
    const stats = Object.fromEntries(
      Object.entries(entry.stats).map(([statName, stat]) => [statName, stat.delta])
    );
    return [
      {
        operatorType,
        operatorLabel,
        operatorPairId: `${entry.operator_a.id}:${entry.operator_b.id}`,
        stats,
      },
    ];
  });
}

export function formatSignedDiffValue(value: StatValue): string | null {
  if (typeof value !== 'number') return null;
  if (Object.is(value, -0) || value === 0) return '0';
  return value > 0 ? `+${value.toLocaleString()}` : value.toLocaleString();
}

export function getDeltaCellStyle(
  value: StatValue,
  maxAbs: number | undefined
): React.CSSProperties | undefined {
  if (typeof value !== 'number' || value === 0 || !maxAbs) return undefined;
  const intensity = Math.min(1, Math.abs(value) / maxAbs);
  const mix = Math.round(14 + intensity * 42);
  const color = value > 0 ? '#14b8a6' : '#ef4444';
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

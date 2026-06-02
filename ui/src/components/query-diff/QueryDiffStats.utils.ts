// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiffDelta, QueryDiff } from '@quent/client';
import { unwrapTaggedValue } from '@quent/components';
import { formatDuration } from '@quent/utils';

export interface RuntimeComparison {
  a: number;
  b: number;
  delta: number;
  percentDelta: number | null;
}

export interface OperatorTypeRuntimeComparison extends RuntimeComparison {
  id: string;
  label: string;
}

function unwrapNumericStat(value: unknown): number | null {
  const unwrapped = unwrapTaggedValue(value);
  return typeof unwrapped === 'number' ? unwrapped : null;
}

const OPERATOR_DIFF_STAT_DEFAULT_PRIORITY = ['duration_s', 'wall_time_ns'] as const;

export function sortOperatorDiffStatNames(statNames: readonly string[]): string[] {
  const sorted = [...new Set(statNames)].sort((a, b) => a.localeCompare(b));
  for (const preferred of OPERATOR_DIFF_STAT_DEFAULT_PRIORITY) {
    if (sorted.includes(preferred)) {
      return [preferred, ...sorted.filter(name => name !== preferred)];
    }
  }
  return sorted;
}

export function buildRuntimeComparison(a: number, b: number): RuntimeComparison {
  const delta = a - b;
  return {
    a,
    b,
    delta,
    percentDelta: b === 0 ? null : delta / Math.abs(b),
  };
}

export function buildRuntimeComparisonFromDelta(diff: DiffDelta | undefined): RuntimeComparison {
  const a = unwrapNumericStat(diff?.stats?.[0]);
  const b = unwrapNumericStat(diff?.stats?.[1]);
  if (a === null || b === null) {
    return buildRuntimeComparison(0, 0);
  }

  return {
    a,
    b,
    delta: typeof diff?.delta === 'number' ? diff.delta : a - b,
    percentDelta:
      typeof diff?.percent_delta === 'number'
        ? diff.percent_delta
        : b === 0
          ? null
          : (a - b) / Math.abs(b),
  };
}

export function buildOperatorTypeRuntimeComparisons(
  diff: QueryDiff,
  statName = 'duration_s'
): OperatorTypeRuntimeComparison[] {
  const totalsByOperatorType = new Map<string, { a: number; b: number }>();

  for (const entry of diff.operator_diffs ?? []) {
    const [operatorA, operatorB] = entry.operators;
    const stat = entry.stats[statName];
    if (!stat) continue;
    const a = unwrapNumericStat(stat.stats[0]);
    const b = unwrapNumericStat(stat.stats[1]);
    if (a === null || b === null) continue;

    const operatorType = operatorA.operator_type_name ?? operatorB.operator_type_name ?? 'Unknown';
    const totals = totalsByOperatorType.get(operatorType) ?? { a: 0, b: 0 };
    totals.a += a;
    totals.b += b;
    totalsByOperatorType.set(operatorType, totals);
  }

  return [...totalsByOperatorType.entries()]
    .map(([operatorType, totals]) => ({
      ...buildRuntimeComparison(totals.a, totals.b),
      id: operatorType,
      label: operatorType,
    }))
    .sort((left, right) => Math.max(right.a, right.b) - Math.max(left.a, left.b));
}

export function getOperatorDiffStatNames(diffs: QueryDiff[]): string[] {
  const statNames = new Set<string>();

  for (const diff of diffs) {
    for (const entry of diff.operator_diffs ?? []) {
      for (const [statName, stat] of Object.entries(entry.stats)) {
        if (statNames.has(statName) || !stat) continue;
        if (
          unwrapNumericStat(stat.stats[0]) === null ||
          unwrapNumericStat(stat.stats[1]) === null
        ) {
          continue;
        }
        statNames.add(statName);
      }
    }
  }

  return sortOperatorDiffStatNames([...statNames]);
}

export function getDefaultOperatorDiffStatName(statNames: readonly string[]): string | null {
  return sortOperatorDiffStatNames(statNames)[0] ?? null;
}

export function resolveOperatorDiffStatSelection(
  statNames: readonly string[],
  requestedStat: string | null
): string | null {
  if (requestedStat && statNames.includes(requestedStat)) {
    return requestedStat;
  }
  return getDefaultOperatorDiffStatName(statNames);
}

export function sumRuntimeComparisons(entries: RuntimeComparison[]): RuntimeComparison {
  return buildRuntimeComparison(
    entries.reduce((sum, entry) => sum + entry.a, 0),
    entries.reduce((sum, entry) => sum + entry.b, 0)
  );
}

export function formatDurationSeconds(seconds: number): string {
  return formatDuration(seconds * 1_000);
}

export function formatSignedDurationSeconds(seconds: number): string {
  if (seconds === 0 || Object.is(seconds, -0)) return formatDurationSeconds(0);
  const formatted = formatDurationSeconds(seconds);
  return seconds > 0 ? `+${formatted}` : formatted;
}

export function formatPercentDelta(percentDelta: number | null): string {
  if (percentDelta === null) return '-';
  if (percentDelta === 0 || Object.is(percentDelta, -0)) return '0.0%';
  const formatted = `${(percentDelta * 100).toFixed(1)}%`;
  return percentDelta > 0 ? `+${formatted}` : formatted;
}

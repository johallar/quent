// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiffDelta, QueryDiff } from '@quent/client';
import type { StatValue } from '@quent/utils';
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

export function buildRuntimeComparison(a: number, b: number): RuntimeComparison {
  const delta = a - b;
  return {
    a,
    b,
    delta,
    percentDelta: b === 0 ? null : delta / Math.abs(b),
  };
}

export function buildRuntimeComparisonFromDelta(
  diff: DiffDelta | undefined,
  fallbackA: number,
  fallbackB: number
): RuntimeComparison {
  const [a, b] = diff?.stats ?? [];
  if (typeof a !== 'number' || typeof b !== 'number') {
    return buildRuntimeComparison(fallbackA, fallbackB);
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
  diff: QueryDiff
): OperatorTypeRuntimeComparison[] {
  const totalsByOperatorType = new Map<string, { a: number; b: number }>();

  for (const entry of diff.operator_diffs ?? []) {
    const [operatorA, operatorB] = entry.operators;
    const duration = entry.stats.duration_s;
    const [a, b] = duration?.stats ?? ([] as StatValue[]);
    if (typeof a !== 'number' || typeof b !== 'number') continue;

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

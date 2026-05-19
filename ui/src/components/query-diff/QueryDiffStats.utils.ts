// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { QueryProfileDiffResponse } from '@quent/client';
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

export function buildOperatorTypeRuntimeComparisons(
  diff: QueryProfileDiffResponse
): OperatorTypeRuntimeComparison[] {
  const totalsByOperatorType = new Map<string, { a: number; b: number }>();

  for (const entry of diff.operator_diffs) {
    if (!entry.operator_a || !entry.operator_b) continue;
    const duration = entry.stats.duration_s;
    if (typeof duration?.a !== 'number' || typeof duration.b !== 'number') continue;

    const operatorType =
      entry.operator_a.operator_type_name ?? entry.operator_b.operator_type_name ?? 'Unknown';
    const totals = totalsByOperatorType.get(operatorType) ?? { a: 0, b: 0 };
    totals.a += duration.a;
    totals.b += duration.b;
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

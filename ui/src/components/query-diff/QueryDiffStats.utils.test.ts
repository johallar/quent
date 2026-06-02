// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { equalPlanQueryDiffFixture } from '@/test/mocks/queryProfileDiffFixtures';
import {
  buildOperatorTypeRuntimeComparisons,
  buildRuntimeComparison,
  buildRuntimeComparisonFromDelta,
  getDefaultOperatorDiffStatName,
  getOperatorDiffStatNames,
  resolveOperatorDiffStatSelection,
  sortOperatorDiffStatNames,
  formatPercentDelta,
  formatSignedDurationSeconds,
  sumRuntimeComparisons,
} from './QueryDiffStats.utils';

describe('QueryDiffStats helpers', () => {
  it('builds runtime comparisons with signed deltas', () => {
    expect(buildRuntimeComparison(12, 10)).toEqual({
      a: 12,
      b: 10,
      delta: 2,
      percentDelta: 0.2,
    });
  });

  it('builds runtime comparisons from contract deltas', () => {
    expect(
      buildRuntimeComparisonFromDelta({ stats: [12, 10], delta: 2, percent_delta: 0.2 })
    ).toEqual({
      a: 12,
      b: 10,
      delta: 2,
      percentDelta: 0.2,
    });
  });

  it('unwraps tagged numeric stats from the diff API', () => {
    expect(
      buildRuntimeComparisonFromDelta({
        stats: [{ F64: 40 }, { F64: 44 }],
        delta: -4,
        percent_delta: -10,
      })
    ).toEqual({
      a: 40,
      b: 44,
      delta: -4,
      percentDelta: -10,
    });
  });

  it('extracts sorted per-operator-type runtime comparisons', () => {
    const comparisons = buildOperatorTypeRuntimeComparisons(equalPlanQueryDiffFixture);

    expect(comparisons.map(comparison => comparison.label)).toEqual(['Join', 'Scan', 'Aggregate']);
    expect(sumRuntimeComparisons(comparisons)).toMatchObject({ a: 40, b: 44, delta: -4 });
  });

  it('groups runtime comparisons by operator type', () => {
    const comparisons = buildOperatorTypeRuntimeComparisons({
      ...equalPlanQueryDiffFixture,
      operator_diffs: [
        ...(equalPlanQueryDiffFixture.operator_diffs ?? []),
        {
          operators: [
            {
              label: 'Scan customers',
              operator_type_name: 'Scan',
              count: 1,
            },
            {
              label: 'Scan customers',
              operator_type_name: 'Scan',
              count: 1,
            },
          ],
          stats: {
            duration_s: { stats: [3, 2], delta: 1, percent_delta: 0.5 },
          },
        },
      ],
    });

    expect(comparisons.find(comparison => comparison.id === 'Scan')).toMatchObject({
      a: 15,
      b: 12,
      delta: 3,
    });
  });

  it('extracts numeric operator diff stat names with duration_s first', () => {
    expect(getOperatorDiffStatNames([equalPlanQueryDiffFixture])).toEqual([
      'duration_s',
      'input_rows',
      'output_rows',
    ]);
  });

  it('defaults operator stat selection to duration_s or the first sorted stat', () => {
    expect(getDefaultOperatorDiffStatName(['input_rows', 'duration_s'])).toBe('duration_s');
    expect(getDefaultOperatorDiffStatName(['output_rows', 'input_rows'])).toBe('input_rows');
    expect(getDefaultOperatorDiffStatName([])).toBeNull();
  });

  it('sorts operator stat names deterministically', () => {
    expect(sortOperatorDiffStatNames(['zebra', 'alpha', 'middle'])).toEqual([
      'alpha',
      'middle',
      'zebra',
    ]);
    expect(sortOperatorDiffStatNames(['output_rows', 'duration_s', 'input_rows'])).toEqual([
      'duration_s',
      'input_rows',
      'output_rows',
    ]);
  });

  it('prefers duration_s when resolving the selected operator stat', () => {
    expect(resolveOperatorDiffStatSelection(['input_rows', 'duration_s'], null)).toBe('duration_s');
    expect(resolveOperatorDiffStatSelection(['input_rows', 'duration_s'], 'input_rows')).toBe(
      'input_rows'
    );
    expect(resolveOperatorDiffStatSelection(['input_rows', 'output_rows'], null)).toBe(
      'input_rows'
    );
  });

  it('extracts sorted per-operator-type comparisons for a selected stat', () => {
    const comparisons = buildOperatorTypeRuntimeComparisons(
      equalPlanQueryDiffFixture,
      'input_rows'
    );

    expect(comparisons.map(comparison => comparison.label)).toEqual(['Scan', 'Join', 'Aggregate']);
    expect(sumRuntimeComparisons(comparisons)).toMatchObject({
      a: 2300,
      b: 2530,
      delta: -230,
    });
  });

  it('formats duration and percent deltas for cards', () => {
    expect(formatSignedDurationSeconds(2)).toBe('+2.00s');
    expect(formatSignedDurationSeconds(-0.5)).toBe('-500.00ms');
    expect(formatPercentDelta(0.2)).toBe('+20.0%');
    expect(formatPercentDelta(null)).toBe('-');
  });
});

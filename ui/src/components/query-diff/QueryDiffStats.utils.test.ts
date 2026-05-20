// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { equalPlanQueryDiffFixture } from '@/test/mocks/queryProfileDiffFixtures';
import {
  buildOperatorTypeRuntimeComparisons,
  buildRuntimeComparison,
  buildRuntimeComparisonFromDelta,
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
      buildRuntimeComparisonFromDelta({ stats: [12, 10], delta: 2, percent_delta: 0.2 }, 0, 0)
    ).toEqual({
      a: 12,
      b: 10,
      delta: 2,
      percentDelta: 0.2,
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
              id: 'scan-extra-a',
              label: 'Scan customers',
              operator_type_name: 'Scan',
              plan_id: 'plan-a',
            },
            {
              id: 'scan-extra-b',
              label: 'Scan customers',
              operator_type_name: 'Scan',
              plan_id: 'plan-b',
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

  it('formats duration and percent deltas for cards', () => {
    expect(formatSignedDurationSeconds(2)).toBe('+2.00s');
    expect(formatSignedDurationSeconds(-0.5)).toBe('-500.00ms');
    expect(formatPercentDelta(0.2)).toBe('+20.0%');
    expect(formatPercentDelta(null)).toBe('-');
  });
});

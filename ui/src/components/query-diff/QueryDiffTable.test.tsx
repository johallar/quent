// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildQueryDiffRows,
  formatSignedDiffValue,
  getDeltaCellStyle,
} from './QueryDiffTable.utils';
import { equalPlanQueryProfileDiffFixture } from '@/test/mocks/queryProfileDiffFixtures';

describe('QueryDiffTable helpers', () => {
  it('converts matched operator diffs into pivot rows', () => {
    const rows = buildQueryDiffRows(equalPlanQueryProfileDiffFixture);

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      operatorType: 'Scan',
      operatorLabel: 'Scan orders (scan-a) / Scan orders (scan-b)',
      stats: {
        duration_s: 2,
        input_rows: -200,
      },
    });
  });

  it('formats numeric deltas with signs', () => {
    expect(formatSignedDiffValue(12)).toBe('+12');
    expect(formatSignedDiffValue(-12)).toBe('-12');
    expect(formatSignedDiffValue(0)).toBe('0');
    expect(formatSignedDiffValue(null)).toBeNull();
  });

  it('returns diverging styles for positive and negative deltas only', () => {
    expect(getDeltaCellStyle(5, 10)?.backgroundColor).toContain('#14b8a6');
    expect(getDeltaCellStyle(-5, 10)?.backgroundColor).toContain('#ef4444');
    expect(getDeltaCellStyle(0, 10)).toBeUndefined();
    expect(getDeltaCellStyle(null, 10)).toBeUndefined();
  });
});

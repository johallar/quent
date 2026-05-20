// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildQueryDiffRows,
  formatSignedDiffValue,
  getDeltaCellStyle,
} from './QueryDiffTable.utils';
import {
  baselineDiffQueryFixture,
  comparisonDiffQueryFixture,
  equalPlanQueryDiffFixture,
} from '@/test/mocks/queryProfileDiffFixtures';
import { DIFF_NEGATIVE_COLOR, DIFF_POSITIVE_COLOR } from './QueryDiffColors';

describe('QueryDiffTable helpers', () => {
  it('converts matched operator diffs into pivot rows', () => {
    const rows = buildQueryDiffRows(
      baselineDiffQueryFixture,
      comparisonDiffQueryFixture,
      equalPlanQueryDiffFixture
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      engineGroupId: 'engine-b',
      engineGroupLabel: 'Engine B',
      engines: [{ id: 'engine-b', label: 'Engine B' }],
      operatorType: 'Scan',
      operatorLabel: 'Scan orders <-> Scan orders\nscan-a <-> scan-b',
      operatorAId: 'scan-a',
      operatorALabel: 'Scan orders',
      operatorBId: 'scan-b',
      operatorBLabel: 'Scan orders',
      stats: {
        duration_s: -2,
        input_rows: 200,
      },
    });
  });

  it('formats numeric deltas with signs', () => {
    expect(formatSignedDiffValue(12, 'input_rows')).toBe('+12');
    expect(formatSignedDiffValue(-12, 'input_rows')).toBe('-12');
    expect(formatSignedDiffValue(0, 'input_rows')).toBe('0');
    expect(formatSignedDiffValue(null, 'input_rows')).toBe('-');
  });

  it('uses the operator table stat formatter for delta values', () => {
    expect(formatSignedDiffValue(1536, 'buffer_bytes')).toBe('+1.5 KiB');
    expect(formatSignedDiffValue(-0.125, 'probe_selectivity')).toBe('-12.5%');
  });

  it('returns diverging styles for positive and negative deltas only', () => {
    expect(getDeltaCellStyle(5, 10)?.backgroundColor).toContain(DIFF_POSITIVE_COLOR);
    expect(getDeltaCellStyle(-5, 10)?.backgroundColor).toContain(DIFF_NEGATIVE_COLOR);
    expect(getDeltaCellStyle(0, 10)).toBeUndefined();
    expect(getDeltaCellStyle(null, 10)).toBeUndefined();
  });
});

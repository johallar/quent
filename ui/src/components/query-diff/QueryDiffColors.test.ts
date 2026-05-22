// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from 'vitest';
import { resetColorAssignments } from '@quent/utils';
import {
  DIFF_DIVERGING_COLORS,
  DIFF_DIVERGING_COLORS_DARK,
  DIFF_NEGATIVE_COLOR,
  DIFF_POSITIVE_COLOR,
  getDiffDivergingColors,
  getDiffNegativeColor,
  getDiffPositiveColor,
  getQueryDiffQueryColors,
} from './QueryDiffColors';

describe('QueryDiffColors', () => {
  afterEach(() => resetColorAssignments());

  it('uses Tol BuRd for diverging diff values', () => {
    expect(DIFF_DIVERGING_COLORS).toEqual([
      '#2166AC',
      '#4393C3',
      '#92C5DE',
      '#D1E5F0',
      '#F7F7F7',
      '#FDDBC7',
      '#F4A582',
      '#D6604D',
      '#B2182B',
    ]);
    expect(DIFF_POSITIVE_COLOR).toBe('#B2182B');
    expect(DIFF_NEGATIVE_COLOR).toBe('#2166AC');
  });

  it('uses a dark BuRd variant with the card color at the center', () => {
    expect(DIFF_DIVERGING_COLORS_DARK).toEqual([
      '#92C5DE',
      '#4393C3',
      '#2166AC',
      '#0B2F4A',
      '#020817',
      '#4A1218',
      '#B2182B',
      '#D6604D',
      '#F4A582',
    ]);
    expect(getDiffDivergingColors('dark')[4]).toBe('#020817');
    expect(getDiffPositiveColor('dark')).toBe('#F4A582');
    expect(getDiffNegativeColor('dark')).toBe('#92C5DE');
  });

  it('assigns distinct palette colors to the compared queries', () => {
    const colors = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      comparisonQueryId: 'query-b',
      theme: 'light',
    });

    expect(colors.baseline).not.toBe(colors.comparison);
  });

  it('keeps colors distinct when the same query id is compared', () => {
    const colors = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      comparisonQueryId: 'query-a',
      theme: 'light',
    });

    expect(colors.baseline).not.toBe(colors.comparison);
  });

  it('assigns different colors to multiple comparison queries', () => {
    const firstComparison = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      comparisonQueryId: 'query-b',
      comparisonIndex: 0,
      theme: 'light',
    });
    const secondComparison = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      comparisonQueryId: 'query-c',
      comparisonIndex: 1,
      theme: 'light',
    });

    expect(firstComparison.baseline).toBe(secondComparison.baseline);
    expect(firstComparison.comparison).not.toBe(secondComparison.comparison);
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { buildResourceTimelineViewData } from './resourceTimelineViewModel';

describe('buildResourceTimelineViewData', () => {
  it('builds timestamps and chart series from feature input', () => {
    const formatter = (value: number) => `${value} items`;
    const result = buildResourceTimelineViewData({
      spanStartSeconds: 2,
      binDurationSeconds: 0.5,
      numBins: 3,
      entries: [{ name: 'running', color: 'blue', values: [1, 2, 3], formatter }],
      emptySeriesColor: 'transparent',
      yAxisLabel: 'items',
    });

    expect(result.timestamps).toEqual([2_000, 2_500, 3_000]);
    expect(result.series.running).toMatchObject({
      color: 'blue',
      values: [1, 2, 3],
      binDuration: 0.5,
      formatter,
    });
    expect(result.yAxisLabel).toBe('items');
  });

  it('emits a transparent empty series for empty responses', () => {
    const result = buildResourceTimelineViewData({
      spanStartSeconds: 0,
      binDurationSeconds: 1,
      numBins: 0,
      entries: [],
      emptySeriesColor: 'transparent',
    });

    expect(result.series.empty).toMatchObject({ color: 'transparent', values: [] });
  });
});

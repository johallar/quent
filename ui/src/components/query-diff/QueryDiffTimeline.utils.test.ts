// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { SingleTimelineResponse } from '@quent/utils';
import type { DiffTimelineResponse } from '@quent/client';
import { DIFF_NEGATIVE_COLOR, DIFF_POSITIVE_COLOR } from './QueryDiffColors';
import { buildDiffHeatmapRowData, buildDiffTimelineData } from './QueryDiffTimeline.utils';

function makeTimeline(
  values: Record<string, number[]>,
  span: { start: number; end: number } = {
    start: 0,
    end: Object.values(values)[0]?.length ?? 0,
  }
): SingleTimelineResponse {
  const firstValues = Object.values(values)[0] ?? [];
  const config = {
    span,
    bin_duration: firstValues.length > 0 ? (span.end - span.start) / firstValues.length : 0,
    num_bins: BigInt(firstValues.length),
  };

  return {
    config,
    data: {
      Binned: {
        config,
        capacities_values: values,
        long_fsms: [],
      },
    },
  };
}

describe('buildDiffTimelineData', () => {
  it('uses backend-provided delta series for the diff lane', () => {
    const response: DiffTimelineResponse = {
      timelines: [makeTimeline({ slots: [100, 100] }), makeTimeline({ slots: [0, 0] })],
      delta: makeTimeline({
        'Query A higher': [2, 0],
        'Query B higher': [0, 3],
      }),
    };

    const data = buildDiffTimelineData({
      timelineDiff: response,
      theme: 'light',
      queryColors: { baseline: '#0072B2', comparison: '#E69F00' },
    });

    expect(data.baseline.series.slots?.values).toEqual([100, 100]);
    expect(data.comparison.series.slots?.values).toEqual([0, 0]);
    expect(data.delta.series['Baseline higher']?.values).toEqual([2, 0]);
    expect(data.delta.series['Comparison higher']?.values).toEqual([0, 3]);
    expect(data.comparisonWithDelta.series.slots?.values).toEqual([0, 0]);
    expect(data.comparisonWithDelta.series['Delta: Baseline higher']).toMatchObject({
      values: [-2, 0],
      color: DIFF_NEGATIVE_COLOR,
      isOverlay: true,
      renderType: 'bar',
    });
    expect(data.comparisonWithDelta.series['Delta: Comparison higher']).toMatchObject({
      values: [0, 3],
      color: DIFF_POSITIVE_COLOR,
      isOverlay: true,
      renderType: 'bar',
    });
    expect(data.baseline.series.slots?.color).toBe('#0072B2');
    expect(data.comparison.series.slots?.color).toBe('#E69F00');
    expect(data.delta.series['Baseline higher']?.color).toBe(DIFF_NEGATIVE_COLOR);
    expect(data.delta.series['Comparison higher']?.color).toBe(DIFF_POSITIVE_COLOR);
  });

  it('aligns delta overlays to the comparison timeline bins', () => {
    const response: DiffTimelineResponse = {
      timelines: [
        makeTimeline({ slots: [100, 100, 100, 100] }, { start: 0, end: 4 }),
        makeTimeline({ slots: [90, 90, 120, 120] }, { start: 0, end: 4 }),
      ],
      delta: makeTimeline(
        {
          'Query A higher': [10, 0],
          'Query B higher': [0, 20],
        },
        { start: 0, end: 4 }
      ),
    };

    const data = buildDiffTimelineData({
      timelineDiff: response,
      theme: 'light',
      queryColors: { baseline: '#0072B2', comparison: '#E69F00' },
    });

    expect(data.comparisonWithDelta.timestamps).toEqual(data.comparison.timestamps);
    expect(data.comparisonWithDelta.series['Delta: Baseline higher']).toMatchObject({
      values: [-10, -10, 0, 0],
      binDuration: 1,
    });
    expect(data.comparisonWithDelta.series['Delta: Comparison higher']).toMatchObject({
      values: [0, 0, 20, 20],
      binDuration: 1,
    });
  });

  it('builds capped relative values for heatmap rows', () => {
    const response: DiffTimelineResponse = {
      timelines: [makeTimeline({ slots: [100, 0, 50] }), makeTimeline({ slots: [50, 25, 200] })],
      delta: makeTimeline({
        'Query A higher': [50, 0, 0],
        'Query B higher': [0, 25, 150],
      }),
    };

    const timelineData = buildDiffTimelineData({
      timelineDiff: response,
      theme: 'light',
      queryColors: { baseline: '#0072B2', comparison: '#E69F00' },
    });

    const row = buildDiffHeatmapRowData(timelineData);

    expect(row.baselineValues).toEqual([100, 0, 50]);
    expect(row.comparisonValues).toEqual([50, 25, 200]);
    expect(row.signedDeltaValues).toEqual([-50, 25, 150]);
    expect(row.relativeValues).toEqual([-0.5, 1, 3]);
    expect(row.colorValues).toEqual([-0.5, 1, 1]);
  });
});

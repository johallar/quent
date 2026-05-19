// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { SingleTimelineResponse } from '@quent/utils';
import type { QueryProfileDiffTimelineResponse } from '@quent/client';
import { DIFF_NEGATIVE_COLOR, DIFF_POSITIVE_COLOR } from './QueryDiffColors';
import { buildDiffTimelineData } from './QueryDiffTimeline.utils';

function makeTimeline(values: Record<string, number[]>): SingleTimelineResponse {
  const firstValues = Object.values(values)[0] ?? [];
  const config = {
    span: { start: 0, end: firstValues.length },
    bin_duration: 1,
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
    const response: QueryProfileDiffTimelineResponse = {
      timelines: [makeTimeline({ slots: [100, 100] }), makeTimeline({ slots: [0, 0] })],
      delta: makeTimeline({
        'Query A higher': [2, 0],
        'Query B higher': [0, 3],
      }),
    };

    const data = buildDiffTimelineData({
      timelineDiff: response,
      theme: 'light',
      queryColors: { queryA: '#0072B2', queryB: '#E69F00' },
    });

    expect(data.queryA.series.slots?.values).toEqual([100, 100]);
    expect(data.queryB.series.slots?.values).toEqual([0, 0]);
    expect(data.delta.series['Query A higher']?.values).toEqual([2, 0]);
    expect(data.delta.series['Query B higher']?.values).toEqual([0, 3]);
    expect(data.queryA.series.slots?.color).toBe('#0072B2');
    expect(data.queryB.series.slots?.color).toBe('#E69F00');
    expect(data.delta.series['Query A higher']?.color).toBe(DIFF_NEGATIVE_COLOR);
    expect(data.delta.series['Query B higher']?.color).toBe(DIFF_POSITIVE_COLOR);
  });
});

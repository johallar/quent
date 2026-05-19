// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { SingleTimelineResponse } from '@quent/utils';
import { buildDiffTimelineData } from './QueryDiffTimeline.utils';

function makeTimeline(values: number[]): SingleTimelineResponse {
  const config = {
    span: { start: 0, end: values.length },
    bin_duration: 1,
    num_bins: BigInt(values.length),
  };

  return {
    config,
    data: {
      Binned: {
        config,
        capacities_values: { slots: values },
        long_fsms: [],
      },
    },
  };
}

describe('buildDiffTimelineData', () => {
  it('splits positive and negative aggregate deltas into direction series', () => {
    const data = buildDiffTimelineData({
      queryATimeline: makeTimeline([3, 1]),
      queryBTimeline: makeTimeline([1, 4]),
      durationSeconds: 2,
      theme: 'light',
    });

    expect(data.queryA.series.slots?.values).toEqual([3, 1]);
    expect(data.queryB.series.slots?.values).toEqual([1, 4]);
    expect(data.delta.series['Query A higher']?.values[0]).toBe(2);
    expect(data.delta.series['Query B higher']?.values[0]).toBe(0);
    expect(data.delta.series['Query A higher']?.values[150]).toBe(0);
    expect(data.delta.series['Query B higher']?.values[150]).toBe(3);
  });
});

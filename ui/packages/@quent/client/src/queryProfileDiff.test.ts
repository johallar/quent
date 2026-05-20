// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  queryProfileDiffQueryOptions,
  queryProfileDiffTimelineQueryOptions,
} from './queryProfileDiff';
import type { QueryProfileDiffTimelineRequest } from './queryProfileDiffTypes';

describe('queryProfileDiffQueryOptions', () => {
  it('builds a stable key from both engine and query ids', () => {
    const options = queryProfileDiffQueryOptions({
      request: {
        query_a: { engine_id: 'engine-a', query_id: 'query-a' },
        query_b: { engine_id: 'engine-b', query_id: 'query-b' },
      },
    });

    expect(options.queryKey).toEqual([
      'queryProfileDiff',
      'engine-a',
      'query-a',
      'engine-b',
      'query-b',
    ]);
  });

  it('builds diff timeline options around the full request', () => {
    const request: QueryProfileDiffTimelineRequest = {
      timelines: [
        {
          engine_id: 'engine-a',
          timeline: {
            entry: {
              ResourceGroup: {
                resource_group_id: 'root-a',
                resource_type_name: 'GPU',
                long_entities_threshold_s: null,
                entity_filter: { entity_type_name: null },
                app_params: { operator_id: null },
                config: { num_bins: 200, start: 0, end: 10 },
              },
            },
            app_params: { query_id: 'query-a' },
          },
        },
        {
          engine_id: 'engine-b',
          timeline: {
            entry: {
              ResourceGroup: {
                resource_group_id: 'root-b',
                resource_type_name: 'GPU',
                long_entities_threshold_s: null,
                entity_filter: { entity_type_name: null },
                app_params: { operator_id: null },
                config: { num_bins: 200, start: 0, end: 12 },
              },
            },
            app_params: { query_id: 'query-b' },
          },
        },
      ],
      delta_config: { num_bins: 200, start: 0, end: 12 },
    };

    const options = queryProfileDiffTimelineQueryOptions({ request });

    expect(options.queryKey).toEqual(['queryProfileDiffTimeline', request]);
  });
});

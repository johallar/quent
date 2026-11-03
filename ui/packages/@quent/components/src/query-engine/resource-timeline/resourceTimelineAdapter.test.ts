// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { EntityTypeKey, MAX_TIMELINE_BINS } from '@quent/utils';
import type { BinnedSpanSec, ResourceTimeline } from '@quent/utils/query-engine';
import {
  adaptResourceTimelineResponse,
  buildSingleTimelineRequest,
} from './resourceTimelineAdapter';

const config: BinnedSpanSec = {
  span: { start: 2, end: 4 },
  bin_duration: 0.5,
  num_bins: 4n,
};

describe('buildSingleTimelineRequest', () => {
  it('builds a resource request for the selected zoom range', () => {
    const request = buildSingleTimelineRequest({
      queryId: 'query-1',
      resourceId: 'resource-1',
      resourceType: EntityTypeKey.Resource,
      fsmTypeName: 'Task',
      startSeconds: 3,
      endSeconds: 7,
    });

    expect(request.app_params).toEqual({ query_id: 'query-1' });
    expect(request.entry).toEqual({
      Resource: {
        resource_id: 'resource-1',
        long_entities_threshold_s: null,
        entity_filter: { entity_type_name: 'Task' },
        application: { operator_ids: [] },
        config: { num_bins: MAX_TIMELINE_BINS, start: 3, end: 7 },
      },
    });
  });

  it('builds a resource-group request with its resolved resource type', () => {
    const request = buildSingleTimelineRequest({
      queryId: 'query-1',
      resourceId: 'group-1',
      resourceType: EntityTypeKey.ResourceGroup,
      resourceTypeName: 'GPU',
      fsmTypeName: null,
      startSeconds: 0,
      endSeconds: 9,
    });

    expect(request.entry).toEqual({
      ResourceGroup: {
        resource_group_id: 'group-1',
        resource_type_name: 'GPU',
        long_entities_threshold_s: null,
        entity_filter: { entity_type_name: null },
        app_params: { operator_ids: [] },
        config: { num_bins: MAX_TIMELINE_BINS, start: 0, end: 9 },
      },
    });
  });
});

describe('adaptResourceTimelineResponse', () => {
  it('adapts state-binned wire data without exposing the response shape', () => {
    const colorFsmState = vi.fn((state: string) => `color:${state}`);
    const data: ResourceTimeline = {
      BinnedByState: {
        config,
        capacities_states_values: {
          capacity: { running: [1, 2, 3, 4], idle: [0, 1, 0, 1] },
        },
        long_fsms: [],
      },
    };

    const result = adaptResourceTimelineResponse(data, config, {
      colorFsmState,
      allFsmsColor: 'all',
      emptySeriesColor: 'transparent',
    });

    expect(result).toMatchObject({
      spanStartSeconds: 2,
      binDurationSeconds: 0.5,
      numBins: 4,
      emptySeriesColor: 'transparent',
    });
    expect(result.entries).toEqual([
      expect.objectContaining({ name: 'running', color: 'color:running', values: [1, 2, 3, 4] }),
      expect.objectContaining({ name: 'idle', color: 'color:idle', values: [0, 1, 0, 1] }),
    ]);
  });
});

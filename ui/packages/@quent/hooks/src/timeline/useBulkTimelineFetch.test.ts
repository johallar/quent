// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { OperatorFilter, TimelineRequest } from '@quent/utils';
import { buildMergedBulkEntries } from './useBulkTimelineFetch';

function makeRequest(thresholdSeconds: number): TimelineRequest<OperatorFilter> {
  return {
    Resource: {
      resource_id: 'resource-1',
      long_entities_threshold_s: thresholdSeconds,
      entity_filter: { entity_type_name: null },
      application: { operator_ids: [] },
      config: { start: 0, end: 200, num_bins: 200 },
    },
  };
}

describe('buildMergedBulkEntries', () => {
  it('includes the effective threshold in request and cache identities', () => {
    const automatic = buildMergedBulkEntries({ 'resource-1': makeRequest(30) }, null);
    const manual = buildMergedBulkEntries({ 'resource-1': makeRequest(60) }, null);

    expect(automatic.requestKey).not.toBe(manual.requestKey);
    expect(manual.idToMeta.get('resource-1:base')?.longEntitiesThresholdSeconds).toBe(60);
  });
});

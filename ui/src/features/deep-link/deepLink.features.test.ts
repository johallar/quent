// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { DeepLinkFields } from './deepLink.fields';
import {
  filterDeepLinkFieldsForFeatures,
  filterDeepLinkStateForFeatures,
} from './deepLink.features';
import type { DeepLinkStateV3 } from './deepLink.schema';

const RESOURCE_ONLY_FEATURES = { queryPlan: false, dataFlow: false };

describe('feature-aware deep links', () => {
  it('ignores incoming state owned by unavailable plan features', () => {
    const fields: DeepLinkFields = {
      route: { engineId: 'e', queryId: 'q', tab: 'timeline' },
      zoomRange: { start: 10, end: 20 },
      expandedResourceIds: ['resource-a'],
      selection: { planId: 'plan-a', operatorNodeIds: ['operator-a'] },
      resources: { expandedRowIds: ['resource-a'] },
      dag: { nodeColorField: 'duration_s' },
      dataFlow: { enabled: true, measure: 'bytes' },
      operatorTable: { visibleStats: ['duration_s'] },
      entities: { entityType: 'Task' },
    };

    expect(filterDeepLinkFieldsForFeatures(fields, RESOURCE_ONLY_FEATURES)).toEqual({
      ...fields,
      selection: undefined,
      dag: undefined,
      dataFlow: undefined,
      operatorTable: undefined,
    });
  });

  it('omits unavailable feature state from copied links', () => {
    const state: DeepLinkStateV3 = {
      route: { engineId: 'e', queryId: 'q', tab: 'timeline' },
      timeline: { zoomRange: { start: 10, end: 20 } },
      selection: { planId: 'plan-a', operatorNodeIds: ['operator-a'] },
      resources: { expandedRowIds: ['resource-a'] },
      dag: { nodeColorField: 'duration_s' },
      dataFlow: { enabled: true, measure: 'bytes' },
      operatorTable: { visibleStats: ['duration_s'] },
      entities: { entityType: 'Task' },
    };

    expect(filterDeepLinkStateForFeatures(state, RESOURCE_ONLY_FEATURES)).toEqual({
      route: state.route,
      timeline: state.timeline,
      resources: state.resources,
      entities: state.entities,
    });
  });
});

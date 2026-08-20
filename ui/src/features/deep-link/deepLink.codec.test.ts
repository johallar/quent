// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildDeepLinkUrl,
  CURRENT_DEEP_LINK_VERSION,
  decodeDeepLinkState,
  encodeDeepLinkState,
  MAX_DEEP_LINK_URL_LENGTH,
  SUPPORTED_DEEP_LINK_VERSIONS,
} from './deepLink.codec';
import {
  DeepLinkStateV2Schema,
  DeepLinkStateV1Schema,
  MAX_EXPANDED_RESOURCE_IDS,
  type DeepLinkStateV2,
  validateDeepLinkSearch,
} from './deepLink.schema';
import { MAX_RESOURCE_FILTER_QUERY_LENGTH } from '@/features/resource-filter/resourceFilter';

const state: DeepLinkStateV2 = {
  route: {
    engineId: 'engine-a',
    queryId: 'query-a',
    tab: 'operators',
  },
  timeline: {
    zoomRange: {
      start: 12.5,
      end: 48.75,
    },
  },
  selection: {
    planId: 'plan-a',
    operatorNodeIds: ['operator-a', 'operator-b'],
  },
  resources: {
    expandedRowIds: ['resource-a', 'resource-b'],
    resourceFilter: 'id:resource-a,resource-b',
    rootResourceType: 'memory',
    resourceTypeSelections: [{ rowId: 'resource-a', resourceType: 'channel' }],
    fsmSelections: [{ rowId: 'resource-a', fsmType: 'task' }],
  },
  dag: {
    nodeColorField: 'duration_s',
    nodeColorPalette: 'viridis',
    edgeWidthField: 'bytes',
    edgeColorField: 'rows',
    edgeColorPalette: 'purple',
    nodeLabelField: 'type',
    layoutDirection: 'top-to-bottom',
  },
  dataFlow: {
    enabled: false,
    measure: 'bytes',
    labelMeasure: 'tasks',
    dimensions: ['filesystem'],
    playheadS: 18,
  },
  operatorTable: {
    groupingOrder: ['partition', 'item_type', 'item'],
    enabledGroups: ['partition', 'item_type'],
    visibleStats: ['duration_s', 'spill_bytes'],
    aggregation: 'max',
    sort: [{ id: 'spill_bytes', desc: true }],
  },
};

describe('deep-link codec', () => {
  it('round-trips deterministically', () => {
    const first = encodeDeepLinkState(state);
    const second = encodeDeepLinkState(state);

    expect(first).toEqual(second);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(decodeDeepLinkState(first.value)).toEqual({ ok: true, value: state });
  });

  it('keeps the current version in the supported schema registry', () => {
    expect(SUPPORTED_DEEP_LINK_VERSIONS).toContain(CURRENT_DEEP_LINK_VERSION);
    expect(new Set(SUPPORTED_DEEP_LINK_VERSIONS).size).toBe(SUPPORTED_DEEP_LINK_VERSIONS.length);
  });

  it('rejects unsupported versions and malformed payloads', () => {
    expect(decodeDeepLinkState('v999.abc')).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
    expect(decodeDeepLinkState('v2.not-gzip')).toMatchObject({
      ok: false,
      code: 'invalid-encoding',
    });
  });

  it('decodes legacy v1 links', () => {
    const encoded = 'v1.H4sIAAAAAAACA6tWqsrPzw1KzEtPVbKqViouSSwqUbIy0FFKzUsB0nomBua1tQAidcVYJQAAAA';

    expect(decodeDeepLinkState(encoded)).toEqual({
      ok: true,
      value: { zoomRange: { start: 0, end: 0.407 } },
    });
  });

  it('builds links within the absolute URL budget', () => {
    const result = buildDeepLinkUrl(
      'https://quent.example.test/profile/engine/e/query/q/timeline',
      state
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.length).toBeLessThanOrEqual(MAX_DEEP_LINK_URL_LENGTH);
    expect(new URL(result.value).searchParams.get('s')).toMatch(
      new RegExp(`^${CURRENT_DEEP_LINK_VERSION}\\.`)
    );
  });

  it('rejects an absolute URL whose origin and path exhaust the budget', () => {
    const result = buildDeepLinkUrl(
      `https://quent.example.test/${'x'.repeat(MAX_DEEP_LINK_URL_LENGTH)}`,
      state
    );

    expect(result).toMatchObject({ ok: false, code: 'url-too-long' });
  });
});

describe('deep-link search validation', () => {
  it('strips unknown keys and rejects non-string state', () => {
    expect(validateDeepLinkSearch({ s: 'v1.abc', extra: true })).toEqual({ s: 'v1.abc' });
    expect(validateDeepLinkSearch({ s: 42 })).toEqual({});
  });
});

describe('deep-link state validation', () => {
  it('validates and canonicalizes comprehensive v2 state', () => {
    expect(DeepLinkStateV2Schema.parse({ ...state, futureField: true })).toEqual(state);
    expect(
      DeepLinkStateV2Schema.parse({
        route: state.route,
        timeline: state.timeline,
        resources: { expandedRowIds: ['resource-b', 'resource-a', 'resource-b'] },
      }).resources?.expandedRowIds
    ).toEqual(['resource-a', 'resource-b']);
    expect(
      DeepLinkStateV2Schema.safeParse({
        route: state.route,
        timeline: { zoomRange: { start: 20, end: 10 } },
      }).success
    ).toBe(false);
    expect(
      DeepLinkStateV2Schema.safeParse({
        route: state.route,
        timeline: state.timeline,
        resources: {
          expandedRowIds: Array.from(
            { length: MAX_EXPANDED_RESOURCE_IDS + 1 },
            (_, index) => `resource-${index}`
          ),
        },
      }).success
    ).toBe(false);
    expect(
      DeepLinkStateV2Schema.safeParse({
        route: state.route,
        timeline: state.timeline,
        resources: { resourceFilter: 'x'.repeat(MAX_RESOURCE_FILTER_QUERY_LENGTH + 1) },
      }).success
    ).toBe(false);
  });

  it('keeps the legacy v1 schema available for old links', () => {
    expect(
      DeepLinkStateV1Schema.parse({
        zoomRange: { start: 1, end: 2 },
        expandedResourceIds: ['b', 'a'],
      })
    ).toEqual({
      zoomRange: { start: 1, end: 2 },
      expandedResourceIds: ['a', 'b'],
    });
  });
});

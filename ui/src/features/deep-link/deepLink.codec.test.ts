// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildDeepLinkUrl,
  decodeDeepLinkState,
  encodeDeepLinkState,
  MAX_DEEP_LINK_URL_LENGTH,
} from './deepLink.codec';
import {
  DeepLinkStateV1Schema,
  MAX_EXPANDED_RESOURCE_IDS,
  validateDeepLinkSearch,
} from './deepLink.schema';

const state = {
  zoomRange: {
    start: 12.5,
    end: 48.75,
  },
  expandedResourceIds: ['resource-a', 'resource-b'],
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

  it('rejects unsupported versions and malformed payloads', () => {
    expect(decodeDeepLinkState('v2.abc')).toMatchObject({
      ok: false,
      code: 'unsupported-version',
    });
    expect(decodeDeepLinkState('v1.not-gzip')).toMatchObject({
      ok: false,
      code: 'invalid-encoding',
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
    expect(new URL(result.value).searchParams.get('s')).toMatch(/^v1\./u);
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
  it('strips unknown keys, validates the viewport, and canonicalizes expanded IDs', () => {
    expect(DeepLinkStateV1Schema.parse({ ...state, futureField: true })).toEqual(state);
    expect(
      DeepLinkStateV1Schema.parse({
        zoomRange: state.zoomRange,
        expandedResourceIds: ['resource-b', 'resource-a', 'resource-b'],
      }).expandedResourceIds
    ).toEqual(['resource-a', 'resource-b']);
    expect(DeepLinkStateV1Schema.safeParse({ zoomRange: { start: 20, end: 10 } }).success).toBe(
      false
    );
    expect(
      DeepLinkStateV1Schema.safeParse({
        zoomRange: state.zoomRange,
        expandedResourceIds: Array.from(
          { length: MAX_EXPANDED_RESOURCE_IDS + 1 },
          (_, index) => `resource-${index}`
        ),
      }).success
    ).toBe(false);
  });
});

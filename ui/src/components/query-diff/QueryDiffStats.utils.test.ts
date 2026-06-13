// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildRuntimeComparison,
  buildRuntimeComparisonFromDelta,
  formatPercentDelta,
  formatSignedDurationSeconds,
  getDefaultOperatorDiffStatName,
  sortOperatorDiffStatNames,
  toDisplayDelta,
  toDisplayPercentDelta,
} from './QueryDiffStats.utils';

describe('toDisplayDelta — "negative is good"', () => {
  it('inverts the sign of positive deltas', () => {
    expect(toDisplayDelta(5)).toBe(-5);
  });
  it('inverts the sign of negative deltas', () => {
    expect(toDisplayDelta(-3)).toBe(3);
  });
  it('normalizes signed zero to 0', () => {
    expect(toDisplayDelta(0)).toBe(0);
    expect(Object.is(toDisplayDelta(-0), 0)).toBe(true);
  });
});

describe('toDisplayPercentDelta', () => {
  it('preserves null', () => {
    expect(toDisplayPercentDelta(null)).toBeNull();
  });
  it('inverts sign', () => {
    expect(toDisplayPercentDelta(0.25)).toBeCloseTo(-0.25);
    expect(toDisplayPercentDelta(-0.5)).toBeCloseTo(0.5);
  });
  it('normalizes signed zero', () => {
    expect(toDisplayPercentDelta(0)).toBe(0);
    expect(Object.is(toDisplayPercentDelta(-0), 0)).toBe(true);
  });
});

describe('buildRuntimeComparison', () => {
  it('computes delta and percent', () => {
    expect(buildRuntimeComparison(40, 32)).toEqual({
      a: 40,
      b: 32,
      delta: 8,
      percentDelta: 0.25,
    });
  });
  it('returns null percent when comparison is 0', () => {
    expect(buildRuntimeComparison(5, 0).percentDelta).toBeNull();
  });
});

describe('buildRuntimeComparisonFromDelta', () => {
  it('uses contract delta and percent when present', () => {
    expect(
      buildRuntimeComparisonFromDelta({
        stats: [40, 44],
        delta: -4,
        percent_delta: -0.0909,
      })
    ).toEqual({ a: 40, b: 44, delta: -4, percentDelta: -0.0909 });
  });
  it('falls back to zero when stats are missing', () => {
    expect(buildRuntimeComparisonFromDelta(undefined)).toEqual({
      a: 0,
      b: 0,
      delta: 0,
      percentDelta: null,
    });
  });
});

describe('sortOperatorDiffStatNames', () => {
  it('puts duration_s first when present', () => {
    expect(sortOperatorDiffStatNames(['input_rows', 'duration_s', 'output_rows'])).toEqual([
      'duration_s',
      'input_rows',
      'output_rows',
    ]);
  });
  it('sorts alphabetically when no priority match', () => {
    expect(sortOperatorDiffStatNames(['z', 'a', 'm'])).toEqual(['a', 'm', 'z']);
  });
});

describe('getDefaultOperatorDiffStatName', () => {
  it('returns null when empty', () => {
    expect(getDefaultOperatorDiffStatName([])).toBeNull();
  });
  it('returns the first sorted name', () => {
    expect(getDefaultOperatorDiffStatName(['b', 'a'])).toBe('a');
  });
});

describe('formatters', () => {
  it('formatSignedDurationSeconds', () => {
    expect(formatSignedDurationSeconds(0)).toBe(formatSignedDurationSeconds(-0));
    expect(formatSignedDurationSeconds(1)).toMatch(/^\+/);
    expect(formatSignedDurationSeconds(-1)).toMatch(/^-/);
  });
  it('formatPercentDelta', () => {
    expect(formatPercentDelta(null)).toBe('-');
    expect(formatPercentDelta(0)).toBe('0.0%');
    expect(formatPercentDelta(0.1234)).toBe('+12.3%');
    expect(formatPercentDelta(-0.5)).toBe('-50.0%');
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LONG_ENTITY_THRESHOLD_SECONDS,
  MAX_LONG_ENTITY_THRESHOLD_SECONDS,
  MIN_LONG_ENTITY_THRESHOLD_SECONDS,
  clampLongEntityThresholdSeconds,
} from './longEntityThreshold';

describe('clampLongEntityThresholdSeconds', () => {
  it('clamps values to the supported range', () => {
    expect(clampLongEntityThresholdSeconds(0)).toBe(MIN_LONG_ENTITY_THRESHOLD_SECONDS);
    expect(clampLongEntityThresholdSeconds(1_000)).toBe(MAX_LONG_ENTITY_THRESHOLD_SECONDS);
  });

  it('snaps values to tenths of a second', () => {
    expect(clampLongEntityThresholdSeconds(12.34)).toBe(12.3);
    expect(clampLongEntityThresholdSeconds(12.36)).toBe(12.4);
  });

  it('uses the default for non-finite values', () => {
    expect(clampLongEntityThresholdSeconds(Number.NaN)).toBe(DEFAULT_LONG_ENTITY_THRESHOLD_SECONDS);
  });
});

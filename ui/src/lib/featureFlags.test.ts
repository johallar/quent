// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it, vi } from 'vitest';
import { isFeatureEnabled } from './featureFlags';

describe('feature flags', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults QUERY_DIFF to enabled', () => {
    expect(isFeatureEnabled('QUERY_DIFF')).toBe(true);
  });

  it('disables QUERY_DIFF when the Vite env flag is false', () => {
    vi.stubEnv('VITE_QUERY_DIFF', 'false');
    expect(isFeatureEnabled('QUERY_DIFF')).toBe(false);
  });
});

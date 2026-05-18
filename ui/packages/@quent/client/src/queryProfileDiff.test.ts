// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { queryProfileDiffQueryOptions } from './queryProfileDiff';

describe('queryProfileDiffQueryOptions', () => {
  it('builds a stable key from engine and query ids', () => {
    const options = queryProfileDiffQueryOptions({
      engineId: 'engine-1',
      request: { query_a_id: 'query-a', query_b_id: 'query-b' },
    });

    expect(options.queryKey).toEqual(['queryProfileDiff', 'engine-1', 'query-a', 'query-b']);
  });
});

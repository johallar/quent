// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { afterEach, describe, expect, it } from 'vitest';
import { resetColorAssignments } from '@quent/utils';
import {
  DIFF_NEGATIVE_COLOR,
  DIFF_POSITIVE_COLOR,
  getQueryDiffQueryColors,
} from './QueryDiffColors';

describe('QueryDiffColors', () => {
  afterEach(() => resetColorAssignments());

  it('uses the Tol palette green and red for diff values', () => {
    expect(DIFF_POSITIVE_COLOR).toBe('#44AA99');
    expect(DIFF_NEGATIVE_COLOR).toBe('#CC6677');
  });

  it('assigns distinct palette colors to the compared queries', () => {
    const colors = getQueryDiffQueryColors({
      queryAId: 'query-a',
      queryBId: 'query-b',
      theme: 'light',
    });

    expect(colors.queryA).not.toBe(colors.queryB);
  });

  it('keeps colors distinct when the same query id is compared', () => {
    const colors = getQueryDiffQueryColors({
      queryAId: 'query-a',
      queryBId: 'query-a',
      theme: 'light',
    });

    expect(colors.queryA).not.toBe(colors.queryB);
  });
});

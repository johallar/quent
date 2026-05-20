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

  it('uses Tol red for positive values and Tol green for negative values', () => {
    expect(DIFF_POSITIVE_COLOR).toBe('#CC6677');
    expect(DIFF_NEGATIVE_COLOR).toBe('#44AA99');
  });

  it('assigns distinct palette colors to the compared queries', () => {
    const colors = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      competitorQueryId: 'query-b',
      theme: 'light',
    });

    expect(colors.baseline).not.toBe(colors.competitor);
  });

  it('keeps colors distinct when the same query id is compared', () => {
    const colors = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      competitorQueryId: 'query-a',
      theme: 'light',
    });

    expect(colors.baseline).not.toBe(colors.competitor);
  });

  it('assigns different colors to multiple competitor queries', () => {
    const firstCompetitor = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      competitorQueryId: 'query-b',
      competitorIndex: 0,
      theme: 'light',
    });
    const secondCompetitor = getQueryDiffQueryColors({
      baselineQueryId: 'query-a',
      competitorQueryId: 'query-c',
      competitorIndex: 1,
      theme: 'light',
    });

    expect(firstCompetitor.baseline).toBe(secondCompetitor.baseline);
    expect(firstCompetitor.competitor).not.toBe(secondCompetitor.competitor);
  });
});

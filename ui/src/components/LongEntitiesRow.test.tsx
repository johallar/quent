// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LongEntitiesRow } from './LongEntitiesRow';

const mocks = vi.hoisted(() => ({
  getLongEntitiesThreshold: vi.fn((_windowSeconds: number) => 0.06),
  longEntitiesGantt: vi.fn((_props: { height: number }) => null),
  useEntityList: vi.fn(() => ({ data: undefined, isFetching: false })),
}));

vi.mock('@quent/client', () => ({
  useEntityList: mocks.useEntityList,
}));

vi.mock('@quent/hooks', () => ({
  useDebouncedZoomRange: () => ({ start: 0.2, end: 0.6 }),
  useSelectedNodeIds: () => new Set(['operator-1']),
}));

vi.mock('@quent/components', () => ({
  LONG_ENTITIES_TIMELINE_HEIGHT: 110,
  LongEntitiesGantt: mocks.longEntitiesGantt,
  buildLongEntityEntries: () => [],
  getLongEntitiesThreshold: mocks.getLongEntitiesThreshold,
}));

describe('LongEntitiesRow', () => {
  it('filters the entity request using the visible timeline window', () => {
    render(
      <LongEntitiesRow
        engineId="engine-1"
        queryId="query-1"
        resourceId="resource-1"
        durationSeconds={1}
        fsmTypes={{}}
        isDark={false}
      />
    );

    expect(mocks.getLongEntitiesThreshold.mock.calls[0]?.[0]).toBeCloseTo(0.4);
    expect(mocks.useEntityList).toHaveBeenCalledWith(
      expect.objectContaining({
        window: { start: 0.2, end: 0.6 },
        operatorIds: ['operator-1'],
        minUsageSeconds: 0.06,
      })
    );
    expect(mocks.longEntitiesGantt.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ height: 110 })
    );
  });
});

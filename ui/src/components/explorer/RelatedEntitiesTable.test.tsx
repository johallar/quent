// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntityRef, QueryBundle } from '@quent/utils';
import * as client from '@quent/client';
import { RelatedEntitiesTable } from './RelatedEntitiesTable';

vi.mock('@quent/client', async importOriginal => {
  const actual = await importOriginal<typeof client>();
  return { ...actual, useEntityList: vi.fn() };
});

vi.mock('@quent/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@quent/hooks')>();
  return {
    ...actual,
    useDebouncedZoomRange: () => ({ start: 10, end: 20 }),
    useSelectedNodeIds: () => new Set(['operator-1']),
  };
});

const queryBundle = {
  query_id: 'query-1',
  entities: {
    resources: {
      'resource-1': { id: 'resource-1', type_name: 'GPU', instance_name: 'GPU 1' },
    },
    resource_types: {
      GPU: { used_by: ['Task'], capacities: [] },
    },
  },
} as unknown as QueryBundle<EntityRef>;

describe('RelatedEntitiesTable', () => {
  beforeEach(() => {
    vi.mocked(client.useEntityList).mockReturnValue({
      data: { items: [], total: 0 },
      isFetching: false,
      error: null,
    } as unknown as ReturnType<typeof client.useEntityList>);
  });

  it('scopes the entity query to the focus, viewport, and selected operator', () => {
    render(
      <RelatedEntitiesTable
        engineId="engine-1"
        queryBundle={queryBundle}
        focusedResourceId="resource-1"
      />
    );

    expect(client.useEntityList).toHaveBeenCalledWith(
      expect.objectContaining({
        engineId: 'engine-1',
        queryId: 'query-1',
        window: { start: 10, end: 20 },
        operatorId: 'operator-1',
        filter: {
          scope: { Resource: { resource_id: 'resource-1' } },
          entityTypeName: null,
        },
      }),
      { enabled: true }
    );
    expect(screen.getByText('0 related entities')).toBeInTheDocument();
  });
});

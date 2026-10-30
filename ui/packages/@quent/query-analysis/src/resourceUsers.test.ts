// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EntityRef, QueryBundle } from '@quent/utils';
import { describe, expect, it } from 'vitest';
import { prepareLongestResourceUsers } from './resourceUsers';

function bundle(): QueryBundle<EntityRef> {
  return {
    query_id: 'query-1',
    duration_s: 12,
    entities: {
      plans: {
        'plan-1': {
          id: 'plan-1',
          instance_name: 'Plan 1',
          parent: null,
          worker_id: null,
          edges: [],
        },
      },
      operators: {
        'operator-1': {
          id: 'operator-1',
          plan_id: 'plan-1',
          parent_operator_ids: [],
          instance_name: 'Scan 1',
          operator_type_name: 'Scan',
          custom_attributes: [],
          statistics: null,
          active_span: null,
        },
      },
      resource_types: {
        Memory: {
          name: 'Memory',
          capacities: [{ name: 'bytes', kind: 'Occupancy', quantity: 'bytes' }],
          display_order: [{ Type: 'Task' }],
        },
      },
      resources: {
        'resource-1': {
          id: 'resource-1',
          instance_name: 'Memory 0',
          type_name: 'Memory',
          parent_group_id: 'worker-1',
        },
      },
      fsm_types: {
        Task: { name: 'Task', states: [], transitions: [] },
      },
    },
  } as unknown as QueryBundle<EntityRef>;
}

describe('prepareLongestResourceUsers', () => {
  it('resolves bundle declarations and builds the entity-list request', () => {
    const preparation = prepareLongestResourceUsers(bundle(), {
      resourceId: 'resource-1',
      operatorIds: ['operator-1'],
      start: 1,
      end: 9,
      limit: 5,
    });

    expect(preparation).toMatchObject({
      window: { start: 1, end: 9 },
      resource: {
        id: 'resource-1',
        typeName: 'Memory',
        declaredCapacities: ['bytes'],
      },
      entityType: 'Task',
      operators: [{ id: 'operator-1', planId: 'plan-1' }],
      request: {
        entry: {
          window: { start: 1, end: 9 },
          filter: {
            scope: { Resource: { resource_id: 'resource-1' } },
            entity_type_name: 'Task',
          },
          page: { page: 0, max: 5 },
          application: { operator_ids: ['operator-1'] },
        },
        app_params: { query_id: 'query-1' },
      },
    });
  });

  it('rejects invalid windows and unknown bundle entities', () => {
    expect(() =>
      prepareLongestResourceUsers(bundle(), {
        resourceId: 'resource-1',
        operatorIds: [],
        start: 9,
        end: 1,
        limit: 5,
      })
    ).toThrow('0 <= start < end <= 12');
    expect(() =>
      prepareLongestResourceUsers(bundle(), {
        resourceId: 'missing',
        operatorIds: [],
        limit: 5,
      })
    ).toThrow('not present in the query bundle');
    expect(() =>
      prepareLongestResourceUsers(bundle(), {
        resourceId: 'resource-1',
        operatorIds: ['missing'],
        limit: 5,
      })
    ).toThrow('not present in the query bundle');
  });
});

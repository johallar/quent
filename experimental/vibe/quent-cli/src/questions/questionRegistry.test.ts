// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { gunzipSync } from 'node:zlib';
import type { EntityRef, QueryBundle } from '@quent/utils';
import type { EvidenceDeepLinkState } from '../deepLink';
import type { LongestResourceUsersResult } from './longestResourceUsers';
import { getQuestion, questionRegistry } from './questionRegistry';

function decodeDeepLinkState(encoded: string): {
  version: string;
  data: EvidenceDeepLinkState;
} {
  const [version, payload] = encoded.split('.', 2);
  if (!version || !payload) {
    throw new Error('Invalid deep link');
  }
  return {
    version,
    data: JSON.parse(
      gunzipSync(Buffer.from(payload, 'base64url')).toString('utf8')
    ) as EvidenceDeepLinkState,
  };
}

const bundle = {
  query_id: 'query-1',
  duration_s: 12,
  start_time_unix_ns: 0n,
  unique_operator_names: ['Scan'],
  quantity_specs: {},
  entities: {
    engine: { id: 'engine-1' },
    query_group: { id: 'group-1' },
    query: { id: 'query-1' },
    workers: {},
    plans: {
      'plan-1': { id: 'plan-1', instance_name: 'Plan 1' },
    },
    operators: {
      'operator-1': {
        id: 'operator-1',
        plan_id: 'plan-1',
        parent_operator_ids: [],
        instance_name: 'Scan 1',
        operator_type_name: 'Scan',
      },
    },
    ports: {},
    resource_types: {
      Memory: {
        name: 'Memory',
        capacities: [{ name: 'bytes', kind: 'Occupancy', quantity: 'bytes' }],
        used_by: ['Task'],
      },
    },
    resource_group_types: {},
    resources: {
      'resource-1': {
        id: 'resource-1',
        instance_name: 'Memory 0',
        type_name: 'Memory',
        parent_group_id: 'worker-1',
      },
    },
    resource_groups: {},
    fsm_types: {
      Task: { name: 'Task', states: [], transitions: [] },
    },
  },
  plan_tree: { id: 'plan-1', worker: null, children: [] },
  resource_tree: { Resource: { Resource: 'resource-1' } },
} as unknown as QueryBundle<EntityRef>;

function context(fetchEntityList = vi.fn()) {
  return {
    engineId: 'engine-1',
    queryId: 'query-1',
    appBaseUrl: 'https://quent.example.test',
    queryBundle: bundle,
    api: { fetchEntityList },
  };
}

describe('question registry', () => {
  it('registers stable question metadata and rejects unknown questions', () => {
    expect([...questionRegistry.keys()]).toEqual(['longest-resource-users']);
    expect(getQuestion('longest-resource-users').metadata).toMatchObject({
      id: 'longest-resource-users',
      version: 1,
    });
    expect(() => getQuestion('resource-magic')).toThrow(
      'Supported questions: longest-resource-users'
    );
  });

  it('answers longest-resource-users from the exact entity-list metric', async () => {
    const fetchEntityList = vi.fn().mockResolvedValue({
      items: [
        {
          entity: {
            id: 'task-1',
            type_name: 'Task',
            instance_name: 'Task 1',
            transitions: [],
          },
          usage_duration_s: 2.25,
        },
      ],
      total: 3,
    });
    const question = getQuestion('longest-resource-users');
    const result = await question.run(context(fetchEntityList), {
      resource: 'resource-1',
      operator: 'operator-1',
      start: '1',
      end: '9',
      limit: '5',
    });

    expect(fetchEntityList).toHaveBeenCalledWith('engine-1', {
      entry: {
        window: { start: 1, end: 9 },
        filter: {
          scope: { Resource: { resource_id: 'resource-1' } },
          entity_type_name: 'Task',
          min_usage_s: null,
        },
        sort: { key: 'UsageDuration', dir: 'Desc' },
        page: { page: 0, max: 5 },
        application: { operator_ids: ['operator-1'] },
      },
      app_params: { query_id: 'query-1' },
    });
    expect(result).toMatchObject({
      question: { id: 'longest-resource-users', version: 1 },
      evidence: { class: 'observed' },
      resolution: {
        source: 'entity-list',
        binCount: null,
        binDurationSeconds: null,
      },
      scope: {
        resource: {
          id: 'resource-1',
          typeName: 'Memory',
          declaredCapacities: ['bytes'],
        },
        entityType: 'Task',
        operators: [{ id: 'operator-1', planId: 'plan-1' }],
      },
      finding: {
        metric: 'longest-single-resource-usage-span',
        totalMatchingEntities: 3,
        entities: [{ id: 'task-1', longestUsageSeconds: 2.25 }],
      },
    });

    const encoded = new URL(result.deepLink).searchParams.get('s');
    expect(encoded).not.toBeNull();
    expect(decodeDeepLinkState(encoded!)).toEqual({
      version: 'v3',
      data: {
        route: { engineId: 'engine-1', queryId: 'query-1', tab: 'entities' },
        selection: { operatorNodeIds: ['operator-1'] },
        entities: {
          entityType: 'Task',
          resourceId: 'resource-1',
          window: { start: 1, end: 9 },
          sortDir: 'Desc',
          pageSize: 5,
          page: 0,
          selectedEntityId: 'task-1',
        },
      },
    });
    expect(question.formatHuman(result)).toContain(
      'Bins: not applicable — No timeline bins are used'
    );
    expect(question.formatHuman(result)).toContain('Capacity basis: none');
  });

  it('reports an empty observed result without selecting an entity', async () => {
    const fetchEntityList = vi.fn().mockResolvedValue({ items: [], total: 0 });
    const question = getQuestion('longest-resource-users');
    const result = (await question.run(context(fetchEntityList), {
      resource: 'resource-1',
    })) as LongestResourceUsersResult;

    expect(result.evidence.class).toBe('observed');
    expect(result.finding.entities).toEqual([]);
    expect(question.formatHuman(result)).toContain('no matching FSM entities');
    const encoded = new URL(result.deepLink).searchParams.get('s');
    const decoded = decodeDeepLinkState(encoded!);
    expect(decoded.version).toBe('v3');
    expect(decoded.data.entities.selectedEntityId).toBeUndefined();
  });

  it('rejects inputs not supported by the discovered query model', async () => {
    const fetchEntityList = vi.fn();
    const question = getQuestion('longest-resource-users');

    await expect(
      question.run(context(fetchEntityList), { resource: 'missing-resource' })
    ).rejects.toThrow('not present in the query bundle');
    await expect(
      question.run(context(fetchEntityList), {
        resource: 'resource-1',
        operator: 'missing-operator',
      })
    ).rejects.toThrow('not present in the query bundle');
    await expect(
      question.run(context(fetchEntityList), {
        resource: 'resource-1',
        start: '9',
        end: '1',
      })
    ).rejects.toThrow('0 <= start < end <= 12');
    expect(fetchEntityList).not.toHaveBeenCalled();
  });
});

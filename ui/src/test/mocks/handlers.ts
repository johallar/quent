// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { http, HttpResponse } from 'msw';
import type { Engine, Query, QueryGroup } from '@quent/utils';
import type { DiffQueryRef, DiffRequest, DiffResponse, QueryDiff } from '@quent/client';
import { equalPlanQueryDiffFixture } from './queryProfileDiffFixtures';

function makeEngine(id: string, instanceName: string): Engine {
  return {
    id,
    start_time_unix_ns: null,
    duration_s: null,
    instance_name: instanceName,
    implementation: null,
  };
}

function makeGroup(engineId: string, id: string, instanceName: string): QueryGroup {
  return { id, instance_name: instanceName, engine_id: engineId };
}

function makeQuery(groupId: string, id: string, instanceName: string): Query {
  return {
    id,
    query_group_id: groupId,
    instance_name: instanceName,
    start_unix_ns: null,
    planning_s: null,
    executing_s: null,
    completed_s: null,
  };
}

const ENGINE_FIXTURES: Engine[] = [
  makeEngine('engine-a', 'Engine A'),
  makeEngine('engine-b', 'Engine B'),
];

const GROUPS_BY_ENGINE: Record<string, QueryGroup[]> = {
  'engine-a': [makeGroup('engine-a', 'group-1', 'Group 1')],
  'engine-b': [makeGroup('engine-b', 'group-2', 'Group 2')],
};

const QUERIES_BY_GROUP: Record<string, Query[]> = {
  'group-1': [
    makeQuery('group-1', 'query-a', 'Query A'),
    makeQuery('group-1', 'query-c', 'Query C'),
  ],
  'group-2': [makeQuery('group-2', 'query-b', 'Query B')],
};

function queryDisplayName(queryId: string): string {
  const suffix = queryId.split('-').pop() ?? queryId;
  return `Query ${suffix.toUpperCase()}`;
}

function makeMockQueryDiff(query: DiffQueryRef, comparisonIndex: number): QueryDiff {
  const baselineDuration = 40;
  const comparisonDuration = 44 + comparisonIndex * 4;
  return {
    ...equalPlanQueryDiffFixture,
    query: {
      id: query.query_id,
      engine_id: query.engine_id,
      instance_name: queryDisplayName(query.query_id),
      query_group_id: query.query_id.endsWith('a') ? 'group-1' : 'group-2',
      query_group_name: query.query_id.endsWith('a') ? 'Group 1' : 'Group 2',
    },
    stat_diffs: {
      duration: {
        stats: [baselineDuration, comparisonDuration],
        delta: baselineDuration - comparisonDuration,
        percent_delta: (baselineDuration - comparisonDuration) / comparisonDuration,
      },
    },
  };
}

export const handlers = [
  http.get('*/api/engines', () => HttpResponse.json(ENGINE_FIXTURES)),

  http.get('*/api/engines/:engineId/query-groups', ({ params }) => {
    const engineId = String(params.engineId);
    return HttpResponse.json(GROUPS_BY_ENGINE[engineId] ?? []);
  }),

  http.get('*/api/engines/:engineId/query_group/:groupId/queries', ({ params }) => {
    const groupId = String(params.groupId);
    return HttpResponse.json(QUERIES_BY_GROUP[groupId] ?? []);
  }),

  http.get('*/api/engines/:engineId/query/:queryId', ({ params }) => {
    const engineId = String(params.engineId);
    const queryId = String(params.queryId);
    return HttpResponse.json({
      entities: {
        engine: ENGINE_FIXTURES.find(e => e.id === engineId) ?? makeEngine(engineId, engineId),
        query_group: GROUPS_BY_ENGINE[engineId]?.[0] ?? makeGroup(engineId, 'group-x', 'Group X'),
        query: makeQuery('group-x', queryId, queryDisplayName(queryId)),
      },
      query_plan: { nodes: [], edges: [] },
      resources: [],
      resource_groups: [],
      operators: [],
      tasks: [],
    });
  }),

  http.post('*/api/workload-diff', async ({ request }) => {
    const body = (await request.json()) as DiffRequest;
    return HttpResponse.json({
      comparison_queries: body.comparison_queries.map((query, index) =>
        makeMockQueryDiff(query, index)
      ),
    } satisfies DiffResponse);
  }),
];

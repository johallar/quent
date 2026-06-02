// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { http, HttpResponse } from 'msw';
import { MAX_TIMELINE_BINS } from '@quent/utils';
import type {
  BinnedSpanSec,
  BulkTimelineRequest,
  BulkTimelinesResponse,
  QueryFilter,
  SingleTimelineRequest,
  SingleTimelineResponse,
  TaskFilter,
  TimelineConfig,
  TimelineRequest,
} from '@quent/utils';
import type {
  DiffRequest,
  DiffResponse,
  DiffTimelineRequest,
  DiffTimelineResponse,
} from '@quent/client';

const QUERY_A_HIGHER_SERIES = 'Query A higher';
const QUERY_B_HIGHER_SERIES = 'Query B higher';

function hashString(value: string): number {
  return [...value].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
}

function entryConfig(entry: TimelineRequest<TaskFilter>): TimelineConfig {
  return 'ResourceGroup' in entry ? entry.ResourceGroup.config : entry.Resource.config;
}

function toBinnedSpanSec(config: TimelineConfig): BinnedSpanSec {
  const numBins = Math.max(1, Math.trunc(Number(config.num_bins || MAX_TIMELINE_BINS)));
  const start = Number(config.start);
  const end = Number(config.end);
  return {
    span: { start, end },
    bin_duration: end > start ? (end - start) / numBins : 0,
    num_bins: numBins as unknown as bigint,
  };
}

function roundTimelineValue(value: number): number {
  return Number(value.toFixed(3));
}

function makeMockTimelineResponse(
  request: SingleTimelineRequest<QueryFilter, TaskFilter>
): SingleTimelineResponse {
  const config = toBinnedSpanSec(entryConfig(request.entry));
  const numBins = Number(config.num_bins);
  const seed = hashString(request.app_params.query_id);
  const baseline = 1 + (seed % 7);
  const amplitude = 1 + (seed % 5) / 2;
  const values = Array.from({ length: numBins }, (_, index) => {
    const wave = Math.sin((index + seed) / 13);
    return roundTimelineValue(Math.max(0, baseline + wave * amplitude));
  });

  return {
    config,
    data: {
      Binned: {
        config,
        capacities_values: { usage: values },
        long_fsms: [],
      },
    },
  };
}

function timelineValueArrays(response: SingleTimelineResponse): number[][] {
  if ('Binned' in response.data) {
    return Object.values(response.data.Binned.capacities_values).filter(
      (values): values is number[] => Array.isArray(values)
    );
  }

  return Object.values(response.data.BinnedByState.capacities_states_values).flatMap(states =>
    Object.values(states ?? {}).filter((values): values is number[] => Array.isArray(values))
  );
}

function sampleAggregateAt(response: SingleTimelineResponse, targetSeconds: number): number {
  const binDuration = response.config.bin_duration;
  if (binDuration <= 0 || targetSeconds < response.config.span.start) return 0;

  const index = Math.floor((targetSeconds - response.config.span.start) / binDuration);
  if (index < 0 || index >= Number(response.config.num_bins)) return 0;

  return timelineValueArrays(response).reduce((sum, values) => sum + (values[index] ?? 0), 0);
}

function makeTimelineDiffResponse(
  request: DiffTimelineRequest,
  timelines: DiffTimelineResponse['timelines']
): DiffTimelineResponse {
  const [queryA, queryB] = timelines;
  const config = toBinnedSpanSec(request.delta_config);
  const queryAHigher: number[] = [];
  const queryBHigher: number[] = [];

  for (let index = 0; index < Number(config.num_bins); index += 1) {
    const targetSeconds = config.span.start + index * config.bin_duration;
    const delta =
      sampleAggregateAt(queryA, targetSeconds) - sampleAggregateAt(queryB, targetSeconds);
    queryAHigher.push(roundTimelineValue(Math.max(delta, 0)));
    queryBHigher.push(roundTimelineValue(Math.max(-delta, 0)));
  }

  return {
    timelines,
    delta: {
      config,
      data: {
        Binned: {
          config,
          capacities_values: {
            [QUERY_A_HIGHER_SERIES]: queryAHigher,
            [QUERY_B_HIGHER_SERIES]: queryBHigher,
          },
          long_fsms: [],
        },
      },
    },
  };
}

function apiUrlFromRequest(request: Request, pathname: string): string {
  return new URL(pathname, request.url).toString();
}

async function fetchJsonForDiff<T>(
  request: Request,
  pathname: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(apiUrlFromRequest(request, pathname), init);
  if (!response.ok) {
    throw new Error(`diff backend fetch failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

async function fetchSingleTimelineForDiff(
  request: Request,
  engineId: string,
  timeline: SingleTimelineRequest<QueryFilter, TaskFilter>
): Promise<SingleTimelineResponse> {
  return fetchJsonForDiff<SingleTimelineResponse>(
    request,
    `/api/engines/${encodeURIComponent(engineId)}/timeline/single`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(timeline),
    }
  );
}

/**
 * Default MSW handlers for mocking API responses
 * Add your API mocks here
 */
export const handlers = [
  // Example: List engines
  http.get('/api/engines', () => {
    return HttpResponse.json(['engine-1', 'engine-2', 'engine-3']);
  }),

  // Example: List coordinators for an engine
  http.get('/api/engines/:engineId/coordinators', ({ params }) => {
    const { engineId } = params;
    return HttpResponse.json([`${engineId}-coordinator-1`, `${engineId}-coordinator-2`]);
  }),

  // Example: List queries
  http.get('/api/engines/:engineId/coordinators/:coordinatorId/queries', () => {
    return HttpResponse.json(['query-1', 'query-2', 'query-3']);
  }),

  // Example: Get query details
  http.get('/api/queries/:queryId', ({ params }) => {
    const { queryId } = params;
    return HttpResponse.json({
      id: queryId,
      status: 'completed',
      createdAt: new Date().toISOString(),
    });
  }),

  // Example: Get node profile data
  http.get('/api/queries/:queryId/nodes/:nodeId/profile', ({ params }) => {
    const { nodeId } = params;
    const timestamps = Array.from({ length: 100 }, (_, i) => Date.now() - i * 1000);
    return HttpResponse.json({
      nodeId,
      timestamps,
      series: {
        CPU: Array.from({ length: 100 }, () => Math.random() * 100),
        Memory: Array.from({ length: 100 }, () => Math.random() * 1000),
        IO: Array.from({ length: 100 }, () => Math.random() * 500),
      },
    });
  }),

  http.post('*/api/engines/:engineId/timeline/single', async ({ request }) => {
    const body = (await request.json()) as SingleTimelineRequest<QueryFilter, TaskFilter>;
    return HttpResponse.json(makeMockTimelineResponse(body));
  }),

  http.post('*/api/engines/:engineId/timeline/bulk', async ({ request }) => {
    const body = (await request.json()) as BulkTimelineRequest<QueryFilter, TaskFilter>;
    const entries: BulkTimelinesResponse['entries'] = {};
    for (const [id, entry] of Object.entries(body.entries)) {
      if (!entry) continue;
      const response = makeMockTimelineResponse({ entry, app_params: body.app_params });
      entries[id] = {
        status: 'ok',
        message: '',
        config: response.config,
        data: response.data,
      };
    }
    return HttpResponse.json({ entries } satisfies BulkTimelinesResponse);
  }),

  http.post('*/api/workload-diff', async ({ request }) => {
    const body = (await request.json()) as DiffRequest;
    return HttpResponse.json({
      comparison_queries: body.comparison_queries.map(query => ({
        compatibility: 'compatible',
        query: {
          id: query.query_id,
          engine_id: query.engine_id,
          instance_name: null,
          query_group_id: null,
          query_group_name: null,
        },
        operator_diffs: null,
        stat_diffs: null,
        warnings: null,
      })),
    } satisfies DiffResponse);
  }),

  http.post('*/api/timeline/diff', async ({ request }) => {
    const body = (await request.json()) as DiffTimelineRequest;
    const timelines = await Promise.all(
      body.timelines.map(({ engine_id: engineId, timeline }) =>
        fetchSingleTimelineForDiff(request, engineId, timeline)
      )
    );
    return HttpResponse.json(
      makeTimelineDiffResponse(body, timelines as DiffTimelineResponse['timelines'])
    );
  }),
];

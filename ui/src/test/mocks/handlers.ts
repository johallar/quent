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
  QueryDiff,
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

function makeMockTimelineDiffResponse(request: DiffTimelineRequest): DiffTimelineResponse {
  const [queryARequest, queryBRequest, ...restRequests] = request.timelines;
  const queryA = makeMockTimelineResponse(queryARequest.timeline);
  const queryB = makeMockTimelineResponse(queryBRequest.timeline);
  const timelines: DiffTimelineResponse['timelines'] = [
    queryA,
    queryB,
    ...restRequests.map(request => makeMockTimelineResponse(request.timeline)),
  ];
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

function queryNameFromId(queryId: string): string {
  const parts = queryId.split('-');
  const suffix = parts[parts.length - 1];
  return suffix ? `Query ${suffix.toUpperCase()}` : queryId;
}

interface MockOperatorDiffSpec {
  id: string;
  label: string;
  operatorType: string;
  duration: [number, number];
  inputRows: [number, number];
  outputRows: [number, number];
}

const MOCK_OPERATOR_DIFF_SPECS: MockOperatorDiffSpec[] = [
  {
    id: 'scan-orders',
    label: 'Scan orders',
    operatorType: 'Scan',
    duration: [12, 10],
    inputRows: [0, 0],
    outputRows: [1_000_000, 1_200_000],
  },
  {
    id: 'filter-active',
    label: 'Filter active rows',
    operatorType: 'Filter',
    duration: [4, 5],
    inputRows: [1_000_000, 1_200_000],
    outputRows: [750_000, 820_000],
  },
  {
    id: 'project-columns',
    label: 'Project selected columns',
    operatorType: 'Project',
    duration: [2, 2.5],
    inputRows: [750_000, 820_000],
    outputRows: [750_000, 820_000],
  },
  {
    id: 'join-lineitem',
    label: 'Join lineitem',
    operatorType: 'Join',
    duration: [24, 30],
    inputRows: [750_000, 820_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'sort-revenue',
    label: 'Sort by revenue',
    operatorType: 'Sort',
    duration: [6, 8],
    inputRows: [400_000, 380_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'window-rank',
    label: 'Window rank',
    operatorType: 'Window',
    duration: [8, 7],
    inputRows: [400_000, 380_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'aggregate-status',
    label: 'Aggregate by status',
    operatorType: 'Aggregate',
    duration: [4, 4],
    inputRows: [400_000, 380_000],
    outputRows: [20, 18],
  },
];

function buildMockDelta([baseline, comparison]: [number, number]) {
  const delta = baseline - comparison;
  return {
    stats: [baseline, comparison] as [number, number],
    delta,
    percent_delta: comparison === 0 ? null : delta / comparison,
  };
}

function adjustComparisonValue(value: number, competitorIndex: number, statIndex: number): number {
  if (value === 0) return 0;
  const direction = statIndex % 2 === 0 ? 1 : -1;
  return Number((value + direction * competitorIndex * Math.max(1, value * 0.08)).toFixed(3));
}

function buildMockOperatorDiffs(
  baselineQueryId: string,
  comparisonQueryId: string,
  competitorIndex: number
): QueryDiff['operator_diffs'] {
  return MOCK_OPERATOR_DIFF_SPECS.map((spec, statIndex) => {
    const duration = [
      spec.duration[0],
      adjustComparisonValue(spec.duration[1], competitorIndex, statIndex),
    ] as [number, number];
    const inputRows = [
      spec.inputRows[0],
      adjustComparisonValue(spec.inputRows[1], competitorIndex, statIndex),
    ] as [number, number];
    const outputRows = [
      spec.outputRows[0],
      adjustComparisonValue(spec.outputRows[1], competitorIndex, statIndex),
    ] as [number, number];

    return {
      operators: [
        {
          id: `${spec.id}-${baselineQueryId}`,
          label: spec.label,
          operator_type_name: spec.operatorType,
          plan_id: `plan-${baselineQueryId}`,
        },
        {
          id: `${spec.id}-${comparisonQueryId}`,
          label: spec.label,
          operator_type_name: spec.operatorType,
          plan_id: `plan-${comparisonQueryId}`,
        },
      ],
      stats: {
        duration_s: buildMockDelta(duration),
        input_rows: buildMockDelta(inputRows),
        output_rows: buildMockDelta(outputRows),
      },
    };
  });
}

function makeMockQueryProfileDiffResponse(request: DiffRequest): DiffResponse {
  return {
    comparisonQueries: request.comparisonQueries.map((query, index): QueryDiff => {
      const durationA = 40;
      const durationB = 44 + index * 3;
      return {
        compatibility: 'compatible',
        query: {
          id: query.query_id,
          engine_id: query.engine_id,
          engine_name: query.engine_id,
          instance_name: queryNameFromId(query.query_id),
          query_group_id: null,
          query_group_name: null,
        },
        stat_diffs: {
          duration: {
            stats: [durationA, durationB],
            delta: durationA - durationB,
            percent_delta: durationB === 0 ? null : (durationA - durationB) / durationB,
          },
        },
        operator_diffs: buildMockOperatorDiffs(
          request.baselineQuery.query_id,
          query.query_id,
          index
        ),
      };
    }),
  };
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

  http.post('*/api/query-profile-diff', async ({ request }) => {
    const body = (await request.json()) as DiffRequest;
    return HttpResponse.json(makeMockQueryProfileDiffResponse(body));
  }),

  http.post('*/api/timeline/diff', async ({ request }) => {
    const body = (await request.json()) as DiffTimelineRequest;
    return HttpResponse.json(makeMockTimelineDiffResponse(body));
  }),
];

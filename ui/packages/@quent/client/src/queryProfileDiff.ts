// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchQueryProfileDiff, fetchQueryProfileDiffTimeline } from './api';
import { DEFAULT_STALE_TIME } from './constants';
import type {
  QueryProfileDiffRequest,
  QueryProfileDiffResponse,
  QueryProfileDiffTimelineRequest,
  QueryProfileDiffTimelineResponse,
} from './queryProfileDiffTypes';

interface QueryProfileDiffParams {
  request: QueryProfileDiffRequest;
}

interface QueryProfileDiffTimelineParams {
  request: QueryProfileDiffTimelineRequest;
}

export const queryProfileDiffQueryOptions = (
  { request }: QueryProfileDiffParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: [
      'queryProfileDiff',
      request.query_a.engine_id,
      request.query_a.query_id,
      request.query_b.engine_id,
      request.query_b.query_id,
    ],
    queryFn: (): Promise<QueryProfileDiffResponse> => fetchQueryProfileDiff(request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: Boolean(
      request.query_a.engine_id &&
      request.query_a.query_id &&
      request.query_b.engine_id &&
      request.query_b.query_id
    ),
  });

export const useQueryProfileDiff = (
  params: QueryProfileDiffParams,
  options?: { staleTime?: number }
) => useQuery(queryProfileDiffQueryOptions(params, options));

export const queryProfileDiffTimelineQueryOptions = (
  { request }: QueryProfileDiffTimelineParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['queryProfileDiffTimeline', request],
    queryFn: (): Promise<QueryProfileDiffTimelineResponse> =>
      fetchQueryProfileDiffTimeline(request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: request.timelines.length >= 2,
  });

export const useQueryProfileDiffTimeline = (
  params: QueryProfileDiffTimelineParams,
  options?: { staleTime?: number }
) => useQuery(queryProfileDiffTimelineQueryOptions(params, options));

export type {
  QueryProfileDiffOperatorDelta,
  QueryProfileDiffOperatorRef,
  QueryProfileDiffPlanComparison,
  QueryProfileDiffQueryRef,
  QueryProfileDiffQuerySummary,
  QueryProfileDiffRequest,
  QueryProfileDiffResponse,
  QueryProfileDiffScenario,
  QueryProfileDiffStatDelta,
  QueryProfileDiffTimelineEntry,
  QueryProfileDiffTimelineEntries,
  QueryProfileDiffTimelineRequest,
  QueryProfileDiffTimelineResponse,
} from './queryProfileDiffTypes';

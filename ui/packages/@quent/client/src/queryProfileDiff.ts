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
  engineId: string;
  request: QueryProfileDiffRequest;
}

interface QueryProfileDiffTimelineParams {
  engineId: string;
  request: QueryProfileDiffTimelineRequest;
}

export const queryProfileDiffQueryOptions = (
  { engineId, request }: QueryProfileDiffParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['queryProfileDiff', engineId, request.query_a_id, request.query_b_id],
    queryFn: (): Promise<QueryProfileDiffResponse> => fetchQueryProfileDiff(engineId, request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: Boolean(engineId && request.query_a_id && request.query_b_id),
  });

export const useQueryProfileDiff = (
  params: QueryProfileDiffParams,
  options?: { staleTime?: number }
) => useQuery(queryProfileDiffQueryOptions(params, options));

export const queryProfileDiffTimelineQueryOptions = (
  { engineId, request }: QueryProfileDiffTimelineParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['queryProfileDiffTimeline', engineId, request],
    queryFn: (): Promise<QueryProfileDiffTimelineResponse> =>
      fetchQueryProfileDiffTimeline(engineId, request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: Boolean(engineId),
  });

export const useQueryProfileDiffTimeline = (
  params: QueryProfileDiffTimelineParams,
  options?: { staleTime?: number }
) => useQuery(queryProfileDiffTimelineQueryOptions(params, options));

export type {
  QueryProfileDiffOperatorDelta,
  QueryProfileDiffOperatorRef,
  QueryProfileDiffPlanComparison,
  QueryProfileDiffQuerySummary,
  QueryProfileDiffRequest,
  QueryProfileDiffResponse,
  QueryProfileDiffScenario,
  QueryProfileDiffStatDelta,
  QueryProfileDiffTimelineEntries,
  QueryProfileDiffTimelineRequest,
  QueryProfileDiffTimelineResponse,
} from './queryProfileDiffTypes';

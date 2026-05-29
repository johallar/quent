// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchQueryProfileDiff, fetchQueryProfileDiffTimeline } from './api';
import { DEFAULT_STALE_TIME } from './constants';
import type {
  DiffRequest,
  DiffResponse,
  DiffTimelineRequest,
  DiffTimelineResponse,
} from './queryProfileDiffTypes';

interface DiffParams {
  request: DiffRequest;
}

interface DiffTimelineParams {
  request: DiffTimelineRequest;
}

export const queryProfileDiffQueryOptions = (
  { request }: DiffParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['queryProfileDiff', request],
    queryFn: (): Promise<DiffResponse> => fetchQueryProfileDiff(request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: Boolean(
      request.baseline_query.engine_id &&
      request.baseline_query.query_id &&
      request.comparison_queries.length > 0 &&
      request.comparison_queries.every(query => query.engine_id && query.query_id)
    ),
  });

export const useQueryProfileDiff = (params: DiffParams, options?: { staleTime?: number }) =>
  useQuery(queryProfileDiffQueryOptions(params, options));

export const queryProfileDiffTimelineQueryOptions = (
  { request }: DiffTimelineParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['queryProfileDiffTimeline', request],
    queryFn: (): Promise<DiffTimelineResponse> => fetchQueryProfileDiffTimeline(request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: request.timelines.length >= 2,
  });

export const useQueryProfileDiffTimeline = (
  params: DiffTimelineParams,
  options?: { staleTime?: number }
) => useQuery(queryProfileDiffTimelineQueryOptions(params, options));

export type {
  Compatibility,
  DiffDelta,
  DiffOperatorDelta,
  DiffOperatorRef,
  QueryDiff,
  DiffQueryRef,
  DiffQuerySummary,
  DiffRequest,
  DiffResponse,
  DiffTimelineEntry,
  DiffTimelineEntries,
  DiffTimelineRequest,
  DiffTimelineResponse,
} from './queryProfileDiffTypes';

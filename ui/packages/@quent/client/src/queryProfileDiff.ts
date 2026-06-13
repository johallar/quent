// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchQueryProfileDiff } from './api';
import { DEFAULT_STALE_TIME } from './constants';
import type { DiffRequest, DiffResponse } from './queryProfileDiffTypes';

interface DiffParams {
  request: DiffRequest;
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

export type {
  Compatibility,
  DiffDelta,
  DiffOperatorDelta,
  DiffOperatorRef,
  DiffQueryRef,
  DiffQuerySummary,
  DiffRequest,
  DiffResponse,
  QueryDiff,
  QueryStatDiffs,
} from './queryProfileDiffTypes';

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query';
import { fetchQueryProfileDiff } from './api';
import { DEFAULT_STALE_TIME } from './constants';
import type { QueryProfileDiffRequest, QueryProfileDiffResponse } from './queryProfileDiffTypes';

interface QueryProfileDiffParams {
  engineId: string;
  request: QueryProfileDiffRequest;
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

export type {
  QueryProfileDiffOperatorDelta,
  QueryProfileDiffOperatorRef,
  QueryProfileDiffPlanComparison,
  QueryProfileDiffQuerySummary,
  QueryProfileDiffRequest,
  QueryProfileDiffResponse,
  QueryProfileDiffScenario,
  QueryProfileDiffStatDelta,
} from './queryProfileDiffTypes';

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { QueryFilter } from '@quent/protocol';
import type { OperatorFilter } from '@quent/protocol';
import { queryOptions } from '@tanstack/react-query';
import type { BulkTimelineRequest } from '@quent/protocol';
import { fetchBulkTimelines } from './api';
import { DEFAULT_STALE_TIME } from './constants';

interface BulkTimelineParams {
  engineId: string;
  request: BulkTimelineRequest<QueryFilter, OperatorFilter>;
}

export const bulkTimelineQueryOptions = (
  { engineId, request }: BulkTimelineParams,
  options?: { staleTime?: number }
) =>
  queryOptions({
    queryKey: ['bulkTimelines', engineId, request],
    queryFn: () => fetchBulkTimelines(engineId, request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
  });

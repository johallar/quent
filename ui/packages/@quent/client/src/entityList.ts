// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query';
import type { EntityListRequest, EntityScope, EntitySortKey, SortDir } from '@quent/utils';
import { fetchEntityList } from './api';
import { DEFAULT_STALE_TIME } from './constants';

interface EntityListParams {
  engineId: string;
  queryId: string;
  /** Window bounds in seconds relative to the query epoch. */
  window: { start: number; end: number };
  /** Restrict to a single operator; `null` returns entities across all. */
  operatorId?: string | null;
  /** Restrict entities to a resource / resource-group scope; `null` for all. */
  filter?: { scope?: EntityScope | null; entityTypeName?: string | null };
  /** Keep only entities whose longest usage span exceeds this (seconds). */
  minUsageSeconds?: number | null;
  sortKey?: EntitySortKey;
  sortDir?: SortDir;
  /** Max entities to return; omit for the full (unpaged) list. */
  maxItems?: number | null;
}

function buildRequest({
  queryId,
  window,
  operatorId = null,
  filter,
  minUsageSeconds = null,
  sortKey = 'UsageDuration',
  sortDir = 'Desc',
  maxItems = null,
}: EntityListParams): EntityListRequest<{ query_id: string }, { operator_id: string | null }> {
  return {
    entry: {
      window,
      filter: {
        scope: filter?.scope ?? null,
        entity_type_name: filter?.entityTypeName ?? null,
        min_usage_s: minUsageSeconds,
      },
      sort: { key: sortKey, dir: sortDir },
      page: maxItems != null ? { page: 0, max: maxItems } : null,
      application: { operator_id: operatorId },
    },
    app_params: { query_id: queryId },
  };
}

export const entityListQueryOptions = (
  params: EntityListParams,
  options?: { staleTime?: number; enabled?: boolean }
) => {
  const request = buildRequest(params);
  return queryOptions({
    queryKey: ['entityList', params.engineId, request],
    queryFn: () => fetchEntityList(params.engineId, request),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
    enabled: options?.enabled ?? true,
    // Avoid flicker to empty while a filter/selection change refetches.
    placeholderData: keepPreviousData,
  });
};
export const useEntityList = (
  params: EntityListParams,
  options?: { staleTime?: number; enabled?: boolean }
) => useQuery(entityListQueryOptions(params, options));

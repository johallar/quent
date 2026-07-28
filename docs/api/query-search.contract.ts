// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export type UUID = string;

export type QueryGroupFilter =
  | {
      /** Include grouped and ungrouped queries. */
      query_group_id?: never;
      has_query_group?: never;
    }
  | {
      /** Match one concrete query group. */
      query_group_id: UUID;
      has_query_group?: true;
    }
  | {
      /** Match all grouped or all ungrouped queries. */
      query_group_id?: never;
      has_query_group: boolean;
    };

export type SearchQueriesParams = {
  /** Case-insensitive substring over query, engine, and present group IDs/names. */
  q?: string;
  /** Exact engine filter. */
  engine_id?: UUID;
  /** Zero-based page; defaults to 0. */
  page?: number;
  /** Items per page; defaults to 25 and must be between 1 and 100. */
  page_size?: number;
} & QueryGroupFilter;

export interface QuerySummary {
  id: UUID;
  instance_name: string | null;
  start_unix_ns: bigint | null;
  planning_s: number | null;
  executing_s: number | null;
  completed_s: number | null;
}

export interface EngineSummary {
  id: UUID;
  instance_name: string | null;
}

export interface QueryGroupSummary {
  id: UUID;
  instance_name: string | null;
}

export interface QuerySearchItem {
  query: QuerySummary;
  engine: EngineSummary;
  /** Null when the query is not associated with a query-group semantic entity. */
  query_group: QueryGroupSummary | null;
}

export interface SearchQueriesResponse {
  items: QuerySearchItem[];
  /** Number of matches before pagination. */
  total: number;
  page: number;
  page_size: number;
}

export type SearchQueriesErrorCode =
  | 'INVALID_PAGE'
  | 'INVALID_PAGE_SIZE'
  | 'INVALID_QUERY_GROUP_FILTER';

export interface SearchQueriesError {
  code: SearchQueriesErrorCode;
  message: string;
}

export interface SearchQueriesEndpoint {
  method: 'GET';
  path: '/api/queries';
  query: SearchQueriesParams;
  response: SearchQueriesResponse;
  errors: {
    400: SearchQueriesError;
  };
}

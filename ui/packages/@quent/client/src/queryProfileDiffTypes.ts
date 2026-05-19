// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  QueryFilter,
  SingleTimelineRequest,
  SingleTimelineResponse,
  StatValue,
  TaskFilter,
  TimelineConfig,
} from '@quent/utils';

export interface QueryProfileDiffRequest {
  query_a_id: string;
  query_b_id: string;
}

export type QueryProfileDiffScenario = 'plans_equal' | 'plans_different' | 'plans_incomparable';

export interface QueryProfileDiffQuerySummary {
  id: string;
  instance_name: string | null;
  query_group_id?: string | null;
  query_group_name?: string | null;
}

export interface QueryProfileDiffOperatorRef {
  id: string;
  label: string;
  operator_type_name: string | null;
  plan_id: string | null;
}

export interface QueryProfileDiffStatDelta {
  a: StatValue;
  b: StatValue;
  delta: number | null;
  percent_delta: number | null;
}

export interface QueryProfileDiffOperatorDelta {
  operator_a: QueryProfileDiffOperatorRef | null;
  operator_b: QueryProfileDiffOperatorRef | null;
  stats: Record<string, QueryProfileDiffStatDelta>;
}

export interface QueryProfileDiffPlanComparison {
  /* Big question here, how do we represent query plan graph diffs */
  match_kind: 'structural' | 'different' | 'incomparable';
  matched_operator_count: number;
  unmatched_operator_a_count: number;
  unmatched_operator_b_count: number;
}

export interface QueryProfileDiffResponse {
  // This almost becomes a query diff bundle
  scenario: QueryProfileDiffScenario;
  query_a: QueryProfileDiffQuerySummary;
  query_b: QueryProfileDiffQuerySummary;
  plan_comparison: QueryProfileDiffPlanComparison;
  operator_diffs: QueryProfileDiffOperatorDelta[];
  warnings?: string[];
}

export type QueryProfileDiffTimelineEntries<T> = [T, T, ...T[]];

export interface QueryProfileDiffTimelineRequest {
  timelines: QueryProfileDiffTimelineEntries<SingleTimelineRequest<QueryFilter, TaskFilter>>;
  delta_config: TimelineConfig;
}

export interface QueryProfileDiffTimelineResponse {
  timelines: QueryProfileDiffTimelineEntries<SingleTimelineResponse>;
  delta: SingleTimelineResponse;
  warnings?: string[];
}

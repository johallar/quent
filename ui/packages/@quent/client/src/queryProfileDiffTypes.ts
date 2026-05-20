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

export interface QueryProfileDiffQueryRef {
  // @chris tell me if engine is needed, is group needed?
  engine_id: string;
  query_id: string;
}

export interface QueryProfileDiffRequest {
  // Alternatively make this one array, assume first item is baseline
  baselineQuery: QueryProfileDiffQueryRef;
  comparisonQueries: Array<QueryProfileDiffQueryRef>;
}

// This is a later thing
// export type QueryProfileDiffScenario = 'plans_equal' | 'plans_different' | 'plans_incomparable';

export type Compatibility = 'compatible' | 'incompatible';

export interface QueryProfileDiffQuerySummary {
  // Be flexible w these properties/names, maybe no names and just ids
  id: string;
  engine_id: string;
  engine_name: string | null;
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

export interface QueryProfileDiffDelta {
  stats: [StatValue, StatValue];
  delta: number | null;
  percent_delta: number | null;
}

export interface QueryProfileDiffOperatorDelta {
  operators: [QueryProfileDiffOperatorRef, QueryProfileDiffOperatorRef];
  /* stat name -> delta values */
  stats: Record<string, QueryProfileDiffDelta>;
}

export interface QueryProfileDiffResponse {
  // Each comparison query compared to the baseline query listed here (same order as comparison_queries in QueryProfileDiffRequest)
  comparisonQueries: Array<QueryProfileQueryDiff>;
}

export interface QueryProfileQueryDiff {
  compatibility: Compatibility;
  query?: QueryProfileDiffQuerySummary;
  operator_diffs?: Array<QueryProfileDiffOperatorDelta>;
  stat_diffs?: {
    // Derived from query timestamps (last-first)
    duration: QueryProfileDiffDelta;
    // Extend later with other capacities aggrgated over the whole query?
    // capacities: Record<CapacityType, QueryProfileDiffDelta>;
  };
  warnings?: string[];
}

// IGNORE ISOMORPHIC GRAPH STUFF
// export interface QueryProfileDiffPlanComparison {
//   /* Big question here, how do we represent query plan graph diffs */
//   matched_operator_count: number;
//   unmatched_operator_a_count: number;
//   unmatched_operator_b_count: number;
// }
// plan_comparison: QueryProfileDiffPlanComparison;

/****
 * Later
 */
export type QueryProfileDiffTimelineEntries<T> = [T, T, ...T[]];

export interface QueryProfileDiffTimelineEntry<T> {
  engine_id: string;
  timeline: T;
}

export interface QueryProfileDiffTimelineRequest {
  timelines: QueryProfileDiffTimelineEntries<
    QueryProfileDiffTimelineEntry<SingleTimelineRequest<QueryFilter, TaskFilter>>
  >;
  delta_config: TimelineConfig;
}

export interface QueryProfileDiffTimelineResponse {
  timelines: QueryProfileDiffTimelineEntries<SingleTimelineResponse>;
  delta: SingleTimelineResponse;
  warnings?: string[];
}

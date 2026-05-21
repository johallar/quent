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

export interface DiffQueryRef {
  // @chris tell me if engine is needed, is group needed?
  engine_id: string;
  query_id: string;
}

export interface DiffRequest {
  // Alternatively make this one array, assume first item is baseline
  baselineQuery: DiffQueryRef;
  comparisonQueries: Array<DiffQueryRef>;
}

// This is a later thing
// export type DiffScenario = 'plans_equal' | 'plans_different' | 'plans_incomparable';

export type Compatibility = 'compatible' | 'incompatible';

export interface DiffQuerySummary {
  // Be flexible w these properties/names, maybe no names and just ids
  id: string;
  engine_id: string;
  engine_name: string | null;
  instance_name: string | null;
  query_group_id?: string | null;
  query_group_name?: string | null;
}

export interface DiffOperatorRef {
  id: string;
  label: string;
  operator_type_name: string | null;
  plan_id: string | null;
}

export interface DiffDelta {
  stats: [StatValue, StatValue];
  delta: number | null;
  percent_delta: number | null;
}

export interface DiffOperatorDelta {
  /* Should we be using Operator type here? */
  operators: [DiffOperatorRef, DiffOperatorRef];
  /* stat name -> delta values */
  stats: Record<string, DiffDelta>;
}

export interface DiffResponse {
  // Each comparison query compared to the baseline query listed here (same order as comparison_queries in DiffRequest)
  comparisonQueries: Array<QueryDiff>;
}

export interface QueryDiff {
  compatibility: Compatibility;
  query?: DiffQuerySummary;
  operator_diffs?: Array<DiffOperatorDelta>;
  stat_diffs?: {
    // Derived from query timestamps (last-first)
    duration: DiffDelta;
    // Extend later with other capacities aggrgated over the whole query?
    // capacities: Record<CapacityType, DiffDelta>;
  };
  warnings?: string[];
}

// IGNORE ISOMORPHIC GRAPH STUFF
// export interface DiffPlanComparison {
//   /* Big question here, how do we represent query plan graph diffs */
//   matched_operator_count: number;
//   unmatched_operator_a_count: number;
//   unmatched_operator_b_count: number;
// }
// plan_comparison: DiffPlanComparison;

/****
 * Later
 */
export type DiffTimelineEntries<T> = [T, T, ...T[]];

export interface DiffTimelineEntry<T> {
  engine_id: string;
  timeline: T;
}

export interface DiffTimelineRequest {
  timelines: DiffTimelineEntries<DiffTimelineEntry<SingleTimelineRequest<QueryFilter, TaskFilter>>>;
  delta_config: TimelineConfig;
}

export interface DiffTimelineResponse {
  timelines: DiffTimelineEntries<SingleTimelineResponse>;
  delta: SingleTimelineResponse;
  warnings?: string[];
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  QueryFilter,
  SingleTimelineRequest,
  SingleTimelineResponse,
  TaskFilter,
  TimelineConfig,
} from '@quent/utils';

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
} from '@quent/utils';

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

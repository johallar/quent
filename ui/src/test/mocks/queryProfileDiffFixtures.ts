// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DiffQuerySummary, QueryDiff } from '@quent/client';

export const baselineDiffQueryFixture: DiffQuerySummary = {
  id: 'query-a',
  engine_id: 'engine-a',
  engine_name: 'Engine A',
  instance_name: 'Query A',
  query_group_id: 'group-1',
  query_group_name: 'Group 1',
};

export const comparisonDiffQueryFixture: DiffQuerySummary = {
  id: 'query-b',
  engine_id: 'engine-b',
  engine_name: 'Engine B',
  instance_name: 'Query B',
  query_group_id: 'group-2',
  query_group_name: 'Group 2',
};

export const equalPlanQueryDiffFixture: QueryDiff = {
  compatibility: 'compatible',
  query: comparisonDiffQueryFixture,
  stat_diffs: {
    duration: { stats: [40, 44], delta: -4, percent_delta: -0.0909090909 },
  },
  operator_diffs: [
    {
      operators: [
        {
          id: 'scan-a',
          label: 'Scan orders',
          operator_type_name: 'Scan',
          plan_id: 'plan-a',
        },
        {
          id: 'scan-b',
          label: 'Scan orders',
          operator_type_name: 'Scan',
          plan_id: 'plan-b',
        },
      ],
      stats: {
        duration_s: { stats: [12, 10], delta: 2, percent_delta: 0.2 },
        input_rows: { stats: [1000, 1200], delta: -200, percent_delta: -0.1666666667 },
        output_rows: { stats: [900, 950], delta: -50, percent_delta: -0.0526315789 },
      },
    },
    {
      operators: [
        {
          id: 'join-a',
          label: 'Join lineitem',
          operator_type_name: 'Join',
          plan_id: 'plan-a',
        },
        {
          id: 'join-b',
          label: 'Join lineitem',
          operator_type_name: 'Join',
          plan_id: 'plan-b',
        },
      ],
      stats: {
        duration_s: { stats: [24, 30], delta: -6, percent_delta: -0.2 },
        input_rows: { stats: [900, 950], delta: -50, percent_delta: -0.0526315789 },
        output_rows: { stats: [400, 380], delta: 20, percent_delta: 0.0526315789 },
      },
    },
    {
      operators: [
        {
          id: 'agg-a',
          label: 'Aggregate',
          operator_type_name: 'Aggregate',
          plan_id: 'plan-a',
        },
        {
          id: 'agg-b',
          label: 'Aggregate',
          operator_type_name: 'Aggregate',
          plan_id: 'plan-b',
        },
      ],
      stats: {
        duration_s: { stats: [4, 4], delta: 0, percent_delta: 0 },
        input_rows: { stats: [400, 380], delta: 20, percent_delta: 0.0526315789 },
        output_rows: { stats: [20, 20], delta: 0, percent_delta: 0 },
      },
    },
  ],
};

export const differentPlanQueryDiffFixture: QueryDiff = {
  ...equalPlanQueryDiffFixture,
  compatibility: 'incompatible',
  operator_diffs: [],
  warnings: ['Plans are structurally different; operator-to-operator diff is unavailable.'],
};

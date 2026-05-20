// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { QueryProfileDiffResponse } from '@quent/client';

export const equalPlanQueryProfileDiffFixture: QueryProfileDiffResponse = {
  scenario: 'plans_equal',
  query_a: {
    id: 'query-a',
    instance_name: 'Query A',
    query_group_id: 'group-1',
    query_group_name: 'Group 1',
  },
  query_b: {
    id: 'query-b',
    instance_name: 'Query B',
    query_group_id: 'group-2',
    query_group_name: 'Group 2',
  },
  plan_comparison: {
    matched_operator_count: 3,
    unmatched_operator_a_count: 0,
    unmatched_operator_b_count: 0,
  },
  operator_diffs: [
    {
      operator_a: {
        id: 'scan-a',
        label: 'Scan orders',
        operator_type_name: 'Scan',
        plan_id: 'plan-a',
      },
      operator_b: {
        id: 'scan-b',
        label: 'Scan orders',
        operator_type_name: 'Scan',
        plan_id: 'plan-b',
      },
      stats: {
        duration_s: { a: 12, b: 10, delta: 2, percent_delta: 0.2 },
        input_rows: { a: 1000, b: 1200, delta: -200, percent_delta: -0.1666666667 },
        output_rows: { a: 900, b: 950, delta: -50, percent_delta: -0.0526315789 },
      },
    },
    {
      operator_a: {
        id: 'join-a',
        label: 'Join lineitem',
        operator_type_name: 'Join',
        plan_id: 'plan-a',
      },
      operator_b: {
        id: 'join-b',
        label: 'Join lineitem',
        operator_type_name: 'Join',
        plan_id: 'plan-b',
      },
      stats: {
        duration_s: { a: 24, b: 30, delta: -6, percent_delta: -0.2 },
        input_rows: { a: 900, b: 950, delta: -50, percent_delta: -0.0526315789 },
        output_rows: { a: 400, b: 380, delta: 20, percent_delta: 0.0526315789 },
      },
    },
    {
      operator_a: {
        id: 'agg-a',
        label: 'Aggregate',
        operator_type_name: 'Aggregate',
        plan_id: 'plan-a',
      },
      operator_b: {
        id: 'agg-b',
        label: 'Aggregate',
        operator_type_name: 'Aggregate',
        plan_id: 'plan-b',
      },
      stats: {
        duration_s: { a: 4, b: 4, delta: 0, percent_delta: 0 },
        input_rows: { a: 400, b: 380, delta: 20, percent_delta: 0.0526315789 },
        output_rows: { a: 20, b: 20, delta: 0, percent_delta: 0 },
      },
    },
  ],
};

export const differentPlanQueryProfileDiffFixture: QueryProfileDiffResponse = {
  ...equalPlanQueryProfileDiffFixture,
  scenario: 'plans_different',
  plan_comparison: {
    matched_operator_count: 0,
    unmatched_operator_a_count: 3,
    unmatched_operator_b_count: 4,
  },
  operator_diffs: [],
  warnings: ['Plans are structurally different; operator-to-operator diff is unavailable.'],
};

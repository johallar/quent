// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { parseCustomStatistics } from '@quent/components';
import type {
  QueryProfileDiffOperatorDelta,
  QueryProfileDiffOperatorRef,
  QueryProfileDiffQuerySummary,
  QueryProfileDiffResponse,
  QueryProfileDiffStatDelta,
} from '@quent/client';
import type { EntityRef, Operator, PlanTree, QueryBundle, StatValue } from '@quent/utils';

interface PlanSignature {
  operators: string[];
  children: PlanSignature[];
}

function getOperatorsForPlan(bundle: QueryBundle<EntityRef>, planId: string): Operator[] {
  return Object.values(bundle.entities.operators)
    .filter((operator): operator is Operator => operator != null && operator.plan_id === planId)
    .sort((a, b) => {
      const typeCompare = (a.operator_type_name ?? '').localeCompare(b.operator_type_name ?? '');
      if (typeCompare !== 0) return typeCompare;
      const nameCompare = (a.instance_name ?? '').localeCompare(b.instance_name ?? '');
      if (nameCompare !== 0) return nameCompare;
      return a.id.localeCompare(b.id);
    });
}

function getOperatorSignature(operator: Operator): string {
  return `${operator.operator_type_name ?? ''}:${operator.instance_name ?? ''}`;
}

function getPlanSignature(bundle: QueryBundle<EntityRef>, node: PlanTree): PlanSignature {
  return {
    operators: getOperatorsForPlan(bundle, node.id).map(getOperatorSignature),
    children: node.children.map(child => getPlanSignature(bundle, child)),
  };
}

function signaturesEqual(a: PlanSignature, b: PlanSignature): boolean {
  if (a.operators.length !== b.operators.length || a.children.length !== b.children.length) {
    return false;
  }
  if (a.operators.some((signature, index) => signature !== b.operators[index])) {
    return false;
  }
  return a.children.every((child, index) => signaturesEqual(child, b.children[index]!));
}

function flattenOperatorsByPlanTree(bundle: QueryBundle<EntityRef>, node: PlanTree): Operator[] {
  return [
    ...getOperatorsForPlan(bundle, node.id),
    ...node.children.flatMap(child => flattenOperatorsByPlanTree(bundle, child)),
  ];
}

function countOperators(bundle: QueryBundle<EntityRef>): number {
  return Object.values(bundle.entities.operators).filter(Boolean).length;
}

function getQuerySummary(bundle: QueryBundle<EntityRef>): QueryProfileDiffQuerySummary {
  return {
    id: bundle.entities.query.id,
    engine_id: bundle.entities.engine.id,
    engine_name: bundle.entities.engine.instance_name ?? null,
    instance_name: bundle.entities.query.instance_name ?? null,
    query_group_id: bundle.entities.query_group.id,
    query_group_name: bundle.entities.query_group.instance_name ?? null,
  };
}

function getOperatorRef(operator: Operator): QueryProfileDiffOperatorRef {
  return {
    id: operator.id,
    label: operator.instance_name ?? operator.id,
    operator_type_name: operator.operator_type_name ?? null,
    plan_id: operator.plan_id ?? null,
  };
}

function getOperatorStats(operator: Operator): Record<string, StatValue> {
  const stats: Record<string, StatValue> = {
    duration_s: operator.active_span
      ? Number((operator.active_span.end - operator.active_span.start).toFixed(6))
      : null,
  };

  for (const stat of parseCustomStatistics(operator)) {
    stats[stat.key] = stat.value;
  }

  return stats;
}

function buildStatDelta(a: StatValue, b: StatValue): QueryProfileDiffStatDelta {
  const delta = typeof a === 'number' && typeof b === 'number' ? a - b : null;
  return {
    a,
    b,
    delta,
    percent_delta: delta != null && typeof b === 'number' && b !== 0 ? delta / b : null,
  };
}

function buildOperatorDelta(
  operatorA: Operator,
  operatorB: Operator
): QueryProfileDiffOperatorDelta {
  const statsA = getOperatorStats(operatorA);
  const statsB = getOperatorStats(operatorB);
  const statNames = [...new Set([...Object.keys(statsA), ...Object.keys(statsB)])].sort();

  return {
    operator_a: getOperatorRef(operatorA),
    operator_b: getOperatorRef(operatorB),
    stats: Object.fromEntries(
      statNames.map(statName => [
        statName,
        buildStatDelta(statsA[statName] ?? null, statsB[statName] ?? null),
      ])
    ),
  };
}

export function buildQueryProfileDiffFromBundles(
  queryA: QueryBundle<EntityRef>,
  queryB: QueryBundle<EntityRef>
): QueryProfileDiffResponse {
  const query_a = getQuerySummary(queryA);
  const query_b = getQuerySummary(queryB);

  const signatureA = getPlanSignature(queryA, queryA.plan_tree);
  const signatureB = getPlanSignature(queryB, queryB.plan_tree);

  if (!signaturesEqual(signatureA, signatureB)) {
    return {
      scenario: 'plans_different',
      query_a,
      query_b,
      plan_comparison: {
        matched_operator_count: 0,
        unmatched_operator_a_count: countOperators(queryA),
        unmatched_operator_b_count: countOperators(queryB),
      },
      operator_diffs: [],
      warnings: ['Plans are structurally different; operator-to-operator diff is unavailable.'],
    };
  }

  const operatorsA = flattenOperatorsByPlanTree(queryA, queryA.plan_tree);
  const operatorsB = flattenOperatorsByPlanTree(queryB, queryB.plan_tree);
  const matchedCount = Math.min(operatorsA.length, operatorsB.length);

  return {
    scenario: 'plans_equal',
    query_a,
    query_b,
    plan_comparison: {
      matched_operator_count: matchedCount,
      unmatched_operator_a_count: operatorsA.length - matchedCount,
      unmatched_operator_b_count: operatorsB.length - matchedCount,
    },
    operator_diffs: operatorsA
      .slice(0, matchedCount)
      .map((operatorA, index) => buildOperatorDelta(operatorA, operatorsB[index]!)),
  };
}

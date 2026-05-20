// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EntityRef, Operator, PlanTree, QueryBundle, StatValue } from '@quent/utils';
import type {
  DiffDelta,
  DiffOperatorDelta,
  DiffOperatorRef,
  DiffQuerySummary,
  DiffResponse,
  QueryDiff,
} from './queryProfileDiffTypes';

interface PlanSignature {
  operators: string[];
  children: PlanSignature[];
}

function unwrapToString(val: unknown): string {
  const result = unwrapTaggedValue(val);
  return Array.isArray(result) ? result.join('\n') : String(result ?? '');
}

function unwrapTaggedValue(val: unknown): StatValue {
  switch (true) {
    case val === null || val === undefined:
      return null;
    case typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean':
      return val as StatValue;
    case Array.isArray(val):
      return (val as unknown[]).map(unwrapToString);
    case typeof val === 'object': {
      const obj = val as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 2 && 'key' in obj && 'value' in obj) {
        return `${obj.key}: ${unwrapToString(obj.value)}`;
      }
      if (keys.length === 1) {
        return unwrapTaggedValue(Object.values(obj)[0]);
      }
      return JSON.stringify(val);
    }
    default:
      return String(val);
  }
}

function parseCustomStatistics(rawNode: unknown): Array<{ key: string; value: StatValue }> {
  const statistics = (rawNode as Operator)?.statistics?.custom_statistics;
  if (!statistics) return [];

  return Object.entries(statistics).map(([key, tagged]) => ({
    key,
    value: tagged
      ? unwrapTaggedValue(Object.values(tagged as unknown as Record<string, unknown>)[0])
      : null,
  }));
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

function getQuerySummary(bundle: QueryBundle<EntityRef>): DiffQuerySummary {
  return {
    id: bundle.entities.query.id,
    engine_id: bundle.entities.engine.id,
    engine_name: bundle.entities.engine.instance_name ?? null,
    instance_name: bundle.entities.query.instance_name ?? null,
    query_group_id: bundle.entities.query_group.id,
    query_group_name: bundle.entities.query_group.instance_name ?? null,
  };
}

function getOperatorRef(operator: Operator): DiffOperatorRef {
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

function buildStatDelta(a: StatValue, b: StatValue): DiffDelta {
  const delta = typeof a === 'number' && typeof b === 'number' ? a - b : null;
  return {
    stats: [a, b],
    delta,
    percent_delta: delta != null && typeof b === 'number' && b !== 0 ? delta / b : null,
  };
}

function buildOperatorDelta(operatorA: Operator, operatorB: Operator): DiffOperatorDelta {
  const statsA = getOperatorStats(operatorA);
  const statsB = getOperatorStats(operatorB);
  const statNames = [...new Set([...Object.keys(statsA), ...Object.keys(statsB)])].sort();

  return {
    operators: [getOperatorRef(operatorA), getOperatorRef(operatorB)],
    stats: Object.fromEntries(
      statNames.map(statName => [
        statName,
        buildStatDelta(statsA[statName] ?? null, statsB[statName] ?? null),
      ])
    ),
  };
}

export function buildQueryProfileDiffFromBundles(
  baselineQuery: QueryBundle<EntityRef>,
  comparisonQuery: QueryBundle<EntityRef>
): QueryDiff {
  const query = getQuerySummary(comparisonQuery);
  const stat_diffs = {
    duration: buildStatDelta(baselineQuery.duration_s, comparisonQuery.duration_s),
  };

  const signatureA = getPlanSignature(baselineQuery, baselineQuery.plan_tree);
  const signatureB = getPlanSignature(comparisonQuery, comparisonQuery.plan_tree);

  if (!signaturesEqual(signatureA, signatureB)) {
    return {
      compatibility: 'incompatible',
      query,
      stat_diffs,
      operator_diffs: [],
      warnings: ['Plans are structurally different; operator-to-operator diff is unavailable.'],
    };
  }

  const operatorsA = flattenOperatorsByPlanTree(baselineQuery, baselineQuery.plan_tree);
  const operatorsB = flattenOperatorsByPlanTree(comparisonQuery, comparisonQuery.plan_tree);
  const matchedCount = Math.min(operatorsA.length, operatorsB.length);

  return {
    compatibility: 'compatible',
    query,
    stat_diffs,
    operator_diffs: operatorsA
      .slice(0, matchedCount)
      .map((operatorA, index) => buildOperatorDelta(operatorA, operatorsB[index]!)),
  };
}

export function buildQueryProfileDiffResponseFromBundles(
  baselineQuery: QueryBundle<EntityRef>,
  comparisonQueries: QueryBundle<EntityRef>[]
): DiffResponse {
  return {
    comparisonQueries: comparisonQueries.map(comparisonQuery =>
      buildQueryProfileDiffFromBundles(baselineQuery, comparisonQuery)
    ),
  };
}

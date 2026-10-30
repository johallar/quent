// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  EntityListRequest,
  EntityRef,
  OperatorFilter,
  QueryBundle,
  QueryFilter,
  Resource,
} from '@quent/utils';

export interface LongestResourceUsersInput {
  resourceId: string;
  entityType?: string;
  operatorIds: readonly string[];
  start?: number;
  end?: number;
  limit: number;
}

export interface LongestResourceUsersPreparation {
  window: { start: number; end: number };
  resource: {
    id: string;
    instanceName: string;
    typeName: string;
    parentGroupId: string;
    declaredCapacities: string[];
  };
  entityType: string | null;
  operators: Array<{
    id: string;
    instanceName: string | null;
    typeName: string | null;
    planId: string | null;
  }>;
  request: EntityListRequest<QueryFilter, OperatorFilter>;
}

function resolveWindow(
  durationSeconds: number,
  input: Pick<LongestResourceUsersInput, 'start' | 'end'>
): { start: number; end: number } {
  const start = input.start ?? 0;
  const end = input.end ?? durationSeconds;
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('The query bundle has no positive finite duration.');
  }
  if (start < 0 || end > durationSeconds || end <= start) {
    throw new Error(`The window must satisfy 0 <= start < end <= ${durationSeconds}.`);
  }
  return { start, end };
}

function resolveEntityType(
  bundle: QueryBundle<EntityRef>,
  resource: Resource,
  requested: string | undefined
): string | null {
  const declaration = bundle.entities.resource_types[resource.type_name];
  if (!declaration) {
    throw new Error(`Resource type "${resource.type_name}" is not declared in the query bundle.`);
  }
  const entityTypes = [
    ...new Set(
      declaration.display_order.flatMap(selection => (selection === 'All' ? [] : [selection.Type]))
    ),
  ];
  if (requested) {
    if (!bundle.entities.fsm_types[requested]) {
      throw new Error(`FSM entity type "${requested}" is not declared in the query bundle.`);
    }
    if (!entityTypes.includes(requested)) {
      throw new Error(
        `FSM entity type "${requested}" is not declared as a user of resource type "${resource.type_name}".`
      );
    }
    return requested;
  }
  if (entityTypes.length !== 1) {
    return null;
  }
  const entityType = entityTypes[0]!;
  if (!bundle.entities.fsm_types[entityType]) {
    throw new Error(
      `Resource type "${resource.type_name}" references undeclared FSM type "${entityType}".`
    );
  }
  return entityType;
}

function resolveOperators(bundle: QueryBundle<EntityRef>, operatorIds: readonly string[]) {
  return operatorIds.map(id => {
    const operator = bundle.entities.operators[id];
    if (!operator) {
      throw new Error(`Operator "${id}" is not present in the query bundle.`);
    }
    if (operator.plan_id && !bundle.entities.plans[operator.plan_id]) {
      throw new Error(`Operator "${id}" references missing plan "${operator.plan_id}".`);
    }
    return {
      id,
      instanceName: operator.instance_name,
      typeName: operator.operator_type_name,
      planId: operator.plan_id,
    };
  });
}

export function prepareLongestResourceUsers(
  bundle: QueryBundle<EntityRef>,
  input: LongestResourceUsersInput
): LongestResourceUsersPreparation {
  const resource = bundle.entities.resources[input.resourceId];
  if (!resource) {
    throw new Error(`Resource "${input.resourceId}" is not present in the query bundle.`);
  }
  const resourceType = bundle.entities.resource_types[resource.type_name];
  if (!resourceType) {
    throw new Error(`Resource type "${resource.type_name}" is not declared in the query bundle.`);
  }
  const window = resolveWindow(bundle.duration_s, input);
  const entityType = resolveEntityType(bundle, resource, input.entityType);
  const operators = resolveOperators(bundle, input.operatorIds);

  return {
    window,
    resource: {
      id: resource.id,
      instanceName: resource.instance_name,
      typeName: resource.type_name,
      parentGroupId: resource.parent_group_id,
      declaredCapacities: resourceType.capacities.map(capacity => capacity.name),
    },
    entityType,
    operators,
    request: {
      entry: {
        window,
        filter: {
          scope: { Resource: { resource_id: input.resourceId } },
          entity_type_name: entityType,
          min_usage_s: null,
        },
        sort: { key: 'UsageDuration', dir: 'Desc' },
        page: { page: 0, max: input.limit },
        application: { operator_ids: [...input.operatorIds] },
      },
      app_params: { query_id: bundle.query_id },
    },
  };
}

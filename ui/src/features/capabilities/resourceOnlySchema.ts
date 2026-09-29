// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Annotations, Entity, Path, Schema } from '@quent/schema';

const FSM_CONSTRAINT = 'quent.fsm.v0.1.0';
const REFERENCE_TARGET_CONSTRAINT = 'quent.ref-target.v0.1.0';
const REFERENCE_TREE_CONSTRAINT = 'quent.ref-tree.v0.1.0';
const RESOURCE_CONSTRAINT = 'quent.resource.v0.1.0';

function path(name: string): Path {
  return { namespace: [], name };
}

function annotations(constraints: readonly [string, string | null][] = []): Annotations {
  return {
    docs: null,
    constraints: Object.fromEntries(constraints.map(([name, data]) => [name, { name, data }])),
    metadata: {},
  };
}

function entity(name: string, constraints: readonly [string, string | null][] = []): Entity {
  return {
    path: path(name),
    events: {},
    annotations: annotations(constraints),
  };
}

const hostMemory = entity('HostMemory', [[RESOURCE_CONSTRAINT, '{}']]);
const task = entity('Task', [
  [FSM_CONSTRAINT, '{}'],
  [RESOURCE_CONSTRAINT, '{}'],
]);
task.events.created = {
  name: 'created',
  cardinality: 'Once',
  payload: {
    parent: {
      name: 'parent',
      ty: {
        EntityRef: {
          data: null,
          annotations: annotations([
            [REFERENCE_TARGET_CONSTRAINT, 'HostMemory'],
            [REFERENCE_TREE_CONSTRAINT, null],
          ]),
        },
      },
      annotations: annotations(),
    },
  },
  annotations: annotations(),
};

const plan = entity('Plan');
const operator = entity('Operator');
operator.events.statistics = {
  name: 'statistics',
  cardinality: 'Once',
  payload: {
    custom_attributes: {
      name: 'custom_attributes',
      ty: 'DynamicRecord',
      annotations: annotations(),
    },
  },
  annotations: annotations(),
};
const port = entity('Port');
const queryPlanEntities: Schema['entities'] = [
  [path('Plan'), plan],
  [path('Operator'), operator],
  [path('Port'), port],
];

export const resourceOnlySchema: Schema = {
  name: 'ResourceOnlyExperiment',
  entities: [
    [path('HostMemory'), hostMemory],
    [path('Task'), task],
  ],
  records: [],
  annotations: annotations(),
};

export const resourceWithQueryPlanSchema: Schema = {
  ...resourceOnlySchema,
  name: 'ResourceWithQueryPlanExperiment',
  entities: [...resourceOnlySchema.entities, ...queryPlanEntities],
};

export const queryPlanOnlySchema: Schema = {
  name: 'QueryPlanOnlyExperiment',
  entities: queryPlanEntities,
  records: [],
  annotations: annotations(),
};

export async function fetchResourceOnlySchema(): Promise<Schema> {
  return resourceOnlySchema;
}

export async function fetchResourceWithQueryPlanSchema(): Promise<Schema> {
  return resourceWithQueryPlanSchema;
}

export async function fetchQueryPlanOnlySchema(): Promise<Schema> {
  return queryPlanOnlySchema;
}

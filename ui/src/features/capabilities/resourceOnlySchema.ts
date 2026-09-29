// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  Annotations,
  Cardinality,
  DataType,
  Entity,
  Event,
  Field,
  Path,
  Record as SchemaRecord,
  Schema,
} from '@quent/schema';

const FSM_CONSTRAINT = 'quent.fsm.v0.1.0';
const REFERENCE_TARGET_CONSTRAINT = 'quent.ref-target.v0.1.0';
const REFERENCE_TREE_CONSTRAINT = 'quent.ref-tree.v0.1.0';
const RESOURCE_CONSTRAINT = 'quent.resource.v0.1.0';

function path(name: string): Path {
  return { namespace: [], name };
}

type ConstraintEntry = readonly [name: string, data: string | null];
type CapacityKind = 'occupancy' | 'rate';

function annotations(constraints: readonly ConstraintEntry[] = []): Annotations {
  return {
    docs: null,
    constraints: Object.fromEntries(constraints.map(([name, data]) => [name, { name, data }])),
    metadata: {},
  };
}

function field(name: string, ty: DataType): Field {
  return { name, ty, annotations: annotations() };
}

function event(
  name: string,
  fields: readonly Field[] = [],
  cardinality: Cardinality = 'Once'
): Event {
  return {
    name,
    cardinality,
    payload: Object.fromEntries(fields.map(value => [value.name, value])),
    annotations: annotations(),
  };
}

function entity(
  name: string,
  events: readonly Event[] = [],
  constraints: readonly ConstraintEntry[] = []
): Entity {
  return {
    path: path(name),
    events: Object.fromEntries(events.map(value => [value.name, value])),
    annotations: annotations(constraints),
  };
}

function record(
  name: string,
  fields: readonly Field[],
  constraints: readonly ConstraintEntry[] = []
): SchemaRecord {
  return {
    path: path(name),
    fields: Object.fromEntries(fields.map(value => [value.name, value])),
    annotations: annotations(constraints),
  };
}

function schema(
  name: string,
  entities: readonly Entity[],
  records: readonly SchemaRecord[] = []
): Schema {
  return {
    name,
    entities: entities.map(value => [value.path, value]),
    records: records.map(value => [value.path, value]),
    annotations: annotations(),
  };
}

function recordType(name: string): DataType {
  return { Record: path(name) };
}

function entityReference(target: string, data: DataType | null = null, tree = false): DataType {
  return {
    EntityRef: {
      data,
      annotations: annotations([
        [REFERENCE_TARGET_CONSTRAINT, target],
        ...(tree ? ([[REFERENCE_TREE_CONSTRAINT, null]] as const) : []),
      ]),
    },
  };
}

function fsmData(
  initialState: string,
  transitions: readonly (readonly [source: string, target: string])[]
): string {
  return JSON.stringify({
    initial_state: initialState,
    transitions: transitions.map(([source, target]) => ({ source, target })),
  });
}

function taskFsm(parent: string, usages: readonly Field[] = []): Entity {
  return entity(
    'Task',
    [
      event('queued', [field('parent', entityReference(parent, null, true))]),
      event('running', usages),
      event('completed'),
    ],
    [
      [
        FSM_CONSTRAINT,
        fsmData('queued', [
          ['queued', 'running'],
          ['running', 'completed'],
        ]),
      ],
    ]
  );
}

function resourceDefinitionData(
  capacities: Readonly<Record<string, { kind: CapacityKind; bounded: boolean }>>
): string {
  return JSON.stringify({ definition: capacities });
}

function resourceRecordData(role: 'usage' | 'bounds', resource: string): string {
  return JSON.stringify({ [role]: { resource: path(resource) } });
}

function resourceEntity(
  name: string,
  parent: string,
  capacities: Readonly<Record<string, { kind: CapacityKind; bounded: boolean }>>,
  boundsRecord?: string
): Entity {
  const events = [event('created', [field('parent', entityReference(parent, null, true))])];
  if (boundsRecord) {
    events.push(event('bounds_changed', [field('bounds', recordType(boundsRecord))], 'Multi'));
  }
  return entity(name, events, [[RESOURCE_CONSTRAINT, resourceDefinitionData(capacities)]]);
}

function resourceRecord(
  name: string,
  role: 'usage' | 'bounds',
  resource: string,
  capacities: readonly string[]
): SchemaRecord {
  return record(
    name,
    capacities.map(capacity => field(capacity, 'U64')),
    [[RESOURCE_CONSTRAINT, resourceRecordData(role, resource)]]
  );
}

function usageField(name: string, resource: string, usageRecord: string): Field {
  return field(name, entityReference(resource, recordType(usageRecord)));
}

const plan = entity('Plan');
const operator = entity('Operator', [
  event('statistics', [field('custom_attributes', 'DynamicRecord')]),
]);
const port = entity('Port');
const queryPlanEntities = [plan, operator, port] as const;

function withQueryPlan(base: Schema, name: string): Schema {
  return schema(
    name,
    [...base.entities.map(([, value]) => value), ...queryPlanEntities],
    base.records.map(([, value]) => value)
  );
}

const host = entity('Host', [event('created')]);
const hostMemory = resourceEntity('HostMemory', 'Host', {
  bytes: { kind: 'occupancy', bounded: false },
});
const hostMemoryUsage = resourceRecord('HostMemoryUsage', 'usage', 'HostMemory', ['bytes']);

export const resourceOnlySchema = schema(
  'ResourceOnlyExperiment',
  [host, hostMemory, taskFsm('Host', [usageField('memory', 'HostMemory', 'HostMemoryUsage')])],
  [hostMemoryUsage]
);

export const resourceWithQueryPlanSchema = withQueryPlan(
  resourceOnlySchema,
  'ResourceWithQueryPlanExperiment'
);

export const queryPlanOnlySchema = schema('QueryPlanOnlyExperiment', queryPlanEntities);

const pipeline = entity('Pipeline', [event('created')]);

export const nonFsmEntitiesSchema = schema('NonFsmEntitiesExperiment', [
  pipeline,
  entity('Task', [
    event('started', [field('parent', entityReference('Pipeline', null, true))]),
    event('progress', [field('completed_steps', 'U64')], 'Multi'),
    event('ended'),
  ]),
]);

export const entitiesOnlySchema = schema('EntitiesOnlyExperiment', [pipeline, taskFsm('Pipeline')]);

const threadPool = entity('ThreadPool', [event('created')]);
const thread = resourceEntity('Thread', 'ThreadPool', {});
const threadUsage = resourceRecord('ThreadUsage', 'usage', 'Thread', []);

export const unitResourceSchema = schema(
  'UnitResourceExperiment',
  [threadPool, thread, taskFsm('ThreadPool', [usageField('thread', 'Thread', 'ThreadUsage')])],
  [threadUsage]
);

const system = entity('System', [event('created')]);
const memory = resourceEntity('Memory', 'System', { bytes: { kind: 'occupancy', bounded: false } });
const memoryUsage = resourceRecord('MemoryUsage', 'usage', 'Memory', ['bytes']);

export const unboundedOccupancySchema = schema(
  'UnboundedOccupancyExperiment',
  [system, memory, taskFsm('System', [usageField('memory', 'Memory', 'MemoryUsage')])],
  [memoryUsage]
);

const boundedMemory = resourceEntity(
  'Memory',
  'System',
  { bytes: { kind: 'occupancy', bounded: true } },
  'MemoryBounds'
);
const memoryBounds = resourceRecord('MemoryBounds', 'bounds', 'Memory', ['bytes']);

export const boundedOccupancySchema = schema(
  'BoundedOccupancyExperiment',
  [system, boundedMemory, taskFsm('System', [usageField('memory', 'Memory', 'MemoryUsage')])],
  [memoryUsage, memoryBounds]
);

const mixedThread = resourceEntity('Thread', 'System', {});
const mixedThreadUsage = resourceRecord('ThreadUsage', 'usage', 'Thread', []);
const mixedMemory = resourceEntity(
  'Memory',
  'System',
  { bytes: { kind: 'occupancy', bounded: true } },
  'MemoryBounds'
);
const network = resourceEntity('Network', 'System', { bytes: { kind: 'rate', bounded: false } });
const networkUsage = resourceRecord('NetworkUsage', 'usage', 'Network', ['bytes']);

export const mixedResourceSchema = schema(
  'MixedResourceExperiment',
  [
    system,
    mixedThread,
    mixedMemory,
    network,
    taskFsm('System', [
      usageField('thread', 'Thread', 'ThreadUsage'),
      usageField('memory', 'Memory', 'MemoryUsage'),
      usageField('network', 'Network', 'NetworkUsage'),
    ]),
  ],
  [mixedThreadUsage, memoryUsage, memoryBounds, networkUsage]
);

export const queryPlanWithEntitiesSchema = withQueryPlan(
  entitiesOnlySchema,
  'QueryPlanWithEntitiesExperiment'
);

export const resourceDefinitionsOnlySchema = schema(
  'ResourceDefinitionsOnlyExperiment',
  [system, memory],
  [memoryUsage]
);

export async function fetchResourceOnlySchema(): Promise<Schema> {
  return resourceOnlySchema;
}

export async function fetchResourceWithQueryPlanSchema(): Promise<Schema> {
  return resourceWithQueryPlanSchema;
}

export async function fetchQueryPlanOnlySchema(): Promise<Schema> {
  return queryPlanOnlySchema;
}

export async function fetchEntitiesOnlySchema(): Promise<Schema> {
  return entitiesOnlySchema;
}

export async function fetchNonFsmEntitiesSchema(): Promise<Schema> {
  return nonFsmEntitiesSchema;
}

export async function fetchUnitResourceSchema(): Promise<Schema> {
  return unitResourceSchema;
}

export async function fetchUnboundedOccupancySchema(): Promise<Schema> {
  return unboundedOccupancySchema;
}

export async function fetchBoundedOccupancySchema(): Promise<Schema> {
  return boundedOccupancySchema;
}

export async function fetchMixedResourceSchema(): Promise<Schema> {
  return mixedResourceSchema;
}

export async function fetchQueryPlanWithEntitiesSchema(): Promise<Schema> {
  return queryPlanWithEntitiesSchema;
}

export async function fetchResourceDefinitionsOnlySchema(): Promise<Schema> {
  return resourceDefinitionsOnlySchema;
}

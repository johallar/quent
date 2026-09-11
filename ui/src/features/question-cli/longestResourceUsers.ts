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
import { MAX_PAGE_SIZE } from '@/components/entities-table/utils';
import { buildDeepLinkUrl } from '@/features/deep-link/deepLink.codec';
import type { DeepLinkStateV3 } from '@/features/deep-link/deepLink.schema';
import type {
  QuestionCliValues,
  QuestionContext,
  QuestionDefinition,
  QuestionMetadata,
  QuestionResult,
} from './question.types';

const DEFAULT_LIMIT = 10;

interface LongestResourceUsersInput {
  resourceId: string;
  entityType?: string;
  operatorIds: string[];
  start?: number;
  end?: number;
  limit: number;
}

export interface LongestResourceUsersResult extends QuestionResult {
  scope: {
    engineId: string;
    queryId: string;
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
  };
  finding: {
    metric: 'longest-single-resource-usage-span';
    entities: Array<{
      id: string;
      instanceName: string;
      typeName: string;
      longestUsageSeconds: number;
    }>;
    totalMatchingEntities: number;
  };
}

export const longestResourceUsersMetadata: QuestionMetadata = {
  id: 'longest-resource-users',
  version: 1,
  title: 'Longest resource users',
  explanation:
    'Ranks FSM entities by their longest single usage span on one resource in a query-relative window.',
  requirements: {
    apis: ['query-bundle', 'entity-list'],
    resourceTypes: [],
    capacities: [],
    fsmStates: [],
    topologyFields: [],
  },
  parameters: [
    { name: 'resource', required: true, description: 'Leaf resource ID.' },
    { name: 'entity-type', required: false, description: 'FSM entity type name.' },
    { name: 'operator', required: false, description: 'Comma-separated operator IDs.' },
    { name: 'start', required: false, description: 'Query-relative window start in seconds.' },
    { name: 'end', required: false, description: 'Query-relative window end in seconds.' },
    { name: 'limit', required: false, description: 'Maximum ranked entities to return.' },
  ],
  limitations: [
    'The duration is the longest single matching usage span, not total usage or entity lifetime.',
    'The entity-list response does not identify the state/usage that produced the winning duration.',
    'No capacity value, occupancy, rate, bound, or saturation is measured by this question.',
    'Resource-group scopes are supported by the API but not preserved by current entity deep links.',
  ],
};

function requiredString(values: QuestionCliValues, name: string): string {
  const value = values[name];
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Missing --${name}.`);
  }
  return value;
}

function optionalNumber(values: QuestionCliValues, name: string): number | undefined {
  const value = values[name];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '' || !Number.isFinite(Number(value))) {
    throw new Error(`--${name} must be a finite number.`);
  }
  return Number(value);
}

function parseList(value: string | boolean | undefined): string[] {
  if (typeof value !== 'string') {
    return [];
  }
  return [
    ...new Set(
      value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean)
    ),
  ];
}

function parseInput(values: QuestionCliValues): LongestResourceUsersInput {
  const limit = optionalNumber(values, 'limit') ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error(`--limit must be an integer from 1 to ${MAX_PAGE_SIZE}.`);
  }
  return {
    resourceId: requiredString(values, 'resource'),
    ...(typeof values['entity-type'] === 'string'
      ? { entityType: requiredString(values, 'entity-type') }
      : {}),
    operatorIds: parseList(values.operator),
    start: optionalNumber(values, 'start'),
    end: optionalNumber(values, 'end'),
    limit,
  };
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
  if (requested) {
    if (!bundle.entities.fsm_types[requested]) {
      throw new Error(`FSM entity type "${requested}" is not declared in the query bundle.`);
    }
    if (!declaration.used_by.includes(requested)) {
      throw new Error(
        `FSM entity type "${requested}" is not declared as a user of resource type "${resource.type_name}".`
      );
    }
    return requested;
  }
  if (declaration.used_by.length !== 1) {
    return null;
  }
  const entityType = declaration.used_by[0]!;
  if (!bundle.entities.fsm_types[entityType]) {
    throw new Error(
      `Resource type "${resource.type_name}" references undeclared FSM type "${entityType}".`
    );
  }
  return entityType;
}

function resolveOperators(bundle: QueryBundle<EntityRef>, operatorIds: string[]) {
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

function buildRequest(
  context: QuestionContext,
  input: LongestResourceUsersInput,
  window: { start: number; end: number },
  entityType: string | null
): EntityListRequest<QueryFilter, OperatorFilter> {
  return {
    entry: {
      window,
      filter: {
        scope: { Resource: { resource_id: input.resourceId } },
        entity_type_name: entityType,
        min_usage_s: null,
      },
      sort: { key: 'UsageDuration', dir: 'Desc' },
      page: { page: 0, max: input.limit },
      application: { operator_ids: input.operatorIds },
    },
    app_params: { query_id: context.queryId },
  };
}

function evidenceUrl(
  context: QuestionContext,
  input: LongestResourceUsersInput,
  window: { start: number; end: number },
  entityType: string | null,
  selectedEntityId: string | undefined
): string {
  const state: DeepLinkStateV3 = {
    route: { engineId: context.engineId, queryId: context.queryId, tab: 'entities' },
    ...(input.operatorIds.length > 0 ? { selection: { operatorNodeIds: input.operatorIds } } : {}),
    entities: {
      resourceId: input.resourceId,
      ...(entityType ? { entityType } : {}),
      window,
      sortDir: 'Desc',
      pageSize: input.limit,
      page: 0,
      ...(selectedEntityId ? { selectedEntityId } : {}),
    },
  };
  const route = `/profile/engine/${encodeURIComponent(context.engineId)}/query/${encodeURIComponent(
    context.queryId
  )}/entities`;
  const currentUrl = context.appBaseUrl ? new URL(route, context.appBaseUrl).toString() : route;
  const result = buildDeepLinkUrl(currentUrl, state);
  if (!result.ok) {
    throw new Error(`Could not build evidence link: ${result.message}`);
  }
  return result.value;
}

async function run(
  context: QuestionContext,
  input: LongestResourceUsersInput
): Promise<LongestResourceUsersResult> {
  if (context.queryBundle.query_id !== context.queryId) {
    throw new Error(
      `Query bundle ID "${context.queryBundle.query_id}" does not match requested query "${context.queryId}".`
    );
  }
  const resource = context.queryBundle.entities.resources[input.resourceId];
  if (!resource) {
    throw new Error(`Resource "${input.resourceId}" is not present in the query bundle.`);
  }
  const resourceType = context.queryBundle.entities.resource_types[resource.type_name];
  if (!resourceType) {
    throw new Error(`Resource type "${resource.type_name}" is not declared in the query bundle.`);
  }
  const window = resolveWindow(context.queryBundle.duration_s, input);
  const entityType = resolveEntityType(context.queryBundle, resource, input.entityType);
  const operators = resolveOperators(context.queryBundle, input.operatorIds);
  const response = await context.api.fetchEntityList(
    context.engineId,
    buildRequest(context, input, window, entityType)
  );
  const entities = response.items.map(item => ({
    id: item.entity.id,
    instanceName: item.entity.instance_name,
    typeName: item.entity.type_name,
    longestUsageSeconds: item.usage_duration_s,
  }));

  return {
    question: {
      id: longestResourceUsersMetadata.id,
      version: longestResourceUsersMetadata.version,
      title: longestResourceUsersMetadata.title,
    },
    evidence: {
      class: 'observed',
      explanation:
        'The entity-list API directly reports each exact longest matching resource-usage span.',
    },
    resolution: {
      source: 'entity-list',
      binCount: null,
      binDurationSeconds: null,
      explanation:
        'No timeline bins are used; server-side usage spans are clipped to the requested window and converted to seconds.',
    },
    scope: {
      engineId: context.engineId,
      queryId: context.queryId,
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
    },
    finding: {
      metric: 'longest-single-resource-usage-span',
      entities,
      totalMatchingEntities: response.total,
    },
    deepLink: evidenceUrl(context, input, window, entityType, entities[0]?.id),
    limitations: [...longestResourceUsersMetadata.limitations],
  };
}

function formatSeconds(value: number): string {
  return `${value.toFixed(6).replace(/\.?0+$/u, '')}s`;
}

function formatHuman(result: LongestResourceUsersResult): string {
  const lines = [
    `${result.question.title} (v${result.question.version})`,
    `Resource: ${result.scope.resource.instanceName} (${result.scope.resource.typeName}, ${result.scope.resource.id})`,
    `Window: ${formatSeconds(result.scope.window.start)}–${formatSeconds(result.scope.window.end)}`,
    `Evidence: ${result.evidence.class} — ${result.evidence.explanation}`,
    `Bins: not applicable — ${result.resolution.explanation}`,
    'Capacity basis: none; this question ranks resource-usage spans.',
    '',
  ];
  if (result.finding.entities.length === 0) {
    lines.push('Finding: no matching FSM entities used this resource in the selected window.');
  } else {
    lines.push(`Finding: ${result.finding.totalMatchingEntities} matching FSM entities.`);
    result.finding.entities.forEach((entity, index) => {
      lines.push(
        `${index + 1}. ${entity.instanceName} (${entity.typeName}, ${entity.id}) — ${formatSeconds(
          entity.longestUsageSeconds
        )}`
      );
    });
  }
  lines.push('', `Open evidence: ${result.deepLink}`, '', 'Limitations:');
  result.limitations.forEach(limitation => lines.push(`- ${limitation}`));
  return lines.join('\n');
}

export const longestResourceUsersQuestion: QuestionDefinition<
  LongestResourceUsersInput,
  LongestResourceUsersResult
> = {
  metadata: longestResourceUsersMetadata,
  parseInput,
  run,
  formatHuman,
};

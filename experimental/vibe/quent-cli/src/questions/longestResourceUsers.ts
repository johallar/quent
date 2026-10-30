// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  prepareLongestResourceUsers,
  type LongestResourceUsersInput as SharedLongestResourceUsersInput,
  type LongestResourceUsersPreparation,
} from '@quent/query-analysis';
import { buildEvidenceDeepLink, type EvidenceDeepLinkState } from '../deepLink';
import type {
  QuestionCliValues,
  QuestionContext,
  QuestionDefinition,
  QuestionMetadata,
  QuestionResult,
} from './question.types';

const DEFAULT_LIMIT = 10;
const MAX_PAGE_SIZE = 500;

type LongestResourceUsersInput = SharedLongestResourceUsersInput;

export interface LongestResourceUsersResult extends QuestionResult {
  scope: {
    engineId: string;
    queryId: string;
    window: { start: number; end: number };
    resource: LongestResourceUsersPreparation['resource'];
    entityType: string | null;
    operators: LongestResourceUsersPreparation['operators'];
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
    {
      name: 'entity-type',
      required: false,
      description: 'FSM entity type name.',
    },
    {
      name: 'operator',
      required: false,
      description: 'Comma-separated operator IDs.',
    },
    {
      name: 'start',
      required: false,
      description: 'Query-relative window start in seconds.',
    },
    {
      name: 'end',
      required: false,
      description: 'Query-relative window end in seconds.',
    },
    {
      name: 'limit',
      required: false,
      description: 'Maximum ranked entities to return.',
    },
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

function evidenceUrl(
  context: QuestionContext,
  input: LongestResourceUsersInput,
  window: { start: number; end: number },
  entityType: string | null,
  selectedEntityId: string | undefined
): string {
  const state: EvidenceDeepLinkState = {
    route: {
      engineId: context.engineId,
      queryId: context.queryId,
      tab: 'entities',
    },
    ...(input.operatorIds.length > 0
      ? { selection: { operatorNodeIds: [...input.operatorIds] } }
      : {}),
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
  return buildEvidenceDeepLink(currentUrl, state);
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
  const preparation = prepareLongestResourceUsers(context.queryBundle, input);
  const response = await context.api.fetchEntityList(context.engineId, preparation.request);
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
      window: preparation.window,
      resource: preparation.resource,
      entityType: preparation.entityType,
      operators: preparation.operators,
    },
    finding: {
      metric: 'longest-single-resource-usage-span',
      entities,
      totalMatchingEntities: response.total,
    },
    deepLink: evidenceUrl(
      context,
      input,
      preparation.window,
      preparation.entityType,
      entities[0]?.id
    ),
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

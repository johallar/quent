// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  unwrapTaggedValue,
  type EntityRefKey,
  type QueryEntities,
  type Operator,
  type Port,
  type Statistic,
} from '@quent/utils';

// Maps entity ref string to a key in the entities object.
// Application entities have no corresponding collection in QueryEntities, so they are omitted.
export const ENTITY_REF_TO_ENTITIES_KEY: Partial<Record<EntityRefKey, keyof QueryEntities>> = {
  Engine: 'engine',
  QueryGroup: 'query_group',
  Query: 'query',
  Plan: 'plans',
  Worker: 'workers',
  Operator: 'operators',
  Port: 'ports',
  ResourceGroup: 'resource_groups',
  Resource: 'resources',
} as const;

/**
 * Converts an EntityRef to the corresponding key in the QueryEntities object.
 * Returns undefined for entity types with no QueryEntities collection (e.g. Application).
 */
export function entityRefToEntitiesKey(entityRef: EntityRefKey): keyof QueryEntities | undefined {
  return ENTITY_REF_TO_ENTITIES_KEY[entityRef];
}

export function parseCustomStatistics(rawNode: unknown): Statistic[] {
  return ((rawNode as Operator)?.statistics?.custom_statistics ?? []).map(
    ({ value: { key, value }, quantity }) => ({
      key,
      value: unwrapTaggedValue(value),
      ...(quantity !== null && quantity !== undefined ? { quantity } : {}),
    })
  );
}

export function parsePortStatistics(rawPort: unknown): Statistic[] {
  return ((rawPort as Port)?.statistics?.custom_statistics ?? []).map(({ key, value }) => ({
    key,
    value: unwrapTaggedValue(value),
  }));
}

export function parseOperatorAttributes(rawNode: unknown): Statistic[] {
  return ((rawNode as Operator)?.custom_attributes ?? []).map(({ key, value }) => ({
    key,
    value: unwrapTaggedValue(value),
  }));
}

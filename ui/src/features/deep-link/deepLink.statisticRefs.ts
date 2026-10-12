// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  statisticFieldId,
  statisticFieldLabel,
  statisticFieldName,
  type StatisticField,
  type StatisticFieldPath,
  type StatisticFieldId,
} from '@quent/utils';
import type { SortingState } from '@tanstack/react-table';
import type { DeepLinkFields } from './deepLink.fields';
import { StatisticFieldPathSchema, type StatisticFieldPathReference } from './deepLink.schema';

type PersistedStatisticReference = string | StatisticFieldPathReference;

export interface StatisticFieldRegistry {
  byId: ReadonlyMap<string, StatisticField>;
  byPath: ReadonlyMap<string, StatisticField>;
  legacyAliases: ReadonlyMap<string, ReadonlySet<StatisticFieldId>>;
}

export interface DeepLinkStatisticRegistries {
  operator: StatisticFieldRegistry;
  port: StatisticFieldRegistry;
  table: StatisticFieldRegistry;
}

export interface ResolvedStatisticViewState {
  dag:
    | {
        nodeColorField?: string;
        nodeColorPalette?: NonNullable<DeepLinkFields['dag']>['nodeColorPalette'];
        edgeWidthField?: string;
        edgeColorField?: string;
        edgeColorPalette?: NonNullable<DeepLinkFields['dag']>['edgeColorPalette'];
        nodeLabelField?: NonNullable<DeepLinkFields['dag']>['nodeLabelField'];
        layoutDirection?: NonNullable<DeepLinkFields['dag']>['layoutDirection'];
        scaleType?: NonNullable<DeepLinkFields['dag']>['scaleType'];
      }
    | undefined;
  operatorTable:
    | {
        groupingOrder?: NonNullable<DeepLinkFields['operatorTable']>['groupingOrder'];
        enabledGroups?: NonNullable<DeepLinkFields['operatorTable']>['enabledGroups'];
        visibleStats?: string[];
        aggregation?: NonNullable<DeepLinkFields['operatorTable']>['aggregation'];
        sort?: SortingState;
      }
    | undefined;
}

const pathEncoder = new TextEncoder();

function pathKey(path: StatisticFieldPath): string {
  return JSON.stringify(path);
}

function legacyHashedStatisticFieldId(path: StatisticFieldPath): string {
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  const prime = (1n << 88n) + 0x13bn;
  for (const byte of pathEncoder.encode(JSON.stringify(path))) {
    hash = BigInt.asUintN(128, (hash ^ BigInt(byte)) * prime);
  }
  return `__quent_stat_${hash.toString(16).padStart(32, '0')}`;
}

function legacyUnquotedLabel(path: StatisticFieldPath): string {
  return path
    .map(([name, occurrence]) => `${name}${occurrence ? ` [${occurrence + 1}]` : ''}`)
    .join(' › ');
}

function addAlias(
  aliases: Map<string, Set<StatisticFieldId>>,
  alias: string,
  id: StatisticFieldId
): void {
  const ids = aliases.get(alias) ?? new Set<StatisticFieldId>();
  ids.add(id);
  aliases.set(alias, ids);
}

export function createStatisticFieldRegistry(
  fields: readonly StatisticField[]
): StatisticFieldRegistry {
  const byId = new Map<string, StatisticField>();
  const byPath = new Map<string, StatisticField>();
  const legacyAliases = new Map<string, Set<StatisticFieldId>>();

  for (const field of fields) {
    byId.set(field.id, field);
    byPath.set(pathKey(field.path), field);
    for (const alias of [
      JSON.stringify(field.path),
      legacyHashedStatisticFieldId(field.path),
      statisticFieldLabel(field),
      legacyUnquotedLabel(field.path),
      statisticFieldName(field),
    ]) {
      addAlias(legacyAliases, alias, field.id);
    }
  }

  return { byId, byPath, legacyAliases };
}

export function createDeepLinkStatisticRegistries(
  operatorFields: readonly StatisticField[],
  portFields: readonly StatisticField[]
): DeepLinkStatisticRegistries {
  const durationField: StatisticField = {
    id: statisticFieldId([['duration_s', 0]]),
    path: [['duration_s', 0]],
    value: null,
  };
  return {
    operator: createStatisticFieldRegistry(operatorFields),
    port: createStatisticFieldRegistry(portFields),
    table: createStatisticFieldRegistry([...operatorFields, durationField]),
  };
}

export function resolveStatisticReference(
  registry: StatisticFieldRegistry,
  reference: PersistedStatisticReference
): StatisticFieldId | undefined {
  if (typeof reference !== 'string') {
    return registry.byPath.get(pathKey(reference))?.id;
  }

  const exact = registry.byId.get(reference);
  if (exact) {
    return exact.id;
  }
  const legacyMatches = registry.legacyAliases.get(reference);
  if (!legacyMatches || legacyMatches.size !== 1) {
    return undefined;
  }
  return [...legacyMatches][0];
}

export function persistStatisticReference(
  registry: StatisticFieldRegistry,
  id: string | null | undefined
): StatisticFieldPathReference | undefined {
  const path = id ? registry.byId.get(id)?.path : undefined;
  if (!path) {
    return undefined;
  }
  const parsed = StatisticFieldPathSchema.safeParse(path);
  return parsed.success ? parsed.data : undefined;
}

function resolveReferences(
  registry: StatisticFieldRegistry,
  references: readonly PersistedStatisticReference[]
): string[] {
  const resolved: string[] = [];
  const seen = new Set<string>();
  for (const reference of references) {
    const id = resolveStatisticReference(registry, reference);
    if (id && !seen.has(id)) {
      seen.add(id);
      resolved.push(id);
    }
  }
  return resolved;
}

export function resolveDeepLinkStatisticReferences(
  dag: DeepLinkFields['dag'],
  operatorTable: DeepLinkFields['operatorTable'],
  registries: DeepLinkStatisticRegistries
): ResolvedStatisticViewState {
  const nodeColorField = dag?.nodeColorField
    ? resolveStatisticReference(registries.operator, dag.nodeColorField)
    : undefined;
  const edgeWidthField = dag?.edgeWidthField
    ? resolveStatisticReference(registries.port, dag.edgeWidthField)
    : undefined;
  const edgeColorField = dag?.edgeColorField
    ? resolveStatisticReference(registries.port, dag.edgeColorField)
    : undefined;

  return {
    dag: dag
      ? {
          ...(nodeColorField ? { nodeColorField } : {}),
          ...(dag.nodeColorPalette ? { nodeColorPalette: dag.nodeColorPalette } : {}),
          ...(edgeWidthField ? { edgeWidthField } : {}),
          ...(edgeColorField ? { edgeColorField } : {}),
          ...(dag.edgeColorPalette ? { edgeColorPalette: dag.edgeColorPalette } : {}),
          ...(dag.nodeLabelField ? { nodeLabelField: dag.nodeLabelField } : {}),
          ...(dag.layoutDirection ? { layoutDirection: dag.layoutDirection } : {}),
          ...(dag.scaleType ? { scaleType: dag.scaleType } : {}),
        }
      : undefined,
    operatorTable: operatorTable
      ? {
          ...(operatorTable.groupingOrder ? { groupingOrder: operatorTable.groupingOrder } : {}),
          ...(operatorTable.enabledGroups ? { enabledGroups: operatorTable.enabledGroups } : {}),
          ...(operatorTable.visibleStats
            ? {
                visibleStats: resolveReferences(
                  registries.table,
                  operatorTable.visibleStats as readonly PersistedStatisticReference[]
                ),
              }
            : {}),
          ...(operatorTable.aggregation ? { aggregation: operatorTable.aggregation } : {}),
          ...(operatorTable.sort
            ? {
                sort: operatorTable.sort.flatMap(entry => {
                  const id = resolveStatisticReference(
                    registries.table,
                    entry.id as PersistedStatisticReference
                  );
                  return id ? [{ id, desc: entry.desc }] : [];
                }),
              }
            : {}),
        }
      : undefined,
  };
}

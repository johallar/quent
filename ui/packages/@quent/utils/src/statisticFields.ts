// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { isStatStruct, type Statistic, type StatValue } from './dagTypes';

export type StatisticFieldPath = ReadonlyArray<readonly [string, number]>;

declare const statisticFieldIdBrand: unique symbol;

/** Stable selection identity for a projected statistic field. */
export type StatisticFieldId = string & {
  readonly [statisticFieldIdBrand]: 'StatisticFieldId';
};

/** A selectable scalar statistic, with identity separate from display metadata. */
export interface StatisticField {
  id: StatisticFieldId;
  path: StatisticFieldPath;
  value: StatValue;
  quantity?: string;
}

export interface StatisticFieldPresentation {
  fieldName: string;
  label: string;
  title: string;
}

const FIELD_PATH_PREFIX = '__quent_stat_path__:';

function isStatisticFieldPath(value: unknown): value is StatisticFieldPath {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      part =>
        Array.isArray(part) &&
        part.length === 2 &&
        typeof part[0] === 'string' &&
        Number.isInteger(part[1]) &&
        part[1] >= 0
    )
  );
}

function statisticFieldPathFromId(id: string): StatisticFieldPath | undefined {
  if (!id.startsWith(FIELD_PATH_PREFIX)) {
    return undefined;
  }
  try {
    const path: unknown = JSON.parse(id.slice(FIELD_PATH_PREFIX.length));
    return isStatisticFieldPath(path) ? path : undefined;
  } catch {
    return undefined;
  }
}

function statisticFieldPathLabel(path: StatisticFieldPath): string {
  return path
    .map(([name, occurrence]) => {
      const label = !name || /[›[\]"\\\n\r]/u.test(name) ? JSON.stringify(name) : name;
      return `${label}${occurrence ? ` [${occurrence + 1}]` : ''}`;
    })
    .join(' › ');
}

/** Flat names stay readable; structured or repeated fields use their explicit path. */
export function statisticFieldId(path: StatisticFieldPath): StatisticFieldId {
  const [name, occurrence] = path[0];
  if (
    path.length === 1 &&
    occurrence === 0 &&
    name.length > 0 &&
    !name.startsWith(FIELD_PATH_PREFIX)
  ) {
    return name as StatisticFieldId;
  }
  return `${FIELD_PATH_PREFIX}${JSON.stringify(path)}` as StatisticFieldId;
}

export function statisticFieldLabel(field: StatisticField | string): string {
  if (typeof field === 'string') {
    const path = statisticFieldPathFromId(field);
    return path ? statisticFieldPathLabel(path) : field;
  }
  return statisticFieldPathLabel(field.path);
}

export function statisticFieldName(
  field: StatisticField | string | null | undefined,
  fields?: readonly StatisticField[]
): string {
  if (field == null) {
    return '';
  }
  if (typeof field !== 'string') {
    return field.path[field.path.length - 1][0];
  }
  const resolvedField = fields?.find(candidate => candidate.id === field);
  if (resolvedField) {
    return statisticFieldName(resolvedField);
  }
  const path = statisticFieldPathFromId(field);
  return path ? path[path.length - 1][0] : field;
}

/** Resolves leaf-name behavior separately from full-path display metadata. */
export function resolveStatisticFieldPresentation(
  field: StatisticField | string,
  fields?: readonly StatisticField[]
): StatisticFieldPresentation {
  const resolvedField =
    typeof field === 'string' ? fields?.find(candidate => candidate.id === field) : field;
  const presentedField = resolvedField ?? field;
  const fieldName = statisticFieldName(presentedField);
  const title = statisticFieldLabel(presentedField);
  return {
    fieldName,
    label: title,
    title,
  };
}

/** Builds consistent display metadata for an ordered field collection. */
export function buildStatisticFieldPresentations(
  fields: readonly StatisticField[]
): Map<string, StatisticFieldPresentation> {
  const result = new Map<string, StatisticFieldPresentation>();
  for (const field of fields) {
    if (result.has(field.id)) {
      continue;
    }
    result.set(field.id, resolveStatisticFieldPresentation(field));
  }
  return result;
}

function projectStatisticScalarFieldsAt(
  statistics: readonly Statistic[],
  parent: StatisticFieldPath,
  inheritedQuantity: string | undefined
): StatisticField[] {
  const occurrences = new Map<string, number>();
  return statistics.flatMap(statistic => {
    const occurrence = occurrences.get(statistic.key) ?? 0;
    occurrences.set(statistic.key, occurrence + 1);
    const path: StatisticFieldPath = [...parent, [statistic.key, occurrence]];
    const quantity = statistic.quantity !== undefined ? statistic.quantity : inheritedQuantity;
    if (isStatStruct(statistic.value)) {
      return projectStatisticScalarFieldsAt(statistic.value.fields, path, quantity);
    }
    if (Array.isArray(statistic.value)) {
      return [];
    }
    return [
      {
        id: statisticFieldId(path),
        path,
        value: statistic.value,
        ...(quantity !== undefined ? { quantity } : {}),
      },
    ];
  });
}

/** Recurse through structs, omit lists, and inherit the nearest quantity for scalar leaves. */
export function projectStatisticScalarFields(
  statistics: readonly Statistic[],
  parent: StatisticFieldPath = []
): StatisticField[] {
  return projectStatisticScalarFieldsAt(statistics, parent, undefined);
}

interface StatisticTreeNode {
  key: string;
  value?: StatValue;
  quantity?: string;
  children: Map<string, StatisticTreeNode>;
  scalarOrder?: number;
  descendantOrder?: number;
}

function statisticTreeNode(key: string): StatisticTreeNode {
  return { key, children: new Map() };
}

function statisticsFromTree(nodes: Iterable<StatisticTreeNode>): Statistic[] {
  return [...nodes].flatMap(node => {
    const statistics: Array<{ statistic: Statistic; order: number }> = [];
    if (node.scalarOrder !== undefined) {
      statistics.push({
        statistic: {
          key: node.key,
          value: node.value ?? null,
          ...(node.quantity !== undefined ? { quantity: node.quantity } : {}),
        },
        order: node.scalarOrder,
      });
    }
    if (node.descendantOrder !== undefined) {
      statistics.push({
        statistic: {
          key: node.key,
          value: { kind: 'struct', fields: statisticsFromTree(node.children.values()) },
        },
        order: node.descendantOrder,
      });
    }
    return statistics
      .sort((left, right) => left.order - right.order)
      .map(({ statistic }) => statistic);
  });
}

/**
 * Rebuilds producer-keyed inspection trees from canonical scalar field paths.
 */
export function reconstructStatisticsFromFields(fields: readonly StatisticField[]): Statistic[] {
  const root = statisticTreeNode('');
  fields.forEach((field, order) => {
    let parent = root;
    field.path.forEach(([key, occurrence], index) => {
      const nodeId = JSON.stringify([key, occurrence]);
      let node = parent.children.get(nodeId);
      if (!node) {
        node = statisticTreeNode(key);
        parent.children.set(nodeId, node);
      }
      if (index === field.path.length - 1) {
        node.value = field.value;
        node.quantity = field.quantity;
        node.scalarOrder = order;
      } else {
        node.descendantOrder = Math.min(node.descendantOrder ?? order, order);
      }
      parent = node;
    });
  });
  return statisticsFromTree(root.children.values());
}

/** @deprecated Use projectStatisticScalarFields to make the projection policy explicit. */
export function flattenStatistics(
  statistics: readonly Statistic[],
  parent: StatisticFieldPath = []
): StatisticField[] {
  return projectStatisticScalarFields(statistics, parent);
}

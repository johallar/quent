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
    if (field.startsWith(FIELD_PATH_PREFIX)) {
      try {
        const path: unknown = JSON.parse(field.slice(FIELD_PATH_PREFIX.length));
        if (isStatisticFieldPath(path)) {
          return statisticFieldPathLabel(path);
        }
      } catch {
        // Preserve malformed or producer-owned field names verbatim.
      }
    }
    return field;
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
  return resolvedField ? statisticFieldName(resolvedField) : field;
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
    const fieldName = statisticFieldName(field);
    const title = statisticFieldLabel(field);
    result.set(field.id, {
      fieldName,
      label: title,
      title,
    });
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

/** @deprecated Use projectStatisticScalarFields to make the projection policy explicit. */
export function flattenStatistics(
  statistics: readonly Statistic[],
  parent: StatisticFieldPath = []
): StatisticField[] {
  return projectStatisticScalarFields(statistics, parent);
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { isStatStruct, type Statistic } from './dagTypes';

export type StatisticFieldPath = ReadonlyArray<readonly [string, number]>;

/** A selectable scalar statistic, with identity separate from display metadata. */
export interface StatisticField extends Statistic {
  path: StatisticFieldPath;
}

const FIELD_ID_PREFIX = '__quent_stat_';
const MAX_FLAT_ID_LENGTH = 256;
const pathEncoder = new TextEncoder();

/** Stable bounded identity derived from names and sibling occurrences, never values. */
export function statisticFieldId(path: StatisticFieldPath): string {
  const [name, occurrence] = path[0];
  if (
    path.length === 1 &&
    occurrence === 0 &&
    name.length > 0 &&
    name.length <= MAX_FLAT_ID_LENGTH &&
    !name.startsWith(FIELD_ID_PREFIX)
  ) {
    return name;
  }
  // A 128-bit FNV-1a fingerprint keeps arbitrarily long paths out of deep links.
  let hash = 0x6c62272e07bb014262b821756295c58dn;
  const prime = (1n << 88n) + 0x13bn;
  for (const byte of pathEncoder.encode(JSON.stringify(path))) {
    hash = BigInt.asUintN(128, (hash ^ BigInt(byte)) * prime);
  }
  return `${FIELD_ID_PREFIX}${hash.toString(16).padStart(32, '0')}`;
}

export function statisticFieldLabel(field: StatisticField | string): string {
  if (typeof field === 'string') {
    return field;
  }
  return field.path
    .map(([name, occurrence]) => {
      // Quote literal separators and occurrence suffixes so labels remain distinct.
      const label = !name || /[›[\]"\\\n\r]/u.test(name) ? JSON.stringify(name) : name;
      return `${label}${occurrence ? ` [${occurrence + 1}]` : ''}`;
    })
    .join(' › ');
}

export function statisticFieldName(field: StatisticField | string): string {
  return typeof field === 'string' ? field : field.path[field.path.length - 1][0];
}

/** Scalar metric projection only; the inspection tree stays ordered and intact. */
export function flattenStatistics(
  statistics: readonly Statistic[],
  parent: StatisticFieldPath = []
): StatisticField[] {
  const occurrences = new Map<string, number>();
  return statistics.flatMap(statistic => {
    const occurrence = occurrences.get(statistic.key) ?? 0;
    occurrences.set(statistic.key, occurrence + 1);
    const path: StatisticFieldPath = [...parent, [statistic.key, occurrence]];
    if (isStatStruct(statistic.value)) {
      return flattenStatistics(statistic.value.fields, path);
    }
    if (Array.isArray(statistic.value)) {
      return [];
    }
    return [{ ...statistic, key: statisticFieldId(path), path }];
  });
}

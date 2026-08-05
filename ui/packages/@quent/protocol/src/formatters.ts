// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  formatBytes,
  formatCompactWithPrefix,
  formatNumber,
  formatWithPrefix,
  isBytesRateStat,
  isBytesStat,
  isNumericValue,
} from '@quent/utils';
import type { CapacityKind, QuantitySpec } from './generated';
import type { StatValue } from './statValue';

export function formatQuantityCompact(
  value: number,
  spec: QuantitySpec,
  kind: CapacityKind
): string {
  const prefixSystem = kind === 'Occupancy' ? spec.occupancy_prefix : spec.rate_prefix;
  const symbol = kind === 'Rate' ? `${spec.symbol}/s` : spec.symbol;
  return formatCompactWithPrefix(value, symbol, prefixSystem);
}

function unwrapToString(value: unknown): string {
  const result = unwrapTaggedValue(value);
  return Array.isArray(result) ? result.join('\n') : String(result ?? '');
}

export function unwrapTaggedValue(value: unknown): StatValue {
  switch (true) {
    case value === null || value === undefined:
      return null;
    case typeof value === 'string' || typeof value === 'number':
      return value;
    case typeof value === 'bigint':
      return value;
    case Array.isArray(value):
      return (value as unknown[]).map(unwrapToString);
    case typeof value === 'object': {
      const object = value as Record<string, unknown>;
      const keys = Object.keys(object);
      if (keys.length === 2 && 'key' in object && 'value' in object) {
        return `${object.key}: ${unwrapToString(object.value)}`;
      }
      if (keys.length === 1) {
        return unwrapTaggedValue(Object.values(object)[0]);
      }
      return JSON.stringify(value);
    }
    default:
      return String(value);
  }
}

export function formatAttributeValue(key: string, value: unknown): string {
  const unwrapped = unwrapTaggedValue(value);
  if (unwrapped == null) return '—';
  if (isNumericValue(unwrapped)) {
    if (isBytesRateStat(key)) return formatWithPrefix(unwrapped, 'B/s', 'Si', 2);
    if (isBytesStat(key)) return formatBytes(unwrapped, 2);
    return formatNumber(unwrapped);
  }
  if (Array.isArray(unwrapped)) return unwrapped.join(', ');
  return String(unwrapped);
}

export function formatQuantity(
  value: number,
  spec: QuantitySpec,
  kind: CapacityKind,
  decimals: number = 2
): string {
  const prefixSystem = kind === 'Occupancy' ? spec.occupancy_prefix : spec.rate_prefix;
  const symbol = kind === 'Rate' ? `${spec.symbol}/s` : spec.symbol;
  return formatWithPrefix(value, symbol, prefixSystem, decimals);
}

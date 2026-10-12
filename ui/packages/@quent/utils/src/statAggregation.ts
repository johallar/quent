// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  normalizeStatisticAggregationMode,
  type AggMode,
  type StatisticAggregationMode,
} from './aggMode';
import type { StatisticField } from './statisticFields';

export type NumericStatisticValue = number | bigint;

export interface NumericAggregates {
  sum: number | bigint | null;
  mean: number | null;
  min: number | bigint | null;
  max: number | bigint | null;
  stdev: number | null;
}

export interface StatisticFieldAggregates extends NumericAggregates {
  quantity?: string;
}

export function isNumericStatisticValue(value: unknown): value is NumericStatisticValue {
  return typeof value === 'number' || typeof value === 'bigint';
}

export function haveConsistentStatisticQuantities(
  fields: readonly Pick<StatisticField, 'quantity'>[]
): boolean {
  const quantity = fields[0]?.quantity;
  return fields.every(field => field.quantity === quantity);
}

/** Computes numeric aggregates, preserving bigint sum/min/max when every value is bigint. */
export function aggregateNumericValues(
  values: Iterable<NumericStatisticValue>
): NumericAggregates | null {
  const numbers: number[] = [];
  const bigints: bigint[] = [];
  for (const value of values) {
    if (typeof value === 'bigint') {
      bigints.push(value);
    } else {
      numbers.push(value);
    }
  }

  const count = numbers.length + bigints.length;
  if (count === 0) {
    return null;
  }

  const normalized = [...numbers, ...bigints.map(Number)];
  let numericSum = 0;
  let numericMin = Infinity;
  let numericMax = -Infinity;
  for (const value of normalized) {
    numericSum += value;
    numericMin = Math.min(numericMin, value);
    numericMax = Math.max(numericMax, value);
  }

  let sum: number | bigint = numericSum;
  let min: number | bigint = numericMin;
  let max: number | bigint = numericMax;
  if (numbers.length === 0) {
    sum = 0n;
    min = bigints[0]!;
    max = bigints[0]!;
    for (const value of bigints) {
      sum += value;
      min = value < min ? value : min;
      max = value > max ? value : max;
    }
  }

  const mean = Number(sum) / count;
  let stdev: number | null = null;
  if (count > 1) {
    let squaredDifferenceSum = 0;
    for (const value of normalized) {
      squaredDifferenceSum += (value - mean) ** 2;
    }
    stdev = Math.sqrt(squaredDifferenceSum / (count - 1));
  }

  return { sum, mean, min, max, stdev };
}

export function getAggregateValue(
  aggregates: NumericAggregates,
  mode: AggMode
): number | bigint | null {
  switch (normalizeStatisticAggregationMode(mode)) {
    case 'mean':
      return aggregates.mean;
    case 'min':
      return aggregates.min;
    case 'max':
      return aggregates.max;
    case 'stdev':
      return aggregates.stdev;
    case 'sum':
    default:
      return aggregates.sum;
  }
}

/** Selects one aggregate using a canonical runtime mode. */
export function selectStatisticAggregate(
  aggregates: NumericAggregates,
  mode: StatisticAggregationMode
): NumericStatisticValue | null {
  return getAggregateValue(aggregates, mode);
}

/**
 * Aggregates fields only when every value is numeric and every quantity agrees.
 */
export function aggregateStatisticFieldValues(
  fields: readonly Pick<StatisticField, 'value' | 'quantity'>[]
): StatisticFieldAggregates | null {
  if (
    fields.length === 0 ||
    !fields.every(field => isNumericStatisticValue(field.value)) ||
    !haveConsistentStatisticQuantities(fields)
  ) {
    return null;
  }
  const aggregates = aggregateNumericValues(
    fields.map(field => field.value as NumericStatisticValue)
  );
  if (!aggregates) {
    return null;
  }
  const quantity = fields[0]?.quantity;
  return {
    ...aggregates,
    ...(quantity !== undefined ? { quantity } : {}),
  };
}

/** Aggregates compatible fields while preserving the first field's identity and quantity. */
export function aggregateStatisticFields(
  fields: readonly StatisticField[],
  mode: StatisticAggregationMode
): StatisticField | undefined {
  const aggregates = aggregateStatisticFieldValues(fields);
  if (!aggregates) {
    return undefined;
  }
  const value = selectStatisticAggregate(aggregates, mode);
  if (value === null) {
    return undefined;
  }
  const { quantity: _quantity, ...field } = fields[0];
  return {
    ...field,
    value,
    ...(aggregates.quantity !== undefined ? { quantity: aggregates.quantity } : {}),
  };
}

/**
 * Aggregates values with `mode` and returns the result as a plain number, or
 * `undefined` when there are no values or the mode has no result (e.g. sample
 * standard deviation of a single value).
 */
export function aggregateToNumber(
  values: Iterable<NumericStatisticValue>,
  mode: AggMode
): number | undefined {
  const aggregates = aggregateNumericValues(values);
  if (!aggregates) {
    return undefined;
  }
  const value = getAggregateValue(aggregates, mode);
  return value === null ? undefined : Number(value);
}

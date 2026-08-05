// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Centralized formatting utilities for charts and UI.
 */

export type UnitPrefixSystem = 'Si' | 'Iec' | 'None';

const MS_PER_SECOND = 1000;
const MS_PER_MINUTE = 60 * MS_PER_SECOND;
const MS_PER_HOUR = 60 * MS_PER_MINUTE;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export function formatDuration(ms: number, decimals: number = 2): string {
  const absMs = Math.abs(ms);
  const sign = ms < 0 ? '-' : '';

  switch (true) {
    case absMs < 0.001:
      return `${sign}${(absMs * 1_000_000).toFixed(decimals)}ns`;
    case absMs < 1:
      return `${sign}${(absMs * 1_000).toFixed(decimals)}µs`;
    case absMs < MS_PER_SECOND:
      return `${sign}${absMs.toFixed(decimals)}ms`;
    case absMs < MS_PER_MINUTE:
      return `${sign}${(absMs / MS_PER_SECOND).toFixed(decimals)}s`;
    case absMs < MS_PER_HOUR:
      return `${sign}${(absMs / MS_PER_MINUTE).toFixed(decimals)}min`;
    case absMs < MS_PER_DAY:
      return `${sign}${(absMs / MS_PER_HOUR).toFixed(decimals)}h`;
    default:
      return `${sign}${(absMs / MS_PER_DAY).toFixed(decimals)}d`;
  }
}

/**
 * Format a duration with precision automatically derived from the visible time window.
 * Picks enough decimal places so that values ~1/1000th of the window apart
 * produce distinct formatted strings.
 * @param ms - Duration in milliseconds
 * @param windowMs - Visible time window width in milliseconds
 */
export function formatDurationForWindow(ms: number, windowMs: number): string {
  const absMs = Math.abs(ms);
  const resolution = Math.abs(windowMs) / 1000;

  let unitMs: number;
  if (absMs < 0.001) unitMs = 1e-6;
  else if (absMs < 1) unitMs = 0.001;
  else if (absMs < MS_PER_SECOND) unitMs = 1;
  else if (absMs < MS_PER_MINUTE) unitMs = MS_PER_SECOND;
  else if (absMs < MS_PER_HOUR) unitMs = MS_PER_MINUTE;
  else if (absMs < MS_PER_DAY) unitMs = MS_PER_HOUR;
  else unitMs = MS_PER_DAY;

  const resolutionInUnit = resolution / unitMs;
  const decimals =
    resolutionInUnit > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(resolutionInUnit)))) : 2;

  return formatDuration(ms, decimals);
}

/**
 * Format a duration with precision derived from the axis tick interval.
 * Ensures no two adjacent axis labels produce the same string by choosing
 * enough decimals so that one interval step is distinguishable in the
 * label's display unit.
 */
export function formatDurationForAxisInterval(ms: number, intervalMs: number): string {
  const absMs = Math.abs(ms);

  let unitMs: number;
  if (absMs < 0.001) unitMs = 1e-6;
  else if (absMs < 1) unitMs = 0.001;
  else if (absMs < MS_PER_SECOND) unitMs = 1;
  else if (absMs < MS_PER_MINUTE) unitMs = MS_PER_SECOND;
  else if (absMs < MS_PER_HOUR) unitMs = MS_PER_MINUTE;
  else if (absMs < MS_PER_DAY) unitMs = MS_PER_HOUR;
  else unitMs = MS_PER_DAY;

  const intervalInUnit = intervalMs / unitMs;
  const decimals =
    intervalInUnit > 0 ? Math.min(6, Math.max(0, Math.ceil(-Math.log10(intervalInUnit)))) : 2;

  return formatDuration(ms, decimals);
}

// Precomputed threshold/divisor tables to avoid Math.log/Math.pow per call.
const SI_UP: readonly [number, string][] = [
  [1e15, 'P'],
  [1e12, 'T'],
  [1e9, 'G'],
  [1e6, 'M'],
  [1e3, 'k'],
  [1, ''],
];
const SI_DOWN: readonly [number, string][] = [
  [1, ''],
  [1e-3, 'm'],
  [1e-6, 'µ'],
  [1e-9, 'n'],
  [1e-12, 'p'],
];
const IEC: readonly [number, string][] = [
  [1125899906842624, 'Pi'],
  [1099511627776, 'Ti'],
  [1073741824, 'Gi'],
  [1048576, 'Mi'],
  [1024, 'Ki'],
  [1, ''],
];

export function formatWithPrefix(
  value: number | bigint,
  symbol: string,
  prefixSystem: UnitPrefixSystem,
  decimals: number = 1
): string {
  // For the unprefixed case with a bigint, avoid Number() coercion to preserve full precision
  if (prefixSystem === 'None' && typeof value === 'bigint') {
    if (value === 0n) return symbol ? `0 ${symbol}` : '0';
    const absB = value < 0n ? -value : value;
    const signB = value < 0n ? '-' : '';
    const str = decimals === 0 ? absB.toString() : `${absB}.${'0'.repeat(decimals)}`;
    return symbol ? `${signB}${str} ${symbol}` : `${signB}${str}`;
  }

  const num = typeof value === 'bigint' ? Number(value) : value;

  if (num === 0) return symbol ? `0 ${symbol}` : '0';

  const abs = num < 0 ? -num : num;
  const sign = num < 0 ? '-' : '';

  if (prefixSystem === 'None') {
    return symbol ? `${sign}${abs.toFixed(decimals)} ${symbol}` : `${sign}${abs.toFixed(decimals)}`;
  }

  if (prefixSystem === 'Si' && abs < 1) {
    for (let i = 1; i < SI_DOWN.length; i++) {
      if (abs >= SI_DOWN[i][0]) {
        const scaled = abs / SI_DOWN[i][0];
        return `${sign}${scaled.toFixed(decimals)} ${SI_DOWN[i][1]}${symbol}`;
      }
    }
    const last = SI_DOWN[SI_DOWN.length - 1];
    return `${sign}${(abs / last[0]).toFixed(decimals)} ${last[1]}${symbol}`;
  }

  const table = prefixSystem === 'Iec' ? IEC : SI_UP;
  const roundingFactor = 10 ** decimals;
  for (let i = 0; i < table.length; i++) {
    if (abs >= table[i][0]) {
      const scaled = abs / table[i][0];
      // If floating-point rounding bumps the mantissa into the next prefix, step up
      if (
        i > 0 &&
        Math.round(scaled * roundingFactor) >= (table[i - 1][0] / table[i][0]) * roundingFactor
      ) {
        return `${sign}${(abs / table[i - 1][0]).toFixed(decimals)} ${table[i - 1][1]}${symbol}`;
      }
      return `${sign}${scaled.toFixed(decimals)} ${table[i][1]}${symbol}`;
    }
  }
  const last = table[table.length - 1];
  return `${sign}${(abs / last[0]).toFixed(decimals)} ${last[1]}${symbol}`;
}

/**
 * 2–3 significant digits: one decimal below 10, integers from 10 up.
 * Trailing ".0" is dropped ("2", not "2.0").
 */
function compactDigits(scaled: number): string {
  const fixed = scaled >= 10 ? scaled.toFixed(0) : scaled.toFixed(1);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

/**
 * Compact variant of {@link formatWithPrefix} for tight spaces (in-bar labels):
 * 2–3 significant digits, no space, prefix + symbol only — e.g. "482", "1.2k",
 * "45MiB".
 */
export function formatCompactWithPrefix(
  value: number,
  symbol: string,
  prefixSystem: UnitPrefixSystem
): string {
  const abs = value < 0 ? -value : value;
  const sign = value < 0 ? '-' : '';
  if (value === 0) return `0${symbol}`;

  if (prefixSystem === 'Si' && abs < 1) {
    for (let i = 1; i < SI_DOWN.length; i++) {
      if (abs >= SI_DOWN[i][0]) {
        return `${sign}${compactDigits(abs / SI_DOWN[i][0])}${SI_DOWN[i][1]}${symbol}`;
      }
    }
    const last = SI_DOWN[SI_DOWN.length - 1];
    return `${sign}${compactDigits(abs / last[0])}${last[1]}${symbol}`;
  }

  if (prefixSystem !== 'None') {
    const table = prefixSystem === 'Iec' ? IEC : SI_UP;
    for (let i = 0; i < table.length; i++) {
      if (abs >= table[i][0]) {
        return `${sign}${compactDigits(abs / table[i][0])}${table[i][1]}${symbol}`;
      }
    }
  }

  return `${sign}${compactDigits(abs)}${symbol}`;
}

/**
 * Format a plain number with locale-appropriate grouping separators and sensible decimal places.
 * Integers are formatted with commas (e.g. 1,234,567).
 * Floats are rounded to 3 significant figures (e.g. 0.00123, 1.23, 12,300).
 */
export function formatNumber(value: number | bigint): string {
  // bigint formats losslessly via Intl and is always an integer.
  if (typeof value === 'bigint' || Number.isInteger(value)) {
    return new Intl.NumberFormat().format(value);
  }
  return new Intl.NumberFormat(undefined, { maximumSignificantDigits: 3 }).format(value);
}

/**
 * Format a number for dense tables (e.g. pivot cells): integers with grouping, floats capped to
 * `maximumFractionDigits` decimal places. Differs from {@link formatNumber}, which uses significant
 * figures for floats and is better suited to charts and DAG field labels.
 */
export function formatNumberWithMaxFractionDigits(
  value: number,
  maximumFractionDigits = 4
): string {
  if (Number.isInteger(value)) {
    return new Intl.NumberFormat().format(value);
  }
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value);
}

export function formatBytes(value: number | bigint, decimals = 1): string {
  return formatWithPrefix(value, 'B', 'Iec', decimals);
}

/** Bytes-like statistic names (pivot tables, DAG field labels). */
export function isBytesStat(name: string): boolean {
  return (
    name.includes('_bytes') ||
    name.endsWith('_byte') ||
    name.startsWith('bytes_') ||
    name === 'bytes'
  );
}

export function isNumericValue(v: unknown): v is number | bigint {
  return typeof v === 'number' || typeof v === 'bigint';
}

/** Bytes-rate statistic names (e.g. bytes_per_sec) — SI-scaled B/s display. */
export function isBytesRateStat(name: string): boolean {
  return name === 'bytes_per_sec' || name.endsWith('_bytes_per_sec');
}

/** Row/batch count statistics — use SI-scaled display (k/M/…). */
export function isCountStat(name: string): boolean {
  return (
    name.includes('_rows') ||
    name.endsWith('_row') ||
    name.startsWith('rows_') ||
    name.includes('_batches') ||
    name.endsWith('_batch') ||
    name.startsWith('batches_')
  );
}

function formatSiCount(value: number, decimals = 2): string {
  return formatWithPrefix(value, '', 'Si', decimals);
}

/**
 * Infer a numeric display formatter from a statistic/field name (DAG labels, pivot cells, legends).
 * Order: duration (ns) → bytes → row/batch counts → throughput → ratios → default table number.
 */
export function inferFieldFormatter(fieldName: string): (value: number | bigint) => string {
  return (value: number | bigint): string => {
    const num = typeof value === 'bigint' ? Number(value) : value;
    if (fieldName.endsWith('_ns')) return formatDuration(num / 1e6);
    if (isBytesStat(fieldName)) return formatBytes(value, 2);
    if (isCountStat(fieldName)) return formatSiCount(num, 2);
    if (fieldName.endsWith('_mbs')) return `${num.toFixed(1)} MB/s`;
    if (
      fieldName.endsWith('_ratio') ||
      fieldName.endsWith('_fraction') ||
      fieldName.endsWith('_fpr') ||
      fieldName.endsWith('_selectivity') ||
      fieldName.endsWith('_rate')
    )
      return `${(num * 100).toFixed(1)}%`;
    return typeof value === 'bigint'
      ? formatNumber(value)
      : formatNumberWithMaxFractionDigits(num, 4);
  };
}

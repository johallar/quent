// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  ACTIVE_SPAN_METRIC,
  type QueryDiffResult,
  type QueryDiffRow,
  type SerializedNumericValue,
} from '@quent/query-diff';

interface QueryDiffFormatOptions {
  color?: boolean;
}

type DeltaSign = -1 | 0 | 1;

function formatNumeric(value: SerializedNumericValue | null, metric: string): string {
  if (value === null) {
    return '—';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (metric === ACTIVE_SPAN_METRIC) {
    return value.toFixed(6).replace(/\.?0+$/u, '');
  }
  return value.toLocaleString('en-US', { maximumSignificantDigits: 10 });
}

function deltaSign(value: SerializedNumericValue | null): DeltaSign {
  if (value === null) {
    return 0;
  }
  if (typeof value === 'string') {
    if (/^-0*$/u.test(value) || /^0*$/u.test(value)) {
      return 0;
    }
    return value.startsWith('-') ? -1 : 1;
  }
  return value < 0 ? -1 : value > 0 ? 1 : 0;
}

function colorDelta(value: string, sign: DeltaSign, color: boolean): string {
  if (!color || sign === 0) {
    return value;
  }
  const code = sign < 0 ? 34 : 31;
  return `\u001B[${code}m${value}\u001B[39m`;
}

function renderTable(rows: QueryDiffRow[], color: boolean): string {
  const headers = ['Metric', 'Quantity', 'Baseline', 'Candidate', 'Delta', 'Delta %'];
  const values = rows.map(row => [
    row.metric,
    row.quantity ?? '—',
    formatNumeric(row.baseline, row.metric),
    formatNumeric(row.candidate, row.metric),
    formatNumeric(row.delta, row.metric),
    row.deltaPercent === null
      ? '—'
      : `${row.deltaPercent >= 0 ? '+' : ''}${row.deltaPercent.toFixed(2)}%`,
  ]);
  const widths = headers.map((header, index) =>
    Math.max(header.length, ...values.map(row => row[index]!.length))
  );
  const numericColumns = new Set([2, 3, 4, 5]);
  const border = (left: string, middle: string, right: string) =>
    `${left}${widths.map(width => '─'.repeat(width + 2)).join(middle)}${right}`;
  const formatRow = (row: string[], sign: DeltaSign = 0) => {
    const cells = row.map((value, index) => {
      const padded = numericColumns.has(index)
        ? value.padStart(widths[index]!)
        : value.padEnd(widths[index]!);
      return index === 4 || index === 5 ? colorDelta(padded, sign, color) : padded;
    });
    return `│ ${cells.join(' │ ')} │`;
  };
  return [
    border('┌', '┬', '┐'),
    formatRow(headers),
    border('├', '┼', '┤'),
    ...values.map((row, index) => formatRow(row, deltaSign(rows[index]!.delta))),
    border('└', '┴', '┘'),
  ].join('\n');
}

function renderGroupedTables(rows: QueryDiffRow[], color: boolean): string {
  const groups = new Map<string, { heading: string; rows: QueryDiffRow[] }>();
  for (const row of rows) {
    const key = `${row.scope}\0${row.operatorType}`;
    const existing = groups.get(key);
    if (existing) {
      existing.rows.push(row);
    } else {
      groups.set(key, {
        heading: `${row.scope === 'logical' ? 'Logical' : 'Physical'} · ${row.operatorType}`,
        rows: [row],
      });
    }
  }
  return [...groups.values()]
    .map(group => `${group.heading}\n${renderTable(group.rows, color)}`)
    .join('\n\n');
}

export function formatQueryDiff(
  result: QueryDiffResult,
  options: QueryDiffFormatOptions = {}
): string {
  const baselineId = result.baseline.engineId
    ? `${result.baseline.engineId} / ${result.baseline.queryId}`
    : result.baseline.queryId;
  const candidateId = result.candidate.engineId
    ? `${result.candidate.engineId} / ${result.candidate.queryId}`
    : result.candidate.queryId;
  const lines = [
    `Baseline: ${baselineId} (${result.baseline.durationSeconds}s)`,
    `Candidate: ${candidateId} (${result.candidate.durationSeconds}s)`,
    '',
    result.rows.length > 0
      ? renderGroupedTables(result.rows, options.color ?? false)
      : 'No numeric operator metrics found.',
    '',
    'Delta = candidate - baseline.',
    '',
    'Limitations:',
    ...result.limitations.map(limitation => `- ${limitation}`),
  ];
  return lines.join('\n');
}

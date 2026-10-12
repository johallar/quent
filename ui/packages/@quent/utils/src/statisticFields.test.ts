// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  buildStatisticFieldPresentations,
  flattenStatistics,
  statisticFieldId,
  statisticFieldLabel,
  statisticFieldName,
} from './statisticFields';

describe('statistic fields', () => {
  it('distinguishes nested fields, delimiter-containing names, and repeated siblings', () => {
    const fields = flattenStatistics([
      {
        key: 'Volume',
        value: {
          kind: 'struct',
          fields: [
            { key: 'bytes', value: 1 },
            { key: 'bytes', value: 2 },
          ],
        },
      },
      { key: 'Work', value: { kind: 'struct', fields: [{ key: 'bytes', value: 3 }] } },
      { key: 'Volume › bytes', value: 4 },
      { key: '[["Volume",0],["bytes",0]]', value: 5 },
      { key: 'list', value: [1, 2] },
    ]);
    expect(new Set(fields.map(f => f.id)).size).toBe(5);
    expect(fields.map(f => f.value)).toEqual([1, 2, 3, 4, 5]);
    expect(fields[4].id).toBe('[["Volume",0],["bytes",0]]');
    expect(fields.map(f => statisticFieldName(f))).toEqual([
      'bytes',
      'bytes',
      'bytes',
      'Volume › bytes',
      '[["Volume",0],["bytes",0]]',
    ]);
    expect(fields.slice(0, 3).map(f => statisticFieldLabel(f))).toEqual([
      'Volume › bytes',
      'Volume › bytes [2]',
      'Work › bytes',
    ]);
  });
  it('keeps flat field IDs stable', () => {
    const field = flattenStatistics([{ key: 'bytes', value: 0 }])[0];
    expect(field.id).toBe('bytes');
    expect(field).not.toHaveProperty('key');
  });

  it('resolves selected field IDs while preserving name and empty fallbacks', () => {
    const fields = flattenStatistics([
      { key: 'Volume', value: { kind: 'struct', fields: [{ key: 'bytes', value: 1 }] } },
    ]);
    expect(statisticFieldLabel(fields[0].id)).toBe('Volume › bytes');
    expect(statisticFieldName(fields[0].id, fields)).toBe('bytes');
    expect(statisticFieldName('unknown', fields)).toBe('unknown');
    expect(statisticFieldName(null, fields)).toBe('');
  });

  it('distinguishes literal path separators from nested paths in labels', () => {
    const fields = flattenStatistics([
      { key: 'Volume', value: { kind: 'struct', fields: [{ key: 'bytes', value: 1 }] } },
      { key: 'Volume › bytes', value: 2 },
    ]);
    expect(fields.map(statisticFieldLabel)).toEqual(['Volume › bytes', '"Volume › bytes"']);
  });

  it('builds full-path labels and titles while retaining leaf names', () => {
    const fields = flattenStatistics([
      { key: 'Input', value: { kind: 'struct', fields: [{ key: 'rows', value: 1 }] } },
      { key: 'Output', value: { kind: 'struct', fields: [{ key: 'rows', value: 2 }] } },
      { key: 'rows', value: 3 },
    ]);
    const presentations = buildStatisticFieldPresentations(fields);
    expect(fields.map(field => presentations.get(field.id))).toEqual([
      { fieldName: 'rows', label: 'Input › rows', title: 'Input › rows' },
      { fieldName: 'rows', label: 'Output › rows', title: 'Output › rows' },
      { fieldName: 'rows', label: 'rows', title: 'rows' },
    ]);
  });

  it('retains long field names and explicit structured paths', () => {
    const name = 'very long producer name '.repeat(100);
    const fields = flattenStatistics([
      { key: name, value: 1 },
      { key: name, value: { kind: 'struct', fields: [{ key: name, value: 2 }] } },
    ]);
    expect(fields.map(statisticFieldName)).toEqual([name, name]);
    expect(fields[1].path).toEqual([
      [name, 1],
      [name, 0],
    ]);
    expect(fields[1].id).toBe(statisticFieldId(fields[1].path));
  });

  it('keeps nested identities stable when values or unrelated sibling order change', () => {
    const first = flattenStatistics([
      { key: 'Volume', value: { kind: 'struct', fields: [{ key: 'bytes', value: 1 }] } },
    ])[0];
    const second = flattenStatistics([
      { key: 'other', value: 5 },
      { key: 'Volume', value: { kind: 'struct', fields: [{ key: 'bytes', value: 99 }] } },
    ])[1];
    expect(first.id).toBe(second.id);
    expect(first.id).toBe(
      statisticFieldId([
        ['Volume', 0],
        ['bytes', 0],
      ])
    );
  });

  it('distinguishes occurrence suffixes and reserved IDs from literal producer names', () => {
    const repeated = flattenStatistics([
      { key: 'bytes', value: 1 },
      { key: 'bytes', value: 2 },
    ]);
    const fields = flattenStatistics([
      { key: 'bytes', value: 1 },
      { key: 'bytes', value: 2 },
      { key: 'bytes [2]', value: 3 },
      { key: repeated[1].id, value: 4 },
    ]);
    expect(new Set(fields.map(field => field.id)).size).toBe(4);
    expect(new Set(fields.map(statisticFieldLabel)).size).toBe(4);
  });
});

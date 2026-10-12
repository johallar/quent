// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { projectStatisticScalarFields, statisticFieldLabel, type Statistic } from '@quent/utils';
import {
  createDeepLinkStatisticRegistries,
  createStatisticFieldRegistry,
  persistStatisticReference,
  resolveDeepLinkStatisticReferences,
  resolveStatisticReference,
} from './deepLink.statisticRefs';
import { MAX_STATISTIC_PATH_SEGMENT_LENGTH } from './deepLink.schema';

const operatorStatistics: Statistic[] = [
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
  { key: 'Volume › bytes', value: 3 },
  { key: 'Input', value: { kind: 'struct', fields: [{ key: 'rows', value: 4 }] } },
  { key: 'Output', value: { kind: 'struct', fields: [{ key: 'rows', value: 5 }] } },
];

const portStatistics: Statistic[] = [
  { key: 'bytes', value: 10 },
  { key: 'rows', value: 20 },
];

describe('deep-link statistic references', () => {
  it('round-trips repeated siblings and separator literals by structured path', () => {
    const fields = projectStatisticScalarFields(operatorStatistics);
    const registry = createStatisticFieldRegistry(fields);

    for (const field of fields) {
      const persisted = persistStatisticReference(registry, field.id);
      expect(persisted).toEqual(field.path);
      expect(resolveStatisticReference(registry, persisted!)).toBe(field.id);
    }
    expect(fields[1].path).toEqual([
      ['Volume', 0],
      ['bytes', 1],
    ]);
    expect(fields[2].path).toEqual([['Volume › bytes', 0]]);
  });

  it('resolves current, raw encoded, hashed, and display-label legacy values', () => {
    const fields = projectStatisticScalarFields(operatorStatistics);
    const nested = fields[1];
    const registry = createStatisticFieldRegistry(fields);
    const hashed = [...registry.legacyAliases.keys()].find(alias =>
      alias.startsWith('__quent_stat_')
    );

    expect(resolveStatisticReference(registry, nested.id)).toBe(nested.id);
    expect(resolveStatisticReference(registry, JSON.stringify(nested.path))).toBe(nested.id);
    expect(resolveStatisticReference(registry, statisticFieldLabel(nested))).toBe(nested.id);
    expect(resolveStatisticReference(registry, hashed!)).toBe(fields[0].id);
  });

  it('prefers an exact current ID and drops ambiguous, unknown, or malformed legacy values', () => {
    const fields = projectStatisticScalarFields(operatorStatistics);
    const registry = createStatisticFieldRegistry(fields);
    const literalSeparator = fields[2];

    expect(resolveStatisticReference(registry, 'Volume › bytes')).toBe(literalSeparator.id);
    expect(resolveStatisticReference(registry, 'rows')).toBeUndefined();
    expect(resolveStatisticReference(registry, 'unknown')).toBeUndefined();
    expect(resolveStatisticReference(registry, '[["Volume",0],')).toBeUndefined();
  });

  it('drops current fields whose paths exceed v4 bounds', () => {
    const field = projectStatisticScalarFields([
      { key: 'x'.repeat(MAX_STATISTIC_PATH_SEGMENT_LENGTH + 1), value: 1 },
    ])[0];
    const registry = createStatisticFieldRegistry([field]);

    expect(persistStatisticReference(registry, field.id)).toBeUndefined();
  });

  it('uses separate operator and port registries and adds duration only to table fields', () => {
    const operatorFields = projectStatisticScalarFields(operatorStatistics);
    const portFields = projectStatisticScalarFields(portStatistics);
    const registries = createDeepLinkStatisticRegistries(operatorFields, portFields);
    const resolved = resolveDeepLinkStatisticReferences(
      {
        nodeColorField: [
          ['Input', 0],
          ['rows', 0],
        ],
        edgeWidthField: [['bytes', 0]],
        edgeColorField: [
          ['Input', 0],
          ['rows', 0],
        ],
      },
      {
        visibleStats: [
          [['duration_s', 0]],
          [
            ['Output', 0],
            ['rows', 0],
          ],
          [['missing', 0]],
        ],
        sort: [
          { id: [['duration_s', 0]], desc: true },
          { id: [['missing', 0]], desc: false },
        ],
      },
      registries
    );

    expect(resolved.dag).toEqual({
      nodeColorField: operatorFields[3].id,
      edgeWidthField: portFields[0].id,
    });
    expect(resolved.operatorTable).toEqual({
      visibleStats: ['duration_s', operatorFields[4].id],
      sort: [{ id: 'duration_s', desc: true }],
    });
    expect(resolveStatisticReference(registries.operator, [['duration_s', 0]])).toBeUndefined();
    expect(
      resolveStatisticReference(registries.port, [
        ['Input', 0],
        ['rows', 0],
      ])
    ).toBeUndefined();
  });
});

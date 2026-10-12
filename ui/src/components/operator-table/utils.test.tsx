// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { PivotedStatTable, type PivotedStatTableSchema } from '@quent/components';
import {
  buildStatisticFieldPresentations,
  projectStatisticScalarFields,
  statisticFieldId,
  unwrapTaggedValue,
  type Operator,
  type NormalizedQueryEntities,
  type QuantitySpec,
  type Statistic,
} from '@quent/utils';
import { buildOperatorRows } from './utils';
import type { OperatorTableRow } from './types';

function normalizeStatistics(rawStatistics: NonNullable<Operator['statistics']>) {
  const statistics: Statistic[] = rawStatistics.custom_statistics.map(
    ({ value: { key, value }, quantity }) => ({
      key,
      value: unwrapTaggedValue(value),
      ...(quantity !== null ? { quantity } : {}),
    })
  );
  return {
    ...rawStatistics,
    statistics,
    fields: projectStatisticScalarFields(statistics),
  };
}

function makeEntities(rawStatistics: NonNullable<Operator['statistics']>): NormalizedQueryEntities {
  return {
    engine: {
      id: 'engine',
      start_time_unix_ns: null,
      duration_s: null,
      instance_name: null,
      implementation: null,
      custom_attributes: [],
    },
    query: {
      id: 'query',
      instance_name: null,
      custom_attributes: [],
      attributes: [],
      start_unix_ns: null,
      planning_s: null,
      executing_s: null,
      completed_s: null,
    },
    plans: {
      plan: { id: 'plan', instance_name: null, parent: null, worker_id: null, edges: [] },
    },
    operators: {
      scan: {
        id: 'scan',
        plan_id: 'plan',
        parent_operator_ids: [],
        instance_name: 'Scan',
        operator_type_name: 'Scan',
        custom_attributes: [],
        attributes: [],
        active_span: { start: 1, end: 3 },
        statistics: normalizeStatistics(rawStatistics),
      },
    },
    workers: {},
    ports: {},
    resources: {},
    resource_groups: {},
    resource_types: {},
    resource_group_types: {},
    fsm_types: {},
  };
}

const schema: PivotedStatTableSchema<OperatorTableRow> = {
  groups: { item: { id: row => row.itemId, label: row => row.itemName } },
  itemId: row => row.itemId,
  scopeId: row => row.scopeId,
  itemType: row => row.itemType,
  stats: row => row.stats,
};

const quantitySpecs: Record<string, QuantitySpec> = {
  bytes: {
    symbol: 'B',
    singular: 'byte',
    plural: 'bytes',
    occupancy_prefix: 'Iec',
    rate_prefix: 'Si',
  },
  seconds: {
    symbol: 's',
    singular: 'second',
    plural: 'seconds',
    occupancy_prefix: 'None',
    rate_prefix: 'None',
  },
};

function renderRows(rows: OperatorTableRow[], isAggregating = false, activeIndices = ['item']) {
  const statMetadata = buildStatisticFieldPresentations(rows.flatMap(row => row.stats));
  const statisticFields = new Map(
    rows.flatMap(row => row.stats).map(field => [field.id, field] as const)
  );
  render(
    <Provider store={createStore()}>
      <PivotedStatTable
        rows={rows}
        schema={schema}
        activeIndices={activeIndices}
        isAggregating={isAggregating}
        renderConfig={{
          getStatLabel: stat => statMetadata.get(stat)?.label ?? stat,
          getStatTitle: stat => statMetadata.get(stat)?.title ?? stat,
          statisticFields,
          quantitySpecs,
        }}
        interaction={{
          hoveredStat: null,
          setHoveredStat: vi.fn(),
          hoveredItemId: null,
          selectedItemIds: new Set(),
        }}
      />
    </Provider>
  );
}

const structuredStatistics = {
  custom_statistics: [
    {
      value: {
        key: 'Execution profile',
        value: {
          Struct: [
            {
              key: 'Data volume',
              value: {
                Struct: [
                  {
                    key: 'Input',
                    value: { Struct: [{ key: 'batches', value: { U32: 5 } }] },
                  },
                ],
              },
            },
          ],
        },
      },
      quantity: null,
    },
    {
      value: {
        key: 'device',
        value: {
          Struct: [
            { key: 'name', value: { String: 'GPU' } },
            { key: 'count', value: { U32: 0 } },
            { key: 'count', value: { U32: 3 } },
            {
              key: 'details',
              value: { Struct: [{ key: 'bytes', value: { U64: 2048n } }] },
            },
          ],
        },
      },
      quantity: null,
    },
    {
      value: {
        key: 'devices',
        value: {
          List: {
            Struct: [
              [{ key: 'name', value: { String: 'GPU' } }],
              [{ key: 'name', value: { List: { String: ['CPU', 'Disk'] } } }],
            ],
          },
        },
      },
      quantity: null,
    },
    { value: { key: 'rows', value: { U32: 0 } }, quantity: null },
    { value: { key: 'rows', value: { U32: 7 } }, quantity: null },
    { value: { key: 'batches', value: { U32: 6 } }, quantity: null },
    { value: { key: 'input_bytes', value: { U32: 1024 } }, quantity: 'bytes' },
  ],
} satisfies NonNullable<Operator['statistics']>;

describe('operator table structured statistics', () => {
  it('renders scalar leaves instead of parent structs through the real pivot table', () => {
    const rows = buildOperatorRows(makeEntities(structuredStatistics), new Set(['plan']));
    renderRows(rows);

    expect(
      screen.getByRole('columnheader', {
        name: 'Execution profile › Data volume › Input › batches',
      })
    ).toBeInTheDocument();
    expect(
      screen.getByTitle('Execution profile › Data volume › Input › batches')
    ).toHaveTextContent('Execution profile › Data volume › Input › batches');
    expect(screen.getByRole('columnheader', { name: 'batches' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Execution profile' })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'device › name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'device › count' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'device › count [2]' })).toBeInTheDocument();
    expect(
      screen.getByRole('columnheader', { name: 'device › details › bytes' })
    ).toBeInTheDocument();
    expect(screen.getByTitle('device › details › bytes')).toHaveTextContent(
      'device › details › bytes'
    );
    expect(screen.queryByRole('columnheader', { name: 'device' })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'devices' })).not.toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'GPU' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2.00 KiB' })).toBeInTheDocument();
    expect(rows[0].stats).toContainEqual(
      expect.objectContaining({ id: 'input_bytes', value: 1024, quantity: 'bytes' })
    );
  });

  it('aggregates each scalar leaf independently', () => {
    const rows = buildOperatorRows(makeEntities(structuredStatistics), new Set(['plan']));
    renderRows(rows, true);

    expect(screen.getByRole('cell', { name: '1.00 KiB' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '7.00' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'rows' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'rows [2]' })).toBeInTheDocument();
  });

  it('inherits a struct quantity for scalar columns and omits nested lists', () => {
    const rows = buildOperatorRows(
      makeEntities({
        custom_statistics: [
          {
            value: {
              key: 'Profile',
              value: {
                Struct: [
                  { key: 'bytes', value: { U64: 2048n } },
                  { key: 'samples', value: { List: { U32: [1, 2] } } },
                ],
              },
            },
            quantity: 'bytes',
          },
        ],
      }),
      new Set(['plan'])
    );
    renderRows(rows);

    expect(rows[0].stats.slice(1)).toEqual([
      {
        id: statisticFieldId([
          ['Profile', 0],
          ['bytes', 0],
        ]),
        path: [
          ['Profile', 0],
          ['bytes', 0],
        ],
        value: 2048n,
        quantity: 'bytes',
      },
    ]);
    expect(screen.getByRole('columnheader', { name: 'Profile › bytes' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2.00 KiB' })).toBeInTheDocument();
    expect(
      screen.queryByRole('columnheader', { name: 'Profile › samples' })
    ).not.toBeInTheDocument();
  });

  it('retains repeated scalar leaves with their own quantities and omits lists', () => {
    const rows = buildOperatorRows(
      makeEntities({
        custom_statistics: [
          { value: { key: 'work', value: { U64: 1024n } }, quantity: 'bytes' },
          { value: { key: 'work', value: { U32: 2 } }, quantity: 'seconds' },
          {
            value: { key: 'sizes', value: { List: { U64: [1024n, 2048n] } } },
            quantity: 'bytes',
          },
        ],
      }),
      new Set(['plan'])
    );
    renderRows(rows);

    expect(rows[0].stats.slice(1)).toMatchObject([
      { id: 'work', value: 1024n, quantity: 'bytes' },
      { id: statisticFieldId([['work', 1]]), value: 2, quantity: 'seconds' },
    ]);
    expect(rows[0].stats.some(stat => stat.id === 'sizes')).toBe(false);
    expect(screen.getByRole('cell', { name: '1.00 KiB' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: '2.00 s' })).toBeInTheDocument();
  });

  it.each([
    ['bytes', 'bytes', '2.00 KiB'],
    ['bytes', 'seconds', '-'],
  ])('aggregates quantities %s and %s as %s', (first, second, expected) => {
    const entities = makeEntities({
      custom_statistics: [{ value: { key: 'work', value: { U32: 1024 } }, quantity: first }],
    });
    entities.operators.other = {
      ...entities.operators.scan,
      id: 'other',
      statistics: normalizeStatistics({
        custom_statistics: [{ value: { key: 'work', value: { U32: 1024 } }, quantity: second }],
      }),
    };
    renderRows(buildOperatorRows(entities, new Set(['plan'])), true, []);
    expect(screen.getByRole('cell', { name: expected })).toBeInTheDocument();
  });
});

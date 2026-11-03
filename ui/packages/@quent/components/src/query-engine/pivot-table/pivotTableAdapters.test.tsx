// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SCALE_TYPE } from '@quent/utils';
import { PivotedStatTable } from './PivotedStatTable';
import { PivotTableToolbar } from './PivotTableToolbar';
import type { PivotedStatTableSchema } from '../../quent-views/pivot-table/types';

const captured = vi.hoisted(() => ({
  tableProps: null as Record<string, unknown> | null,
  toolbarProps: null as Record<string, unknown> | null,
  dragDropOptions: [] as Array<{
    onDropCommit: (from: string, to: string, position: 'before' | 'after') => void;
  }>,
}));

vi.mock('@quent/hooks', () => ({
  useNodeColorPalette: () => ['teal'],
  useSelectedScaleType: () => [SCALE_TYPE.LOG],
  useColumnDragDrop: (options: (typeof captured.dragDropOptions)[number]) => {
    captured.dragDropOptions.push(options);
    return {
      draggedId: null,
      getDropTargetPosition: () => undefined,
      handleDragStart: () => undefined,
      handleDragOver: () => undefined,
      handleDragLeave: () => undefined,
      handleDrop: () => undefined,
      handleDragEnd: () => undefined,
    };
  },
}));

vi.mock('../../quent-views/pivot-table/PivotedStatTableView', () => ({
  PivotedStatTableView: (props: Record<string, unknown>) => {
    captured.tableProps = props;
    return <div>table view</div>;
  },
}));

vi.mock('../../quent-views/pivot-table/PivotTableToolbarView', () => ({
  PivotTableToolbarView: (props: Record<string, unknown>) => {
    captured.toolbarProps = props;
    return <div>toolbar view</div>;
  },
}));

interface Row {
  id: string;
  value: number;
}

const schema: PivotedStatTableSchema<Row> = {
  groups: { item: { id: row => row.id } },
  itemId: row => row.id,
  scopeId: row => row.id,
  stats: row => [{ key: 'value', value: row.value }],
};

describe('pivot table query-engine adapters', () => {
  beforeEach(() => {
    captured.tableProps = null;
    captured.toolbarProps = null;
    captured.dragDropOptions.length = 0;
  });

  it('adapts hook palette, scale, and drag state into the controlled table view', () => {
    render(
      <PivotedStatTable
        rows={[{ id: 'scan', value: 4 }]}
        schema={schema}
        activeIndices={['item']}
        interaction={{ hoveredStat: null, setHoveredStat: () => undefined }}
        isDark
      />
    );

    expect(captured.tableProps?.display).toEqual({
      isAggregating: false,
      aggMode: 'sum',
      colorPalette: 'teal',
      scaleType: SCALE_TYPE.LOG,
      darkMode: true,
    });
    expect(captured.tableProps?.dragDrop).toEqual(
      expect.objectContaining({ draggedId: null, onDragStart: expect.any(Function) })
    );
  });

  it('adapts toolbar drag/drop into the legacy reorder action', () => {
    const onReorderIndex = vi.fn();
    render(
      <PivotTableToolbar
        indexConfig={[
          { key: 'worker', label: 'Worker', enabled: true },
          { key: 'item', label: 'Item', enabled: true },
        ]}
        isAggregating={false}
        aggMode="sum"
        orderedStats={['value']}
        selectedStats={null}
        onToggleIndex={() => undefined}
        onReorderIndex={onReorderIndex}
        onSetAggMode={() => undefined}
        onToggleStat={() => undefined}
        onSelectAllStats={() => undefined}
        onSelectNoStats={() => undefined}
      />
    );

    captured.dragDropOptions[0]?.onDropCommit('worker', 'item', 'after');
    expect(onReorderIndex).toHaveBeenCalledWith('worker', 'item');
    expect(captured.toolbarProps?.dragDrop).toEqual(
      expect.objectContaining({ draggedId: null, onDrop: expect.any(Function) })
    );
  });
});

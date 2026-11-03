// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PivotedStatTableView } from './PivotedStatTableView';
import type { PivotedStatTableSchema, PivotTableDnDConfig } from './types';

interface Row {
  id: string;
  label: string;
  duration: number;
}

const schema: PivotedStatTableSchema<Row> = {
  groups: { item: { id: row => row.id, label: row => row.label } },
  itemId: row => row.id,
  scopeId: row => row.id,
  stats: row => [{ key: 'duration', value: row.duration }],
};

const dragDrop: PivotTableDnDConfig = {
  draggedId: null,
  getDropTargetPosition: () => undefined,
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragLeave: () => undefined,
  onDrop: () => undefined,
  onDragEnd: () => undefined,
};

describe('PivotedStatTableView', () => {
  it('renders controlled data and hover actions without Quent providers', () => {
    const setHoveredStat = vi.fn();
    render(
      <PivotedStatTableView
        rows={[{ id: 'scan-1', label: 'Scan', duration: 12 }]}
        schema={schema}
        activeIndices={['item']}
        visibleStats={['duration']}
        display={{
          isAggregating: false,
          aggMode: 'sum',
          colorPalette: 'blue',
          scaleType: 'linear',
          darkMode: false,
        }}
        dragDrop={dragDrop}
        interaction={{
          hoveredStat: null,
          setHoveredStat,
          hoveredItemId: null,
          selectedItemIds: new Set(),
        }}
      />
    );

    expect(screen.getByText('Scan')).toBeVisible();
    expect(screen.getByText('12')).toBeVisible();
    fireEvent.mouseEnter(screen.getByRole('columnheader', { name: 'duration' }));
    expect(setHoveredStat).toHaveBeenCalledWith({
      name: 'duration',
      values: new Map([['scan-1', 12]]),
      min: 12,
      max: 12,
      aggMode: 'sum',
    });
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PivotTableToolbarView } from './PivotTableToolbarView';
import type { PivotTableDragDropConfig } from './types';

const dragDrop: PivotTableDragDropConfig<HTMLButtonElement> = {
  draggedId: null,
  getDropTargetPosition: () => undefined,
  onDragStart: () => undefined,
  onDragOver: () => undefined,
  onDragLeave: () => undefined,
  onDrop: () => undefined,
  onDragEnd: () => undefined,
};

describe('PivotTableToolbarView', () => {
  it('forwards controlled actions without Quent providers', async () => {
    const onToggleIndex = vi.fn();
    const user = userEvent.setup();
    render(
      <PivotTableToolbarView
        indexConfig={[{ key: 'item', label: 'Operator', enabled: true }]}
        isAggregating={false}
        aggMode="sum"
        orderedStats={['duration']}
        selectedStats={null}
        onToggleIndex={onToggleIndex}
        onSetAggMode={() => undefined}
        onToggleStat={() => undefined}
        onSelectAllStats={() => undefined}
        onSelectNoStats={() => undefined}
        dragDrop={dragDrop}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Operator' }));
    expect(onToggleIndex).toHaveBeenCalledWith('item');
    expect(screen.getByRole('combobox', { name: 'Columns' })).toBeVisible();
  });
});

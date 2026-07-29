// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { render, screen, userEvent } from '@/test/test-utils';
import { ResourceChartMenu } from './ResourceChartMenu';
import { ResourceChartGlobalMenu } from './ResourceChartGlobalMenu';

describe('ResourceChartMenu', () => {
  it('shows selected count and toggles charts without selecting the tree row', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    const onParentClick = vi.fn();

    render(
      <div onClick={onParentClick}>
        <ResourceChartMenu
          resourceLabel="worker-1"
          availableCharts={['operators', 'entities']}
          selectedCharts={['operators']}
          onSelectionChange={onSelectionChange}
        />
      </div>
    );

    const trigger = screen.getByRole('button', { name: 'Choose charts for worker-1' });
    expect(trigger).toHaveTextContent('1');
    expect(trigger).toHaveClass('cursor-pointer');

    await user.click(trigger);
    expect(onParentClick).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitemcheckbox', { name: 'Operators' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await user.click(screen.getByRole('menuitemcheckbox', { name: 'Entities' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['operators', 'entities']);
    expect(screen.getByRole('menuitemcheckbox', { name: 'Operators' })).toBeInTheDocument();
  });
});

describe('ResourceChartGlobalMenu', () => {
  it('exposes mixed state and applies per-type bulk changes', async () => {
    const user = userEvent.setup();
    const onToggleChart = vi.fn();

    render(
      <ResourceChartGlobalMenu
        availableCharts={['operators', 'entities']}
        chartStates={{ operators: 'mixed', entities: 'all' }}
        onToggleChart={onToggleChart}
        onShowAll={vi.fn()}
        onHideAll={vi.fn()}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Charts on all resource rows' });
    expect(trigger).toHaveClass('cursor-pointer');
    await user.click(trigger);

    const operators = screen.getByRole('menuitemcheckbox', { name: 'Operators' });
    const entities = screen.getByRole('menuitemcheckbox', { name: 'Entities' });
    expect(operators).toHaveAttribute('aria-checked', 'mixed');
    expect(entities).toHaveAttribute('aria-checked', 'true');

    await user.click(operators);
    expect(onToggleChart).toHaveBeenCalledWith('operators', true);

    await user.click(entities);
    expect(onToggleChart).toHaveBeenCalledWith('entities', false);
  });

  it('provides show-all and hide-all actions', async () => {
    const user = userEvent.setup();
    const onShowAll = vi.fn();
    const onHideAll = vi.fn();

    render(
      <ResourceChartGlobalMenu
        availableCharts={['entities']}
        chartStates={{ operators: 'none', entities: 'none' }}
        onToggleChart={vi.fn()}
        onShowAll={onShowAll}
        onHideAll={onHideAll}
      />
    );

    const trigger = screen.getByRole('button', { name: 'Charts on all resource rows' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Show all' }));
    expect(onShowAll).toHaveBeenCalledOnce();

    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: 'Hide all' }));
    expect(onHideAll).toHaveBeenCalledOnce();
  });
});

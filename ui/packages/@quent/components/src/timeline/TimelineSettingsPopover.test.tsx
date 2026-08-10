// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimelineSettingsPopover } from './TimelineSettingsPopover';

const mocks = vi.hoisted(() => ({
  density: 'balanced' as 'less' | 'balanced' | 'more',
  setDensity: vi.fn(),
}));

vi.mock('@quent/hooks', () => ({
  useLongEntityDensity: () => mocks.density,
  useSetLongEntityDensity: () => mocks.setDensity,
}));

vi.mock('../ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('TimelineSettingsPopover', () => {
  beforeEach(() => {
    mocks.density = 'balanced';
    mocks.setDensity.mockClear();
  });

  it('renders the three entity density snap points', () => {
    render(<TimelineSettingsPopover />);

    const slider = screen.getByRole('slider', { name: 'Entities' });
    expect(slider).toHaveAttribute('min', '0');
    expect(slider).toHaveAttribute('max', '2');
    expect(slider).toHaveAttribute('step', '1');
    expect(slider).toHaveValue('1');
    expect(screen.getByText('Less')).toBeInTheDocument();
    expect(screen.getByText('Balanced')).toBeInTheDocument();
    expect(screen.getByText('More')).toBeInTheDocument();
  });

  it('updates the density when the slider moves', () => {
    render(<TimelineSettingsPopover />);

    fireEvent.change(screen.getByRole('slider', { name: 'Entities' }), {
      target: { value: '2' },
    });

    expect(mocks.setDensity).toHaveBeenCalledWith('more');
  });
});

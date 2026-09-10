// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DAGSettingsPopover } from './DAGSettingsPopover';

const mocks = vi.hoisted(() => ({
  dagControls: vi.fn(),
}));

vi.mock('./DAGControls', () => ({
  DAGControls: (props: {
    operatorStatFields: string[];
    portStatFields: string[];
    isDark: boolean;
  }) => {
    mocks.dagControls(props);
    return <div>DAG controls</div>;
  },
}));

vi.mock('../ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

describe('DAGSettingsPopover', () => {
  it('renders an accessible gear trigger and the existing DAG controls', () => {
    render(
      <DAGSettingsPopover operatorStatFields={['duration']} portStatFields={['rows']} isDark />
    );

    expect(screen.getByRole('button', { name: 'DAG settings' })).toHaveAttribute(
      'title',
      'DAG settings'
    );
    expect(screen.getByText('DAG controls')).toBeInTheDocument();
    expect(mocks.dagControls).toHaveBeenCalledWith({
      operatorStatFields: ['duration'],
      portStatFields: ['rows'],
      isDark: true,
    });
  });
});

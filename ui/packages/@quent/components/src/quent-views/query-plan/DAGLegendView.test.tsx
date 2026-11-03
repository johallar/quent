// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DAGLegendView } from './DAGLegendView';

vi.mock('@xyflow/react', () => ({
  Panel: ({ children }: { children: ReactNode }) => <aside>{children}</aside>,
}));

describe('DAGLegendView', () => {
  it('renders preformatted continuous and categorical sections without providers', () => {
    render(
      <DAGLegendView
        sections={[
          {
            kind: 'continuous',
            id: 'rows',
            label: 'Rows',
            min: 1,
            max: 10,
            gradientStops: ['#000', '#fff'],
            formatValue: value => `${value} rows`,
            scaleLabel: 'Log',
          },
          {
            kind: 'categorical',
            id: 'state',
            label: 'State',
            categoryMap: new Map([['Running', '#0f0']]),
            entrySuffixes: new Map([['Running', '12']]),
          },
        ]}
      />
    );

    expect(screen.getByText('Rows')).toBeVisible();
    expect(screen.getByText('1 rows')).toBeVisible();
    expect(screen.getByText('10 rows')).toBeVisible();
    expect(screen.getByText('Log')).toBeVisible();
    expect(screen.getByText('State')).toBeVisible();
    expect(screen.getByText('Running')).toBeVisible();
    expect(screen.getByTestId('legend-entry-total')).toHaveTextContent('12');
  });
});

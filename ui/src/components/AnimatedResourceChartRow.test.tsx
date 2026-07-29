// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AnimatedResourceChartRow } from './AnimatedResourceChartRow';

describe('AnimatedResourceChartRow', () => {
  it('uses accordion animations when its expanded state changes', () => {
    const { rerender } = render(
      <AnimatedResourceChartRow expanded>
        <div>Chart</div>
      </AnimatedResourceChartRow>
    );

    const content = screen.getByText('Chart').parentElement;
    expect(content).toHaveAttribute('data-state', 'open');
    expect(content).toHaveClass('data-[state=open]:animate-chart-row-down');

    rerender(
      <AnimatedResourceChartRow expanded={false}>
        <div>Chart</div>
      </AnimatedResourceChartRow>
    );

    expect(content).toHaveAttribute('data-state', 'closed');
    expect(content).toHaveClass('data-[state=closed]:animate-chart-row-up');
    expect(content).toHaveAttribute('aria-hidden', 'true');
  });
});

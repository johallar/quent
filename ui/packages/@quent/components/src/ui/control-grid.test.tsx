// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ControlField, ControlGrid, ControlSection } from './control-grid';

describe('ControlGrid', () => {
  it('uses the requested column count', () => {
    render(
      <ControlGrid columns={3} data-testid="control-grid">
        <div />
      </ControlGrid>
    );

    expect(screen.getByTestId('control-grid')).toHaveStyle({
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    });
  });

  it('composes sections and labeled fields', () => {
    render(
      <ControlSection title="Display">
        <ControlGrid>
          <ControlField label="Name">
            <input aria-label="Name value" />
          </ControlField>
        </ControlGrid>
      </ControlSection>
    );

    expect(screen.getByRole('heading', { name: 'Display' })).toBeVisible();
    expect(screen.getByText('Name')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Name value' })).toBeVisible();
  });
});

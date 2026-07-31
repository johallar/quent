// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Provider } from 'jotai';
import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimelineToolbar } from './TimelineToolbar';

describe('TimelineToolbar long-entity threshold', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('switches between manual and auto thresholds', async () => {
    const user = userEvent.setup();
    render(
      <Provider>
        <TimelineToolbar durationSeconds={200} />
      </Provider>
    );

    await user.click(screen.getByTitle('Timeline settings'));

    const auto = screen.getByLabelText('Auto long entities threshold');
    const numberInput = screen.getByLabelText('Long entities threshold');
    const slider = screen.getByRole('slider', {
      name: 'Long entities threshold in seconds',
    });

    expect(auto).not.toBeChecked();
    expect(numberInput).toHaveValue(60);
    expect(slider).toHaveValue('60');
    expect(screen.getByText('Effective threshold: 60 s.')).toBeInTheDocument();

    await user.click(auto);

    expect(numberInput).toBeDisabled();
    expect(slider).toBeDisabled();
    expect(screen.getByText('Effective threshold: 30 s at the current zoom.')).toBeInTheDocument();
    expect(localStorage.getItem('quent-long-entity-threshold-auto')).toBe('true');

    await user.click(auto);
    fireEvent.change(numberInput, { target: { value: '75' } });

    expect(numberInput).toHaveValue(75);
    expect(slider).toHaveValue('75');
    expect(screen.getByText('Effective threshold: 75 s.')).toBeInTheDocument();
    expect(localStorage.getItem('quent-long-entity-threshold-seconds')).toBe('75');
  });
});

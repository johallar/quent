// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlayheadLine } from './PlayheadLine';

const mocks = vi.hoisted(() => ({ isPlaying: false }));

vi.mock('@quent/hooks', () => ({
  useDataFlowIsPlaying: () => mocks.isPlaying,
}));

vi.mock('../lib/usePlayheadLinePixel', () => ({
  usePlayheadLinePixel: () => 24,
}));

describe('PlayheadLine', () => {
  afterEach(() => {
    mocks.isPlaying = false;
  });

  it('only transitions position during data-flow playback', () => {
    const { container, rerender } = render(<PlayheadLine instance={null} />);
    expect(container.firstElementChild).not.toHaveClass('transition-[left]');

    mocks.isPlaying = true;
    rerender(<PlayheadLine instance={null} />);

    expect(container.firstElementChild).toHaveClass(
      'transition-[left]',
      'duration-100',
      'ease-linear'
    );
  });
});

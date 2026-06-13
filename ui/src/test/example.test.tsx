// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { screen, renderWithQuery } from './test-utils';

/**
 * Example test to verify the testing setup works correctly.
 * Delete this file once you've confirmed the setup is working.
 */
describe('Test Setup', () => {
  it('should render a component with QueryClient provider', () => {
    renderWithQuery(<div data-testid="test-element">Hello World</div>);

    expect(screen.getByTestId('test-element')).toBeInTheDocument();
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('should have MSW handlers registered', async () => {
    const response = await fetch('/api/engines');
    const data = (await response.json()) as Array<{ id: string }>;

    expect(response.ok).toBe(true);
    expect(data.map(e => e.id)).toEqual(['engine-a', 'engine-b']);
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { UsageColumnView } from './UsageColumnView';

describe('UsageColumnView', () => {
  it('renders injected timeline content without providers', () => {
    render(<UsageColumnView timeline={<span>Timeline content</span>} />);
    expect(screen.getByText('Timeline content')).toBeInTheDocument();
  });

  it('keeps cell clicks from reaching the table row', async () => {
    const onRowClick = vi.fn();
    const user = userEvent.setup();
    render(
      <div onClick={onRowClick}>
        <UsageColumnView timeline={<button type="button">Timeline action</button>} />
      </div>
    );

    await user.click(screen.getByRole('button', { name: 'Timeline action' }));
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

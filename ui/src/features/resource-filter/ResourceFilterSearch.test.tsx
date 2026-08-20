// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ResourceFilterSearch } from './ResourceFilterSearch';

describe('ResourceFilterSearch', () => {
  it('updates and clears the query', async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();
    const { rerender } = render(
      <ResourceFilterSearch
        errors={[]}
        fsmTypes={['task']}
        matchCount={2}
        onQueryChange={onQueryChange}
        query=""
        resourceTypes={['gpu']}
      />
    );

    await user.type(screen.getByRole('combobox', { name: 'Filter resources' }), 'id:gpu-0');
    expect(onQueryChange).toHaveBeenCalled();

    rerender(
      <ResourceFilterSearch
        errors={[]}
        fsmTypes={['task']}
        matchCount={1}
        onQueryChange={onQueryChange}
        query="id:gpu-0"
        resourceTypes={['gpu']}
      />
    );
    expect(screen.getByText('1 match')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear resource filter' }));
    expect(onQueryChange).toHaveBeenLastCalledWith('');
  });

  it('offers known type and FSM suggestions and reports parse errors', () => {
    const { container } = render(
      <ResourceFilterSearch
        errors={['Unknown qualifier "wat"']}
        fsmTypes={['task']}
        matchCount={0}
        onQueryChange={vi.fn()}
        query="wat:value"
        resourceTypes={['gpu']}
      />
    );

    const suggestions = [...container.querySelectorAll('option')].map(option => option.value);
    expect(suggestions).toContain('type:gpu');
    expect(suggestions).toContain('fsm:task');
    expect(screen.getByText('Unknown qualifier "wat"')).toBeInTheDocument();
  });
});

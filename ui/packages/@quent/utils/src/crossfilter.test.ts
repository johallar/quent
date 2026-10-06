// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  createEmptyCrossfilterDimension,
  getCrossfilterItemIds,
  reduceCrossfilter,
} from './crossfilter';

describe('crossfilter', () => {
  it('combines selections within a dimension', () => {
    const first = reduceCrossfilter(createEmptyCrossfilterDimension(), {
      type: 'add',
      selectionId: 'first-group',
      label: 'First',
      itemIds: ['first', 'shared'],
    });
    const second = reduceCrossfilter(first, {
      type: 'add',
      selectionId: 'second-group',
      label: 'Second',
      itemIds: ['second', 'shared'],
    });

    expect(getCrossfilterItemIds(second)).toEqual(new Set(['first', 'shared', 'second']));
  });

  it('collapses contained selections into their parent group', () => {
    const child = reduceCrossfilter(createEmptyCrossfilterDimension(), {
      type: 'add',
      selectionId: 'child',
      label: 'Child',
      itemIds: ['child'],
    });
    const parent = reduceCrossfilter(child, {
      type: 'add',
      selectionId: 'parent',
      label: 'Parent',
      itemIds: ['parent', 'child'],
    });

    expect([...parent.selections.keys()]).toEqual(['parent']);
    expect(getCrossfilterItemIds(parent)).toEqual(new Set(['parent', 'child']));
  });

  it('replaces and clears a dimension', () => {
    const replaced = reduceCrossfilter(createEmptyCrossfilterDimension(), {
      type: 'replace',
      selections: [
        {
          selectionId: 'one',
          label: 'One',
          itemIds: new Set(['one']),
        },
        {
          selectionId: 'two',
          label: 'Two',
          itemIds: new Set(['two']),
        },
      ],
    });

    expect([...replaced.selections.keys()]).toEqual(['one', 'two']);
    expect(reduceCrossfilter(replaced, { type: 'clear' })).toBe(createEmptyCrossfilterDimension());
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import {
  crossfilterActionAtomFamily,
  crossfilterDimensionAtomFamily,
  crossfilterItemIdsAtomFamily,
} from '../atoms/crossfilter';

describe('crossfilter atoms', () => {
  it('shares a dimension across producers and consumers', () => {
    const store = createStore();
    const selectedIds = store.set(crossfilterActionAtomFamily('operators'), {
      type: 'add',
      selectionId: 'logical',
      label: 'Logical operator',
      itemIds: ['logical', 'physical'],
    });

    expect(selectedIds).toEqual(new Set(['logical', 'physical']));
    expect(store.get(crossfilterItemIdsAtomFamily('operators'))).toEqual(
      new Set(['logical', 'physical'])
    );
    expect(store.get(crossfilterDimensionAtomFamily('operators')).selections.has('logical')).toBe(
      true
    );
  });

  it('isolates actions and values by dimension', () => {
    const store = createStore();
    store.set(crossfilterActionAtomFamily('operators'), {
      type: 'add',
      selectionId: 'operator-1',
      label: 'Operator 1',
      itemIds: ['operator-1'],
    });
    store.set(crossfilterActionAtomFamily('resources'), {
      type: 'add',
      selectionId: 'resource-1',
      label: 'Resource 1',
      itemIds: ['resource-1'],
    });

    store.set(crossfilterActionAtomFamily('operators'), { type: 'clear' });

    expect(store.get(crossfilterItemIdsAtomFamily('operators'))).toEqual(new Set());
    expect(store.get(crossfilterItemIdsAtomFamily('resources'))).toEqual(new Set(['resource-1']));
  });
});

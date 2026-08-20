// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  addOperatorSelection,
  createEmptyOperatorSelectionState,
  getActiveOperatorLabel,
  getSelectedOperatorIds,
  removeOperatorSelection,
} from './operatorSelection';

describe('operator selection', () => {
  it('adds multiple selections without replacing the existing selection', () => {
    const first = addOperatorSelection(
      createEmptyOperatorSelectionState(),
      'logical-1',
      'Logical 1',
      ['logical-1', 'physical-1']
    );
    const second = addOperatorSelection(first, 'logical-2', 'Logical 2', [
      'logical-2',
      'physical-2',
    ]);

    expect(getSelectedOperatorIds(second)).toEqual(
      new Set(['logical-1', 'physical-1', 'logical-2', 'physical-2'])
    );
    expect(second.selections.get('logical-1')).toEqual({
      label: 'Logical 1',
      operatorIds: new Set(['logical-1', 'physical-1']),
    });
    expect(second.selections.get('logical-2')).toEqual({
      label: 'Logical 2',
      operatorIds: new Set(['logical-2', 'physical-2']),
    });
    expect(getActiveOperatorLabel(second)).toBe('Logical 2');
  });

  it('removes only the clicked selection and preserves overlapping operators', () => {
    const first = addOperatorSelection(createEmptyOperatorSelectionState(), 'logical-1', 'First', [
      'logical-1',
      'shared',
    ]);
    const state = addOperatorSelection(first, 'logical-2', 'Second', ['logical-2', 'shared']);

    const result = removeOperatorSelection(state, 'logical-1');

    expect(getSelectedOperatorIds(result)).toEqual(new Set(['logical-2', 'shared']));
    expect(result.selections).toEqual(
      new Map([
        [
          'logical-2',
          {
            label: 'Second',
            operatorIds: new Set(['logical-2', 'shared']),
          },
        ],
      ])
    );
  });
});

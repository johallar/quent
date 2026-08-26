// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { operatorSelectionActionAtom, operatorSelectionAtom } from '../atoms/dag';
import { selectedNodesDataAtom } from '../atoms/dagControls';

const scanData = {
  nodeId: 'scan',
  label: 'Scan',
  operationType: 'scan',
  statistics: [],
};

const joinData = {
  nodeId: 'join',
  label: 'Join',
  operationType: 'join',
  statistics: [],
};

describe('operator selection actions', () => {
  it('updates filter and inspection state together', () => {
    const store = createStore();

    const selectedIds = store.set(operatorSelectionActionAtom, {
      type: 'add',
      selectionId: 'scan',
      label: 'Scan',
      operatorIds: ['scan', 'physical-scan'],
      inspectedData: scanData,
    });

    expect(selectedIds).toEqual(new Set(['scan', 'physical-scan']));
    expect(store.get(operatorSelectionAtom).selections.has('scan')).toBe(true);
    expect(store.get(selectedNodesDataAtom)).toEqual(new Map([['scan', scanData]]));

    store.set(operatorSelectionActionAtom, { type: 'remove', selectionId: 'scan' });

    expect(store.get(operatorSelectionAtom).selections.size).toBe(0);
    expect(store.get(selectedNodesDataAtom).size).toBe(0);
  });

  it('prunes stale inspection data when replacing or clearing selections', () => {
    const store = createStore();
    store.set(operatorSelectionActionAtom, {
      type: 'add',
      selectionId: 'scan',
      label: 'Scan',
      operatorIds: ['scan'],
      inspectedData: scanData,
    });
    store.set(operatorSelectionActionAtom, {
      type: 'add',
      selectionId: 'join',
      label: 'Join',
      operatorIds: ['join'],
      inspectedData: joinData,
    });

    store.set(operatorSelectionActionAtom, { type: 'replace', operatorIds: ['scan'] });

    expect([...store.get(selectedNodesDataAtom).keys()]).toEqual(['scan']);

    store.set(operatorSelectionActionAtom, { type: 'clear' });

    expect(store.get(operatorSelectionAtom).selections.size).toBe(0);
    expect(store.get(selectedNodesDataAtom).size).toBe(0);
  });
});

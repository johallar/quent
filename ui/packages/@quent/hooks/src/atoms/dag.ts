// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom } from 'jotai';
import {
  createEmptyOperatorSelectionState,
  createOperatorSelectionState,
  getActiveOperatorLabel,
  getLastOperatorSelectionId,
  getSelectedOperatorIds,
  getSelectedOperatorLabels,
  type OperatorSelectionState,
} from '../dag/operatorSelection';

/** Canonical operator filter selection state */
export const operatorSelectionAtom = atom<OperatorSelectionState>(
  createEmptyOperatorSelectionState()
);

/** The operator IDs represented by the current selections */
export const selectedNodeIdsAtom = atom(
  get => getSelectedOperatorIds(get(operatorSelectionAtom)),
  (_get, set, operatorIds: Set<string>) =>
    set(operatorSelectionAtom, createOperatorSelectionState(operatorIds))
);

/** Display label of the active operator selection */
export const selectedOperatorLabelAtom = atom(
  get => getActiveOperatorLabel(get(operatorSelectionAtom)),
  (get, set, label: string | null) => {
    const state = get(operatorSelectionAtom);
    if (label === null) {
      set(operatorSelectionAtom, { ...state, activeId: null });
      return;
    }

    const activeId = state.activeId ?? getLastOperatorSelectionId(state.selections);
    if (!activeId) return;
    const activeSelection = state.selections.get(activeId);
    if (!activeSelection) return;

    const selections = new Map(state.selections);
    selections.set(activeId, { ...activeSelection, label });
    set(operatorSelectionAtom, { selections, activeId });
  }
);

/** Display labels for all operator selections */
export const selectedOperatorLabelsAtom = atom(
  get => getSelectedOperatorLabels(get(operatorSelectionAtom)),
  (get, set, labels: Map<string, string>) => {
    const state = get(operatorSelectionAtom);
    const selections = new Map(state.selections);
    for (const [id, label] of labels) {
      const selection = selections.get(id);
      selections.set(id, {
        label,
        operatorIds: selection?.operatorIds ?? new Set([id]),
      });
    }
    set(operatorSelectionAtom, {
      selections,
      activeId: state.activeId ?? getLastOperatorSelectionId(selections),
    });
  }
);

/** The currently selected plan ID in the query plan tree view */
export const selectedPlanIdAtom = atom<string>('');

/** Worker ID of the query plan tree item currently being hovered */
export const hoveredWorkerIdAtom = atom<string | null>(null);

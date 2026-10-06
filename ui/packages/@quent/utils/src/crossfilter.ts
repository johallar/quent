// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface CrossfilterSelection {
  readonly label: string;
  readonly itemIds: ReadonlySet<string>;
}

export interface CrossfilterSelectionInput extends CrossfilterSelection {
  readonly selectionId: string;
}

export interface CrossfilterDimensionState {
  readonly selections: ReadonlyMap<string, CrossfilterSelection>;
}

export type CrossfilterAction =
  | {
      type: 'add';
      selectionId: string;
      label: string;
      itemIds: Iterable<string>;
    }
  | { type: 'remove'; selectionId: string }
  | { type: 'replace'; selections: ReadonlyArray<CrossfilterSelectionInput> }
  | { type: 'clear' };

const EMPTY_CROSSFILTER_DIMENSION: CrossfilterDimensionState = {
  selections: new Map(),
};

export function createEmptyCrossfilterDimension(): CrossfilterDimensionState {
  return EMPTY_CROSSFILTER_DIMENSION;
}

export function getCrossfilterItemIds(state: CrossfilterDimensionState): Set<string> {
  return new Set(
    Array.from(state.selections.values()).flatMap(selection => [...selection.itemIds])
  );
}

function containsAll(container: ReadonlySet<string>, contained: ReadonlySet<string>): boolean {
  for (const id of contained) {
    if (!container.has(id)) {
      return false;
    }
  }
  return true;
}

export function addCrossfilterSelection(
  state: CrossfilterDimensionState,
  selectionId: string,
  label: string,
  itemIds: Iterable<string>
): CrossfilterDimensionState {
  const selectedIds = new Set(itemIds);

  for (const [existingId, existing] of state.selections) {
    if (existingId !== selectionId && containsAll(existing.itemIds, selectedIds)) {
      return state;
    }
  }

  const selections = new Map(state.selections);
  for (const [existingId, existing] of selections) {
    if (existingId !== selectionId && containsAll(selectedIds, existing.itemIds)) {
      selections.delete(existingId);
    }
  }
  selections.set(selectionId, { label, itemIds: selectedIds });

  return { selections };
}

export function removeCrossfilterSelection(
  state: CrossfilterDimensionState,
  selectionId: string
): CrossfilterDimensionState {
  if (!state.selections.has(selectionId)) {
    return state;
  }

  const selections = new Map(state.selections);
  selections.delete(selectionId);
  return selections.size === 0 ? EMPTY_CROSSFILTER_DIMENSION : { selections };
}

export function replaceCrossfilterSelections(
  selections: ReadonlyArray<CrossfilterSelectionInput>
): CrossfilterDimensionState {
  let state = createEmptyCrossfilterDimension();
  for (const selection of selections) {
    state = addCrossfilterSelection(
      state,
      selection.selectionId,
      selection.label,
      selection.itemIds
    );
  }
  return state;
}

export function reduceCrossfilter(
  state: CrossfilterDimensionState,
  action: CrossfilterAction
): CrossfilterDimensionState {
  switch (action.type) {
    case 'add':
      return addCrossfilterSelection(state, action.selectionId, action.label, action.itemIds);
    case 'remove':
      return removeCrossfilterSelection(state, action.selectionId);
    case 'replace':
      return replaceCrossfilterSelections(action.selections);
    case 'clear':
      return createEmptyCrossfilterDimension();
  }
}

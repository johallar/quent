// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface OperatorSelection {
  readonly label: string;
  readonly operatorIds: ReadonlySet<string>;
}

export interface OperatorSelectionState {
  readonly selections: ReadonlyMap<string, OperatorSelection>;
  readonly activeId: string | null;
}

export function createEmptyOperatorSelectionState(): OperatorSelectionState {
  return {
    selections: new Map(),
    activeId: null,
  };
}

export function getSelectedOperatorIds(state: OperatorSelectionState): Set<string> {
  return new Set(
    Array.from(state.selections.values()).flatMap(selection => [...selection.operatorIds])
  );
}

export function getSelectedOperatorLabels(state: OperatorSelectionState): Map<string, string> {
  return new Map(Array.from(state.selections, ([id, selection]) => [id, selection.label] as const));
}

export function getActiveOperatorLabel(state: OperatorSelectionState): string | null {
  return state.activeId ? (state.selections.get(state.activeId)?.label ?? null) : null;
}

export function getLastOperatorSelectionId(
  selections: ReadonlyMap<string, OperatorSelection>
): string | null {
  let lastId: string | null = null;
  for (const id of selections.keys()) lastId = id;
  return lastId;
}

export function createOperatorSelectionState(
  operatorIds: Iterable<string>
): OperatorSelectionState {
  const selections = new Map<string, OperatorSelection>();
  for (const id of operatorIds) {
    selections.set(id, { label: id, operatorIds: new Set([id]) });
  }
  return {
    selections,
    activeId: getLastOperatorSelectionId(selections),
  };
}

export function addOperatorSelection(
  state: OperatorSelectionState,
  selectionId: string,
  label: string,
  operatorIds: Iterable<string>
): OperatorSelectionState {
  const selections = new Map(state.selections);
  const selectedIds = new Set(operatorIds);
  selectedIds.add(selectionId);
  selections.set(selectionId, { label, operatorIds: selectedIds });

  return {
    selections,
    activeId: selectionId,
  };
}

export function removeOperatorSelection(
  state: OperatorSelectionState,
  selectionId: string
): OperatorSelectionState {
  const selections = new Map(state.selections);
  selections.delete(selectionId);

  return {
    selections,
    activeId:
      state.activeId === selectionId ? getLastOperatorSelectionId(selections) : state.activeId,
  };
}

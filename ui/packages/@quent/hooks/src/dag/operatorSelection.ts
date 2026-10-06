// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  addCrossfilterSelection,
  createEmptyCrossfilterDimension,
  getCrossfilterItemIds,
  removeCrossfilterSelection,
  type CrossfilterDimensionState,
  type OperatorSelectionState,
} from '@quent/utils';

export const OPERATOR_CROSSFILTER_DIMENSION = 'operators';

export function createEmptyOperatorSelectionState(): OperatorSelectionState {
  return fromCrossfilterState(createEmptyCrossfilterDimension());
}

export function getSelectedOperatorIds(state: OperatorSelectionState): Set<string> {
  return getCrossfilterItemIds(toCrossfilterState(state));
}

export function toCrossfilterState(state: OperatorSelectionState): CrossfilterDimensionState {
  return {
    selections: new Map(
      Array.from(state.selections, ([selectionId, selection]) => [
        selectionId,
        {
          label: selection.label,
          itemIds: selection.operatorIds,
        },
      ])
    ),
  };
}

export function fromCrossfilterState(state: CrossfilterDimensionState): OperatorSelectionState {
  return {
    selections: new Map(
      Array.from(state.selections, ([selectionId, selection]) => [
        selectionId,
        {
          label: selection.label,
          operatorIds: selection.itemIds,
        },
      ])
    ),
  };
}

export function addOperatorSelection(
  state: OperatorSelectionState,
  selectionId: string,
  label: string,
  operatorIds: Iterable<string>
): OperatorSelectionState {
  const crossfilterState = toCrossfilterState(state);
  const selectedIds = new Set(operatorIds);
  selectedIds.add(selectionId);
  const next = addCrossfilterSelection(crossfilterState, selectionId, label, selectedIds);
  if (next === crossfilterState) {
    return state;
  }
  return fromCrossfilterState(next);
}

export function removeOperatorSelection(
  state: OperatorSelectionState,
  selectionId: string
): OperatorSelectionState {
  const crossfilterState = toCrossfilterState(state);
  const next = removeCrossfilterSelection(crossfilterState, selectionId);
  if (next === crossfilterState) {
    return state;
  }
  return fromCrossfilterState(next);
}

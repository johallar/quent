// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Escape hatch entry exposing the raw Jotai atoms backing this package.
 *
 * URL ↔ state synchronization for the consumer app (`useUrlStateSync`) needs
 * direct atom references for `useHydrateAtoms` and `useAtomValue` calls that
 * the selector-hook API cannot model. Importing atoms from here is restricted
 * to the URL-sync layer; component code must continue to use the selector
 * hooks exported from the package index (HOOKS-02).
 */

export { selectedPlanIdAtom, selectedNodeIdsAtom, selectedOperatorLabelAtom } from './atoms/dag';

export {
  selectedColorField,
  selectedEdgeWidthFieldAtom,
  selectedEdgeColorFieldAtom,
  selectedNodeLabelFieldAtom,
  nodeColorPaletteAtom,
  edgeColorPaletteAtom,
} from './atoms/dagControls';

export { debouncedZoomRangeAtom, hideTasksAtom } from './atoms/timeline';

export {
  OPERATOR_TABLE_PERSIST_KEY,
  aggModeAtomFamily,
  enabledIndicesAtomFamily,
  indexOrderAtomFamily,
  selectedStatsAtomFamily,
  sortingAtomFamily,
  statOrderAtomFamily,
} from './atoms/pivotTable';

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom } from 'jotai';

/** The set of currently selected node IDs in the DAG chart */
export const selectedNodeIdsAtom = atom(new Set<string>());

/** Display label of the currently selected operator */
export const selectedOperatorLabelAtom = atom<string | null>(null);

/** Display labels for operators selected independently in timeline charts */
export const selectedOperatorLabelsAtom = atom(new Map<string, string>());

/** The currently selected plan ID in the query plan tree view */
export const selectedPlanIdAtom = atom<string>('');

/** Worker ID of the query plan tree item currently being hovered */
export const hoveredWorkerIdAtom = atom<string | null>(null);

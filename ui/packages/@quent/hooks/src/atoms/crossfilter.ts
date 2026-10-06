// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom } from 'jotai';
import { atomFamily } from 'jotai-family';
import {
  createEmptyCrossfilterDimension,
  getCrossfilterItemIds,
  reduceCrossfilter,
  type CrossfilterAction,
} from '@quent/utils';

export const crossfilterDimensionAtomFamily = atomFamily(() =>
  atom(createEmptyCrossfilterDimension())
);

export const crossfilterItemIdsAtomFamily = atomFamily((dimension: string) =>
  atom(get => getCrossfilterItemIds(get(crossfilterDimensionAtomFamily(dimension))))
);

export const crossfilterActionAtomFamily = atomFamily((dimension: string) =>
  atom(null, (get, set, action: CrossfilterAction): Set<string> => {
    const dimensionAtom = crossfilterDimensionAtomFamily(dimension);
    const next = reduceCrossfilter(get(dimensionAtom), action);
    set(dimensionAtom, next);
    return getCrossfilterItemIds(next);
  })
);

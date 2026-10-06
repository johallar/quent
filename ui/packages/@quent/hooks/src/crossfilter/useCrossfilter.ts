// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtomValueRawSync, useSetAtom } from 'jotai';
import {
  crossfilterActionAtomFamily,
  crossfilterDimensionAtomFamily,
  crossfilterItemIdsAtomFamily,
} from '../atoms/crossfilter';

export const useCrossfilter = (dimension: string) =>
  useAtomValueRawSync(crossfilterDimensionAtomFamily(dimension));

export const useCrossfilterItemIds = (dimension: string) =>
  useAtomValueRawSync(crossfilterItemIdsAtomFamily(dimension));

export const useCrossfilterActions = (dimension: string) =>
  useSetAtom(crossfilterActionAtomFamily(dimension));

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  type ColumnDef,
  type SortFn,
} from '@tanstack/react-table';
import type { GroupedDataTableRowBase } from './types';

export const groupedDataTableFeatures = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
});

export type GroupedDataTableColumnDef<TRow extends GroupedDataTableRowBase> = ColumnDef<
  typeof groupedDataTableFeatures,
  TRow
>;

export type GroupedDataTableSortFn<TRow extends GroupedDataTableRowBase> = SortFn<
  typeof groupedDataTableFeatures,
  TRow
>;

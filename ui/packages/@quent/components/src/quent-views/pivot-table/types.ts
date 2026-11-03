// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { AggMode, ContinuousPaletteName, ScaleType, Statistic, StatValue } from '@quent/utils';
import type {
  GroupedDataTableGroupKeyEntry,
  GroupedDataTableRowBase,
} from '../../ui/grouped-data-table/types';

export type { AggMode };

export interface HoveredStatInfo {
  name: string;
  values: Map<string, number>;
  min: number;
  max: number;
  aggMode: AggMode;
}

export interface PivotTableGroupCellHoverHandlers {
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

export interface PivotTableInteractionConfig<TRow extends GroupedDataTableRowBase> {
  hoveredStat: HoveredStatInfo | null;
  setHoveredStat: (info: HoveredStatInfo | null) => void;
  hoveredItemId?: string | null;
  selectedItemIds?: ReadonlySet<string>;
  onTableMouseLeave?: () => void;
  groupCellHandlers?: (
    groupKey: GroupedDataTableGroupKeyEntry,
    row: TRow
  ) => PivotTableGroupCellHoverHandlers;
}

export interface PivotTableRenderConfig {
  getGroupTypeColor?: (key: string, id: string) => string | undefined;
  getStatLabel?: (statName: string) => string;
  getStatTitle?: (statName: string) => string;
  formatValue?: (value: StatValue, statName: string, quantity?: string) => string;
}

export type PivotTableDropPosition = 'before' | 'after';

export interface PivotTableDragDropConfig<TElement extends HTMLElement = HTMLElement> {
  draggedId: string | null;
  getDropTargetPosition?: (id: string) => PivotTableDropPosition | undefined;
  onDragStart: (event: React.DragEvent<TElement>, id: string) => void;
  onDragOver: (event: React.DragEvent<TElement>, id: string) => void;
  onDragLeave: (event: React.DragEvent<TElement>, id: string) => void;
  onDrop: (event: React.DragEvent<TElement>, id: string) => void;
  onDragEnd: () => void;
}

export type PivotTableDnDConfig = PivotTableDragDropConfig<HTMLTableCellElement>;

export interface PivotTableDisplayConfig {
  isAggregating: boolean;
  aggMode: AggMode;
  colorPalette: ContinuousPaletteName;
  scaleType: ScaleType;
  darkMode: boolean;
}

export type SortDir = 'asc' | 'desc';

export interface StatGroupInputGroupValue {
  id: string;
  label: string;
}

export interface StatGroupExpandedRow {
  groups: Record<string, StatGroupInputGroupValue>;
  itemType: string;
  itemId: string;
  scopeId: string;
  statisticName: string;
  value: StatValue;
  quantity?: string;
}

export interface PivotedStatTableSchema<TRow> {
  groups: Record<
    string,
    {
      id: (row: TRow) => string;
      label?: (row: TRow) => string;
    }
  >;
  itemId: (row: TRow) => string;
  scopeId: (row: TRow) => string;
  itemType?: (row: TRow) => string;
  stats: (row: TRow) => readonly Statistic[];
}

export interface GroupKeyEntry {
  key: string;
  id: string;
  label: string;
}

export interface PivotedRowAgg {
  sum: number | bigint | null;
  mean: number | null;
  min: number | bigint | null;
  max: number | bigint | null;
  stdev: number | null;
  count: number;
  isNumeric: boolean;
  quantity?: string;
}

export interface PivotedRow {
  groupKeys: GroupKeyEntry[];
  rowKey: string;
  values: Map<string, Statistic[]>;
  aggs: Map<string, PivotedRowAgg>;
  itemIds: Set<string>;
  itemType: string;
  itemScopeIds: Map<string, string>;
}

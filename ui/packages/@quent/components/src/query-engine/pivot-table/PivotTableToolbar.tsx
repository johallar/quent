// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from 'react';
import { useColumnDragDrop } from '@quent/hooks';
import {
  PivotTableToolbarView,
  type IndexConfigEntry,
} from '../../quent-views/pivot-table/PivotTableToolbarView';
import type {
  AggMode,
  PivotTableDragDropConfig,
  PivotTableDropPosition,
} from '../../quent-views/pivot-table/types';

export type { IndexConfigEntry };

export interface PivotTableToolbarProps {
  indexConfig: IndexConfigEntry[];
  isAggregating: boolean;
  aggMode: AggMode;
  orderedStats: string[];
  selectedStats: Set<string> | null;
  onToggleIndex: (key: string) => void;
  onReorderIndex: (fromKey: string, toKey: string) => void;
  onSetAggMode: (mode: AggMode) => void;
  onToggleStat: (stat: string) => void;
  onSelectAllStats: () => void;
  onSelectNoStats: () => void;
  getStatLabel?: (stat: string) => string;
  getStatTitle?: (stat: string) => string;
}

/** Query-engine integration adapter over the controlled toolbar view. */
export function PivotTableToolbar({
  indexConfig,
  onReorderIndex,
  ...viewProps
}: PivotTableToolbarProps) {
  const commitDrop = useCallback(
    (fromKey: string, toKey: string, position: PivotTableDropPosition) => {
      if (fromKey === toKey) {
        return;
      }
      const keys = indexConfig.map(entry => entry.key);
      const fromIndex = keys.indexOf(fromKey);
      const targetIndex = keys.indexOf(toKey);
      if (fromIndex < 0 || targetIndex < 0) {
        return;
      }
      let anchorKey = toKey;
      if (position === 'before' && fromIndex < targetIndex) {
        anchorKey = keys[targetIndex - 1] ?? toKey;
      } else if (position === 'after' && fromIndex > targetIndex) {
        anchorKey = keys[targetIndex + 1] ?? toKey;
      }
      if (anchorKey !== fromKey) {
        onReorderIndex(fromKey, anchorKey);
      }
    },
    [indexConfig, onReorderIndex]
  );
  const dragDropState = useColumnDragDrop({ onDropCommit: commitDrop });
  const dragDrop = useMemo(
    (): PivotTableDragDropConfig<HTMLButtonElement> => ({
      draggedId: dragDropState.draggedId,
      getDropTargetPosition: dragDropState.getDropTargetPosition,
      onDragStart: dragDropState.handleDragStart,
      onDragOver: dragDropState.handleDragOver,
      onDragLeave: dragDropState.handleDragLeave,
      onDrop: dragDropState.handleDrop,
      onDragEnd: dragDropState.handleDragEnd,
    }),
    [dragDropState]
  );

  return <PivotTableToolbarView {...viewProps} indexConfig={indexConfig} dragDrop={dragDrop} />;
}

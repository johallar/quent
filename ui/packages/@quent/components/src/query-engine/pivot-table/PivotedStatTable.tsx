// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { OnChangeFn, SortingState } from '@tanstack/react-table';
import { useColumnDragDrop, useNodeColorPalette, useSelectedScaleType } from '@quent/hooks';
import { PivotedStatTableView } from '../../quent-views/pivot-table/PivotedStatTableView';
import { getSchemaStatNames } from '../../quent-views/pivot-table/utils';
import type {
  AggMode,
  PivotTableDisplayConfig,
  PivotTableDnDConfig,
  PivotTableInteractionConfig,
  PivotTableRenderConfig,
  PivotedRow,
  PivotedStatTableSchema,
} from '../../quent-views/pivot-table/types';
import type {
  GroupedDataTableGroupRenderMode,
  GroupedDataTableVirtualizationOptions,
} from '../../ui/grouped-data-table/GroupedDataTable';

export interface PivotedStatTableProps<TRow> {
  rows: TRow[];
  schema: PivotedStatTableSchema<TRow>;
  activeIndices: string[];
  visibleStats?: string[];
  isAggregating?: boolean;
  aggMode?: AggMode;
  indexLabels?: Record<string, React.ReactNode>;
  hideEmptyRows?: boolean;
  isDark?: boolean;
  interaction: PivotTableInteractionConfig<PivotedRow>;
  renderConfig?: PivotTableRenderConfig;
  virtualization?: GroupedDataTableVirtualizationOptions;
  groupRenderMode?: GroupedDataTableGroupRenderMode;
  stickyGroupColumns?: boolean;
  onReorderStat?: (from: string, to: string) => void;
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
}

/** Query-engine integration adapter over the controlled table view. */
export function PivotedStatTable<TRow>({
  rows,
  schema,
  activeIndices,
  visibleStats,
  isAggregating = false,
  aggMode = 'sum',
  indexLabels,
  hideEmptyRows = true,
  isDark = false,
  interaction,
  renderConfig,
  virtualization,
  groupRenderMode,
  stickyGroupColumns = true,
  onReorderStat,
  sorting,
  onSortingChange,
}: PivotedStatTableProps<TRow>) {
  const [colorPalette] = useNodeColorPalette();
  const [scaleType] = useSelectedScaleType();
  const [tableStatOrder, setTableStatOrder] = useState<string[]>([]);
  const dragGhostRef = useRef<HTMLElement | null>(null);
  const resolvedVisibleStats = useMemo(
    () => visibleStats ?? getSchemaStatNames(rows, schema),
    [rows, schema, visibleStats]
  );

  useEffect(() => {
    // Reconcile controlled availability with the user's local ordering.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTableStatOrder(previous => {
      if (previous.length === 0) {
        return resolvedVisibleStats;
      }
      const visible = new Set(resolvedVisibleStats);
      const kept = previous.filter(stat => visible.has(stat));
      return [...kept, ...resolvedVisibleStats.filter(stat => !kept.includes(stat))];
    });
  }, [resolvedVisibleStats]);

  const orderedVisibleStats = tableStatOrder.length > 0 ? tableStatOrder : resolvedVisibleStats;
  const removeDragGhost = useCallback(() => {
    dragGhostRef.current?.remove();
    dragGhostRef.current = null;
  }, []);
  const createHeaderDragPreview = useCallback(
    (event: React.DragEvent<HTMLElement>) => {
      removeDragGhost();
      const header = event.currentTarget;
      const rect = header.getBoundingClientRect();
      const dragGhost = header.cloneNode(true) as HTMLElement;
      Object.assign(dragGhost.style, {
        position: 'fixed',
        top: '-1000px',
        left: '-1000px',
        width: `${rect.width}px`,
        pointerEvents: 'none',
        opacity: '0.95',
        border: '1px solid hsl(var(--primary) / 0.55)',
        borderRadius: '4px',
        backgroundColor: 'hsl(var(--card))',
      } satisfies Partial<CSSStyleDeclaration>);
      document.body.appendChild(dragGhost);
      dragGhostRef.current = dragGhost;
      event.dataTransfer.setDragImage(
        dragGhost,
        event.clientX - rect.left,
        event.clientY - rect.top
      );
      return () => {
        if (dragGhostRef.current === dragGhost) {
          dragGhostRef.current = null;
        }
        dragGhost.remove();
      };
    },
    [removeDragGhost]
  );
  const commitStatDrop = useCallback(
    (from: string, to: string, position: 'before' | 'after') => {
      setTableStatOrder(previous => {
        const next = previous.length > 0 ? [...previous] : [...resolvedVisibleStats];
        const fromIndex = next.indexOf(from);
        if (fromIndex < 0 || from === to) {
          return next;
        }
        const [moved] = next.splice(fromIndex, 1);
        const targetIndex = next.indexOf(to);
        if (targetIndex < 0) {
          return next;
        }
        next.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
        return next;
      });
      onReorderStat?.(from, to);
    },
    [onReorderStat, resolvedVisibleStats]
  );
  const dragDropState = useColumnDragDrop({
    onDropCommit: commitStatDrop,
    createDragPreview: createHeaderDragPreview,
  });
  const dragDrop = useMemo(
    (): PivotTableDnDConfig => ({
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
  const display = useMemo(
    (): PivotTableDisplayConfig => ({
      isAggregating,
      aggMode,
      colorPalette,
      scaleType,
      darkMode: isDark,
    }),
    [aggMode, colorPalette, isAggregating, isDark, scaleType]
  );

  return (
    <PivotedStatTableView
      rows={rows}
      schema={schema}
      activeIndices={activeIndices}
      visibleStats={orderedVisibleStats}
      display={display}
      dragDrop={dragDrop}
      indexLabels={indexLabels}
      hideEmptyRows={hideEmptyRows}
      interaction={interaction}
      renderConfig={renderConfig}
      virtualization={virtualization}
      groupRenderMode={groupRenderMode}
      stickyGroupColumns={stickyGroupColumns}
      sorting={sorting}
      onSortingChange={onSortingChange}
    />
  );
}

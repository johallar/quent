// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import type { OnChangeFn, SortingState } from '@tanstack/react-table';
import { GroupedDataTable } from '../../ui/grouped-data-table/GroupedDataTable';
import { cn, computeScaleRange, type ScaleRange, type StatValue } from '@quent/utils';
import type { PivotedRow, HoveredStatInfo, PivotedStatTableSchema } from './types';
import type {
  PivotTableDisplayConfig,
  PivotTableDnDConfig,
  PivotTableInteractionConfig,
  PivotTableRenderConfig,
} from './types';
import type {
  DataHeaderProps,
  GroupCellProps,
  DataCellProps,
} from '../../ui/grouped-data-table/types';
import {
  buildPivotedRows,
  expandRowsFromSchema,
  formatStatValue,
  getSchemaStatNames,
  getSortValue,
  gradientBg,
  itemHasId,
  numericSortingFn,
} from './utils';
import type {
  GroupedDataTableColumnDef,
  GroupedDataTableGroupRenderMode,
  GroupedDataTableVirtualizationOptions,
} from '../../ui/grouped-data-table/GroupedDataTable';
import {
  PivotTableRenderProvider,
  usePivotTableRenderContext,
  type PivotTableRenderContextValue,
} from './PivotTableRenderContext';

const HIGHLIGHT_WASH = 'inset 0 0 0 999px hsl(var(--primary) / 0.07)';

function DataHeader({ stat, sortInfo, onSort, className, style }: DataHeaderProps) {
  const { dnd, interaction, renderConfig, derived } = usePivotTableRenderContext();
  const hoveredStatName = interaction.hoveredStat?.name;
  const statLabel = renderConfig.getStatLabel?.(stat) ?? stat;
  const statTitle = renderConfig.getStatTitle?.(stat) ?? statLabel;
  // While a column is being dragged, show a 3px primary-colored bar on the
  // leading or trailing edge of the column under the cursor to indicate where
  // a drop would insert.
  const dropTargetPosition = dnd.getDropTargetPosition?.(stat);
  let dropTargetShadow: string | undefined;
  if (dropTargetPosition === 'before') {
    dropTargetShadow = 'inset 3px 0 0 hsl(var(--primary))';
  } else if (dropTargetPosition === 'after') {
    dropTargetShadow = 'inset -3px 0 0 hsl(var(--primary))';
  }

  // The drop indicator must layer on top of any existing box-shadow (e.g. the
  // sticky/group-cell accent), not replace it.
  const mergedStyle: React.CSSProperties | undefined = dropTargetShadow
    ? {
        ...style,
        boxShadow: [style?.boxShadow, dropTargetShadow].filter(Boolean).join(', '),
      }
    : style;

  return (
    <th
      draggable
      onDragStart={e => dnd.onDragStart(e, stat)}
      onDragOver={e => dnd.onDragOver(e, stat)}
      onDragLeave={e => dnd.onDragLeave(e, stat)}
      onDrop={e => dnd.onDrop(e, stat)}
      onDragEnd={dnd.onDragEnd}
      onClick={() => {
        if (dnd.draggedId !== null) {
          return;
        }
        onSort();
      }}
      onMouseEnter={() => interaction.setHoveredStat(derived.buildHoveredStatInfo(stat))}
      onMouseLeave={() => interaction.setHoveredStat(null)}
      className={cn(
        'table-header-overlay text-right px-3 py-2 text-sm font-mono text-data whitespace-nowrap cursor-pointer select-none hover:text-foreground font-normal',
        className,
        {
          'font-semibold': Boolean(sortInfo),
          'opacity-50': dnd.draggedId === stat,
          'text-foreground': Boolean(sortInfo),
          'table-header-overlay-active': hoveredStatName === stat,
        }
      )}
      style={mergedStyle}
    >
      <span className="relative z-10" title={statTitle}>
        {statLabel}
        {sortInfo && <span className="ml-1 text-xs">{sortInfo.desc ? '▼' : '▲'}</span>}
      </span>
    </th>
  );
}

function GroupCell({
  row,
  groupKey: gk,
  rowSpan,
  columnIndex: _columnIndex,
  style,
  className,
}: GroupCellProps<PivotedRow>) {
  const { interaction, renderConfig } = usePivotTableRenderContext();
  const typeColor = renderConfig.getGroupTypeColor?.(gk.key, gk.id);
  const handlers = interaction.groupCellHandlers?.(gk, row);
  const isRowHighlightedFromDag =
    interaction.hoveredItemId !== null &&
    interaction.hoveredItemId !== undefined &&
    row.itemIds.has(interaction.hoveredItemId);
  const hasDagSelection = (interaction.selectedItemIds?.size ?? 0) > 0;
  const isRowSelectedFromDag =
    hasDagSelection &&
    interaction.selectedItemIds != null &&
    itemHasId(row.itemIds, interaction.selectedItemIds);
  const backgroundColor = typeColor
    ? `color-mix(in srgb, ${typeColor} 15%, hsl(var(--card)))`
    : undefined;
  const accentColor = typeColor ? (isRowSelectedFromDag ? typeColor : backgroundColor) : undefined;
  const leftAccentShadow = accentColor ? `inset 8px 0 0 0 ${accentColor}` : undefined;
  const existingBoxShadow = style?.boxShadow;
  const combinedBoxShadow =
    leftAccentShadow && existingBoxShadow
      ? `${leftAccentShadow}, ${existingBoxShadow}`
      : (leftAccentShadow ?? existingBoxShadow);
  const baseStyle = typeColor
    ? {
        ...style,
        // Opaque tint so scrolled rows never bleed through sticky group cells.
        backgroundColor,
        boxShadow: combinedBoxShadow,
      }
    : style;

  return (
    <td
      className={cn(
        'table-header-overlay px-3 py-1.5 whitespace-nowrap align-top border-r border-border/30',
        isRowHighlightedFromDag && 'table-header-overlay-active',
        className
      )}
      rowSpan={rowSpan}
      style={baseStyle}
      onMouseEnter={() => {
        interaction.setHoveredStat(null);
        handlers?.onMouseEnter?.();
      }}
      onMouseLeave={() => {
        handlers?.onMouseLeave?.();
      }}
      onPointerLeave={() => {
        handlers?.onMouseLeave?.();
      }}
    >
      <span className="relative z-10">{gk.label}</span>
    </td>
  );
}

function DataCell({ row, stat }: DataCellProps<PivotedRow>) {
  const { display, interaction, renderConfig, derived } = usePivotTableRenderContext();
  const numVal = getSortValue(row, stat, display.isAggregating, display.aggMode);
  const range = derived.columnRanges.get(stat);
  const bg =
    numVal !== null && range
      ? gradientBg(numVal, range, display.scaleType, display.colorPalette, display.darkMode)
      : undefined;
  const isStatHovered = interaction.hoveredStat?.name === stat;
  const colHighlight = isStatHovered ? HIGHLIGHT_WASH : undefined;
  const isRowHighlightedFromTable =
    derived.hoveredHeaderItemIds != null && itemHasId(row.itemIds, derived.hoveredHeaderItemIds);
  const isRowHighlightedFromDag =
    interaction.hoveredItemId !== null &&
    interaction.hoveredItemId !== undefined &&
    row.itemIds.has(interaction.hoveredItemId);
  const rowHighlight =
    isRowHighlightedFromTable || isRowHighlightedFromDag ? HIGHLIGHT_WASH : undefined;
  const cellHighlight = rowHighlight ?? colHighlight;
  const statCellProps = {
    onMouseEnter: () => interaction.setHoveredStat(derived.buildHoveredStatInfo(stat)),
    onMouseLeave: () => interaction.setHoveredStat(null),
  };
  const formatValue = (value: StatValue, statName: string, quantity?: string) =>
    renderConfig.formatValue?.(value, statName, quantity) ?? formatStatValue(value, statName);
  if (!display.isAggregating) {
    const entries = row.values.get(stat) ?? [];
    return (
      <td
        className="relative z-0 px-3 py-1.5 whitespace-nowrap text-right font-mono"
        style={{ backgroundColor: bg, boxShadow: cellHighlight }}
        {...statCellProps}
      >
        {entries.length
          ? entries.map(entry => formatValue(entry.value, entry.key, entry.quantity)).join(', ')
          : '-'}
      </td>
    );
  }
  const agg = row.aggs.get(stat);
  if (!agg || !agg.isNumeric) {
    return (
      <td
        className="relative z-0 px-3 py-1.5 whitespace-nowrap text-right font-mono text-muted-foreground"
        style={{ boxShadow: cellHighlight }}
        {...statCellProps}
      >
        -
      </td>
    );
  }
  const displayVal = numVal;
  return (
    <td
      className="relative z-0 px-3 py-1.5 whitespace-nowrap text-right font-mono"
      style={{ backgroundColor: bg, boxShadow: cellHighlight }}
      {...statCellProps}
    >
      {formatValue(displayVal, stat, agg.quantity)}
    </td>
  );
}

export interface PivotedStatTableViewProps<TRow> {
  rows: TRow[];
  schema: PivotedStatTableSchema<TRow>;
  activeIndices: string[];
  visibleStats?: string[];
  display: PivotTableDisplayConfig;
  dragDrop: PivotTableDnDConfig;
  indexLabels?: Record<string, React.ReactNode>;
  /**
   * If true, rows with no value for any visible stat (e.g. an operator/plan
   * that doesn't produce any of the currently selected statistics) are
   * filtered out before rendering. Defaults to true. Flip to false to expose
   * a future "show null rows" toggle.
   */
  hideEmptyRows?: boolean;
  interaction: PivotTableInteractionConfig<PivotedRow>;
  renderConfig?: PivotTableRenderConfig;
  virtualization?: GroupedDataTableVirtualizationOptions;
  groupRenderMode?: GroupedDataTableGroupRenderMode;
  stickyGroupColumns?: boolean;
  /** Optional controlled sort state, forwarded to the underlying GroupedDataTable. */
  sorting?: SortingState;
  onSortingChange?: OnChangeFn<SortingState>;
}

export function PivotedStatTableView<TRow>({
  rows,
  schema,
  activeIndices,
  visibleStats,
  display,
  dragDrop,
  indexLabels,
  hideEmptyRows = true,
  interaction,
  renderConfig,
  virtualization,
  groupRenderMode,
  stickyGroupColumns = true,
  sorting,
  onSortingChange,
}: PivotedStatTableViewProps<TRow>) {
  const { isAggregating, aggMode, colorPalette, scaleType, darkMode } = display;
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [hoveredHeaderItemIds, setHoveredHeaderItemIds] = useState<Set<string> | null>(null);
  const setHoveredStat = interaction.setHoveredStat;
  const effectiveHoveredStat = interaction.hoveredStat;
  const effectiveHoveredItemId = interaction.hoveredItemId;
  const effectiveSelectedItemIds = interaction.selectedItemIds;
  const effectiveGroupCellHandlers = interaction.groupCellHandlers;
  const effectiveOnTableMouseLeave = interaction.onTableMouseLeave;
  const effectiveRenderConfig = useMemo(
    (): PivotTableRenderConfig => ({
      getGroupTypeColor: renderConfig?.getGroupTypeColor,
      getStatLabel: renderConfig?.getStatLabel,
      getStatTitle: renderConfig?.getStatTitle,
      formatValue: renderConfig?.formatValue,
    }),
    [renderConfig]
  );
  const expandedRows = useMemo(() => expandRowsFromSchema(rows, schema), [rows, schema]);
  const resolvedVisibleStats = useMemo(
    () => visibleStats ?? getSchemaStatNames(rows, schema),
    [rows, schema, visibleStats]
  );

  const effectiveVisibleStats = resolvedVisibleStats;
  const resolvedIndexLabels = useMemo(
    () =>
      indexLabels ??
      (Object.fromEntries(activeIndices.map(key => [key, key])) as Record<string, React.ReactNode>),
    [activeIndices, indexLabels]
  );
  const effectiveGroupRenderMode =
    groupRenderMode ?? (virtualization?.enabled ? 'compact' : 'rowSpan');

  const statsByItem = useMemo(() => {
    const cells = new Map<string, Map<string, number | null>>();
    for (const row of expandedRows) {
      let items = cells.get(row.statisticName);
      if (!items) {
        items = new Map();
        cells.set(row.statisticName, items);
      }
      // Repeated names have no single numeric value for hover linkage.
      items.set(
        row.itemId,
        items.has(row.itemId) || typeof row.value !== 'number' ? null : row.value
      );
    }
    return new Map(
      [...cells].map(([name, items]) => [
        name,
        new Map([...items].filter((entry): entry is [string, number] => entry[1] !== null)),
      ])
    );
  }, [expandedRows]);

  const buildHoveredStatInfo = useCallback(
    (statName: string): HoveredStatInfo | null => {
      const values = statsByItem.get(statName);
      if (!values || values.size === 0) {
        return null;
      }
      let min = Infinity,
        max = -Infinity;
      for (const v of values.values()) {
        if (v < min) {
          min = v;
        }
        if (v > max) {
          max = v;
        }
      }
      return { name: statName, values, min, max, aggMode: isAggregating ? aggMode : 'sum' };
    },
    [statsByItem, isAggregating, aggMode]
  );

  const pivotedRows = useMemo(
    () =>
      buildPivotedRows(
        expandedRows,
        activeIndices.map(key => ({
          key,
          getId: row => row.groups[key]?.id ?? '-',
          getLabel: row => row.groups[key]?.label ?? row.groups[key]?.id ?? '-',
        })),
        isAggregating
      ),
    [expandedRows, activeIndices, isAggregating]
  );

  // A pivoted row is "empty" when none of the currently visible stats have a
  // renderable value for it. In non-aggregating mode that means every
  // each entry in `values.get(stat)` is null/undefined; in aggregating mode it means every
  // `aggs.get(stat)` is missing or non-numeric (i.e. the cell would render '-').
  const visiblePivotedRows = useMemo(() => {
    if (!hideEmptyRows) {
      return pivotedRows;
    }
    return pivotedRows.filter(row => {
      for (const stat of effectiveVisibleStats) {
        if (isAggregating) {
          const agg = row.aggs.get(stat);
          if (agg && agg.isNumeric) {
            return true;
          }
        } else {
          const v = row.values.get(stat);
          if (v?.some(entry => entry.value !== null && entry.value !== undefined)) {
            return true;
          }
        }
      }
      return false;
    });
  }, [pivotedRows, hideEmptyRows, effectiveVisibleStats, isAggregating]);

  const columnRanges = useMemo(() => {
    const ranges = new Map<string, ScaleRange>();
    for (const stat of effectiveVisibleStats) {
      const nums: number[] = [];
      for (const row of visiblePivotedRows) {
        const v = getSortValue(row, stat, isAggregating, aggMode);
        if (v !== null) {
          // Convert to number for gradient color math — precision loss is acceptable here
          nums.push(Number(v));
        }
      }
      if (nums.length > 0) {
        ranges.set(stat, computeScaleRange(nums));
      }
    }
    return ranges;
  }, [visiblePivotedRows, effectiveVisibleStats, isAggregating, aggMode]);

  const handleTableMouseLeave = useCallback(() => {
    setHoveredHeaderItemIds(null);
    setHoveredStat(null);
    effectiveOnTableMouseLeave?.();
  }, [setHoveredStat, effectiveOnTableMouseLeave]);

  // Safety net: fast mouse movements, drag captures, and pointer-events: none
  // overlays can all swallow the per-element onMouseLeave. Clear stale hover
  // state whenever the pointer exits the document or the window loses focus.
  useEffect(() => {
    const onDocPointerOut = (e: PointerEvent) => {
      if (e.relatedTarget == null) {
        handleTableMouseLeave();
      }
    };
    const onWindowBlur = () => handleTableMouseLeave();
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') {
        handleTableMouseLeave();
      }
    };
    document.addEventListener('pointerout', onDocPointerOut);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('pointerout', onDocPointerOut);
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [handleTableMouseLeave]);

  useEffect(() => {
    if (!effectiveHoveredItemId) {
      return;
    }
    const row = visiblePivotedRows.find(r => r.itemIds.has(effectiveHoveredItemId));
    if (!row) {
      return;
    }
    const el = rowRefs.current.get(row.rowKey);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [effectiveHoveredItemId, visiblePivotedRows]);

  const interactionContextValue = useMemo(
    () => ({
      hoveredStat: effectiveHoveredStat,
      setHoveredStat,
      hoveredItemId: effectiveHoveredItemId,
      selectedItemIds: effectiveSelectedItemIds,
      onTableMouseLeave: effectiveOnTableMouseLeave,
      groupCellHandlers: effectiveGroupCellHandlers,
    }),
    [
      effectiveHoveredStat,
      setHoveredStat,
      effectiveHoveredItemId,
      effectiveSelectedItemIds,
      effectiveOnTableMouseLeave,
      effectiveGroupCellHandlers,
    ]
  );
  const displayContextValue = useMemo(
    () => ({
      isAggregating,
      aggMode,
      colorPalette,
      scaleType,
      darkMode,
    }),
    [isAggregating, aggMode, colorPalette, scaleType, darkMode]
  );
  const derivedContextValue = useMemo(
    () => ({
      hoveredHeaderItemIds,
      columnRanges,
      buildHoveredStatInfo,
    }),
    [hoveredHeaderItemIds, columnRanges, buildHoveredStatInfo]
  );
  const renderContextValue = useMemo(
    (): PivotTableRenderContextValue => ({
      interaction: interactionContextValue,
      renderConfig: effectiveRenderConfig,
      display: displayContextValue,
      dnd: dragDrop,
      derived: derivedContextValue,
    }),
    [
      interactionContextValue,
      effectiveRenderConfig,
      displayContextValue,
      dragDrop,
      derivedContextValue,
    ]
  );

  const columns = useMemo((): GroupedDataTableColumnDef<PivotedRow>[] => {
    const groupCols: GroupedDataTableColumnDef<PivotedRow>[] = activeIndices.map(def => ({
      id: def,
      header: String(resolvedIndexLabels[def] ?? def),
      enableSorting: false,
    }));
    const statCols: GroupedDataTableColumnDef<PivotedRow>[] = effectiveVisibleStats.map(stat => ({
      id: stat,
      header: effectiveRenderConfig.getStatLabel?.(stat) ?? stat,
      enableSorting: true,
      sortUndefined: 'last',
      sortFn: numericSortingFn,
      accessorFn: (row: PivotedRow) => getSortValue(row, stat, isAggregating, aggMode) ?? undefined,
    }));
    return [...groupCols, ...statCols];
  }, [
    activeIndices,
    effectiveVisibleStats,
    resolvedIndexLabels,
    effectiveRenderConfig,
    isAggregating,
    aggMode,
  ]);

  const hasSelection = (effectiveSelectedItemIds?.size ?? 0) > 0;
  const isSelected = (row: PivotedRow) =>
    effectiveSelectedItemIds != null && itemHasId(row.itemIds, effectiveSelectedItemIds);
  const renderGroupHeader = useCallback(
    (columnId: string) => (
      <span className={cn('relative z-10')}>{resolvedIndexLabels[columnId]}</span>
    ),
    [resolvedIndexLabels]
  );

  const getRowRef = useCallback(
    (rowKey: string) => (el: HTMLTableRowElement | null) => {
      if (el) {
        rowRefs.current.set(rowKey, el);
      } else {
        rowRefs.current.delete(rowKey);
      }
    },
    []
  );

  return (
    <div
      className="h-full"
      onMouseLeave={handleTableMouseLeave}
      onPointerLeave={handleTableMouseLeave}
    >
      <PivotTableRenderProvider value={renderContextValue}>
        <GroupedDataTable
          data={visiblePivotedRows}
          columns={columns}
          getRowId={row => row.rowKey}
          groupColumnIds={activeIndices}
          renderGroupHeader={renderGroupHeader}
          DataHeader={DataHeader}
          GroupCell={GroupCell}
          DataCell={DataCell}
          virtualization={virtualization}
          groupRenderMode={effectiveGroupRenderMode}
          stickyGroupColumns={stickyGroupColumns}
          sorting={sorting}
          onSortingChange={onSortingChange}
          getRowRef={getRowRef}
          getRowClassName={row =>
            cn('border-b border-border/50 hover:bg-muted/50 transition-opacity', {
              'bg-muted/70': isSelected(row),
            })
          }
          getRowStyle={row => {
            const isHoveredFromDag =
              effectiveHoveredItemId !== null &&
              effectiveHoveredItemId !== undefined &&
              row.itemIds.has(effectiveHoveredItemId);
            const isDimmed = hasSelection && !isSelected(row) && !isHoveredFromDag;
            return isDimmed
              ? {
                  // Use an opaque wash instead of row opacity so sticky/group cells do not visually bleed.
                  backgroundColor: 'color-mix(in srgb, hsl(var(--muted)) 55%, hsl(var(--card)))',
                }
              : {};
          }}
        />
      </PivotTableRenderProvider>
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import {
  DataText,
  PivotedStatTable,
  PivotTableToolbar,
  getSchemaStatNames,
  type HoveredStatInfo,
  type PivotedRow,
  type PivotedStatTableSchema,
  type PivotTableInteractionConfig,
  type PivotTableRenderConfig,
} from '@quent/components';
import { useStatGroupTableControls } from '@quent/hooks';
import type { QueryProfileDiffResponse } from '@quent/client';
import { getOperationTypeColor } from '@quent/utils';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import {
  buildMaxAbsByStat,
  buildQueryDiffRows,
  formatSignedDiffValue,
  getDeltaCellStyle,
  type QueryDiffTableRow,
} from './QueryDiffTable.utils';

type IndexKey = 'operator_type' | 'operator';

const DIFF_TABLE_SCHEMA: PivotedStatTableSchema<QueryDiffTableRow> = {
  groups: {
    operator_type: {
      id: row => row.operatorType,
    },
    operator: {
      id: row => row.operatorPairId,
      label: row => row.operatorLabel,
    },
  },
  itemId: row => row.operatorPairId,
  scopeId: row => row.operatorType,
  itemType: row => row.operatorType,
  stats: row => row.stats,
};

const INDEX_ORDER: IndexKey[] = ['operator_type', 'operator'];

const DEFAULT_ENABLED: Record<IndexKey, boolean> = {
  operator_type: true,
  operator: false,
};

const VIRTUALIZATION_CONFIG = { enabled: true, overscan: 12 } as const;

const getOperatorTypeColor = (key: string, id: string): string | undefined =>
  key === 'operator_type' ? getOperationTypeColor(id.toLowerCase()) : undefined;

function OperatorPairCell({ row }: { row: QueryDiffTableRow }) {
  return (
    <div className="grid min-w-[22rem] max-w-[40rem] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 leading-tight">
      <div className="min-w-0">
        <DataText className="block truncate text-xs text-foreground">{row.operatorALabel}</DataText>
        <DataText className="block truncate text-[11px] text-muted-foreground">
          {row.operatorAId}
        </DataText>
      </div>
      <span className="text-[11px] text-muted-foreground">{'<->'}</span>
      <div className="min-w-0">
        <DataText className="block truncate text-xs text-foreground">{row.operatorBLabel}</DataText>
        <DataText className="block truncate text-[11px] text-muted-foreground">
          {row.operatorBId}
        </DataText>
      </div>
    </div>
  );
}

export function QueryDiffTable({ diff }: { diff: QueryProfileDiffResponse }) {
  const rows = useMemo(() => buildQueryDiffRows(diff), [diff]);
  const rowsByOperatorPairId = useMemo(
    () => new Map(rows.map(row => [row.operatorPairId, row])),
    [rows]
  );
  const allStatNames = useMemo(() => getSchemaStatNames(rows, DIFF_TABLE_SCHEMA), [rows]);
  const maxAbsByStat = useMemo(() => buildMaxAbsByStat(rows), [rows]);
  const [hoveredStat, setHoveredStat] = useState<HoveredStatInfo | null>(null);
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;

  const {
    aggMode,
    setAggMode,
    selectedStats,
    orderedStatNames,
    visibleStats,
    visibleIndexOrder,
    activeIndexKeys,
    isAggregating,
    enabledIndices,
    handleToggleIndex,
    handleReorderIndex,
    handleToggleStat,
    handleSelectAllStats,
    handleSelectNoStats,
    sorting,
    setSorting,
  } = useStatGroupTableControls<IndexKey, QueryDiffTableRow>({
    baseIndexOrder: INDEX_ORDER,
    defaultEnabled: DEFAULT_ENABLED,
    allStatNames,
    defaultStatSelector: stats => stats,
    persistKey: 'queryDiffTable',
    rows,
    getRowIndexId: (row, key) => DIFF_TABLE_SCHEMA.groups[key].id(row),
  });

  const indexLabels: Record<IndexKey, React.ReactNode> = useMemo(
    () => ({
      operator_type: 'Operator Type',
      operator: 'Operator Pair',
    }),
    []
  );

  const indexConfig = useMemo(
    () =>
      visibleIndexOrder.map(key => ({
        key,
        label: indexLabels[key],
        enabled: enabledIndices[key],
      })),
    [enabledIndices, indexLabels, visibleIndexOrder]
  );

  const interactionConfig = useMemo(
    (): PivotTableInteractionConfig<PivotedRow> => ({
      hoveredStat,
      setHoveredStat,
      selectedItemIds: new Set<string>(),
    }),
    [hoveredStat]
  );

  const renderConfig = useMemo(
    (): PivotTableRenderConfig => ({
      getGroupTypeColor: getOperatorTypeColor,
      formatGroupCellValue: ({ groupKey }) => {
        if (groupKey.key !== 'operator') return groupKey.label;
        const row = rowsByOperatorPairId.get(groupKey.id);
        return row ? <OperatorPairCell row={row} /> : groupKey.label;
      },
      getDataCellStyle: ({ stat, value }) => getDeltaCellStyle(value, maxAbsByStat.get(stat)),
      formatDataCellValue: ({ stat, value }) => formatSignedDiffValue(value, stat),
    }),
    [maxAbsByStat, rowsByOperatorPairId]
  );

  if (diff.scenario !== 'plans_equal') {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {diff.warnings?.[0] ?? 'Plans are not structurally equal; operator diff is unavailable.'}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No matched operator deltas are available.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-card px-4 py-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Operator Stat Deltas
        </div>
        <div className="text-xs text-muted-foreground">
          <DataText>{diff.query_a.instance_name ?? diff.query_a.id}</DataText>
          {' minus '}
          <DataText>{diff.query_b.instance_name ?? diff.query_b.id}</DataText>
        </div>
      </div>
      <div className="shrink-0 flex flex-col border-b border-border bg-card">
        <PivotTableToolbar
          indexConfig={indexConfig}
          isAggregating={isAggregating}
          aggMode={aggMode}
          orderedStats={orderedStatNames}
          selectedStats={selectedStats}
          onToggleIndex={handleToggleIndex}
          onReorderIndex={handleReorderIndex}
          onSetAggMode={setAggMode}
          onToggleStat={handleToggleStat}
          onSelectAllStats={handleSelectAllStats}
          onSelectNoStats={handleSelectNoStats}
        />
      </div>
      <div className="min-h-0 flex-1">
        <PivotedStatTable
          rows={rows}
          schema={DIFF_TABLE_SCHEMA}
          activeIndices={activeIndexKeys}
          visibleStats={visibleStats}
          isAggregating={isAggregating}
          aggMode={aggMode}
          indexLabels={indexLabels}
          interaction={interactionConfig}
          renderConfig={renderConfig}
          virtualization={VIRTUALIZATION_CONFIG}
          sorting={sorting}
          onSortingChange={setSorting}
          isDark={isDark}
        />
      </div>
    </div>
  );
}

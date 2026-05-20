// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { Triangle } from 'lucide-react';
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
import type { DiffQuerySummary, QueryDiff } from '@quent/client';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import { getQueryDiffOperatorTypeColor } from './QueryDiffColors';
import {
  buildMaxAbsByStat,
  buildQueryDiffRows,
  formatSignedDiffValue,
  getDeltaCellStyle,
  type QueryDiffTableRow,
} from './QueryDiffTable.utils';

type IndexKey = 'engine' | 'operator_type' | 'operator';

const DIFF_TABLE_SCHEMA: PivotedStatTableSchema<QueryDiffTableRow> = {
  groups: {
    engine: {
      id: row => row.engineGroupId,
      label: row => row.engineGroupLabel,
    },
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

const INDEX_ORDER: IndexKey[] = ['engine', 'operator_type', 'operator'];

const DEFAULT_ENABLED: Record<IndexKey, boolean> = {
  engine: false,
  operator_type: true,
  operator: false,
};

const VIRTUALIZATION_CONFIG = { enabled: true, overscan: 12 } as const;

const getOperatorTypeColor = (key: string, id: string): string | undefined =>
  key === 'operator_type' ? getQueryDiffOperatorTypeColor(id) : undefined;

function EngineGroupCell({ engines }: { engines: QueryDiffTableRow['engines'] }) {
  return (
    <div className="min-w-[8rem] space-y-0.5 leading-tight">
      {engines.map(engine => (
        <DataText key={engine.id} className="block text-xs text-foreground">
          {engine.label}
        </DataText>
      ))}
    </div>
  );
}

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

interface QueryDiffTableProps {
  baselineQuery: DiffQuerySummary;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
}

export function QueryDiffTable({ baselineQuery, comparisonQuery, diff }: QueryDiffTableProps) {
  const rows = useMemo(
    () => buildQueryDiffRows(baselineQuery, comparisonQuery, diff),
    [baselineQuery, comparisonQuery, diff]
  );
  const rowsByEngineGroupId = useMemo(
    () => new Map(rows.map(row => [row.engineGroupId, row])),
    [rows]
  );
  const rowsByOperatorPairId = useMemo(
    () => new Map(rows.map(row => [row.operatorPairId, row])),
    [rows]
  );
  const allStatNames = useMemo(() => getSchemaStatNames(rows, DIFF_TABLE_SCHEMA), [rows]);
  const maxAbsByStat = useMemo(() => buildMaxAbsByStat(rows), [rows]);
  const [hoveredStat, setHoveredStat] = useState<HoveredStatInfo | null>(null);
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const paletteTheme = isDark ? 'dark' : 'light';

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
    persistKey: 'queryDiffTable:v3',
    rows,
    getRowIndexId: (row, key) => DIFF_TABLE_SCHEMA.groups[key].id(row),
  });

  const indexLabels: Record<IndexKey, React.ReactNode> = useMemo(
    () => ({
      engine: 'Engine',
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
        if (groupKey.key === 'engine') {
          const row = rowsByEngineGroupId.get(groupKey.id);
          return row ? <EngineGroupCell engines={row.engines} /> : groupKey.label;
        }
        if (groupKey.key !== 'operator') return groupKey.label;
        const row = rowsByOperatorPairId.get(groupKey.id);
        return row ? <OperatorPairCell row={row} /> : groupKey.label;
      },
      getDataCellStyle: ({ stat, value }) =>
        getDeltaCellStyle(value, maxAbsByStat.get(stat), paletteTheme),
      formatDataCellValue: ({ stat, value }) => formatSignedDiffValue(value, stat),
    }),
    [maxAbsByStat, paletteTheme, rowsByEngineGroupId, rowsByOperatorPairId]
  );

  if (diff.compatibility !== 'compatible') {
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
        <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
          <DataText>{baselineQuery.instance_name ?? baselineQuery.id}</DataText>
          <Triangle
            className="h-3 w-3 shrink-0 text-muted-foreground"
            aria-label="delta"
            role="img"
          />
          <DataText>{comparisonQuery.instance_name ?? comparisonQuery.id}</DataText>
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

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { Triangle } from 'lucide-react';
import {
  DataText,
  PivotedStatTable,
  PivotTableToolbar,
  formatStatValue,
  getSchemaStatNames,
  type AggMode,
  type HoveredStatInfo,
  type PivotedRow,
  type PivotedStatTableSchema,
  type PivotTableInteractionConfig,
  type PivotTableRenderConfig,
} from '@quent/components';
import { useStatGroupTableControls } from '@quent/hooks';
import type { DiffQuerySummary, QueryDiff } from '@quent/client';
import type { StatValue } from '@quent/utils';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import { getQueryDiffOperatorTypeColor } from './QueryDiffColors';
import {
  buildMaxAbsByStat,
  buildQueryDiffRows,
  formatSignedDiffValue,
  formatSignedPercentDelta,
  getDeltaCellStyle,
  type QueryDiffTableCellValues,
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
  engine: true,
  operator_type: true,
  operator: false,
};

const VIRTUALIZATION_CONFIG = { enabled: true, estimateRowHeight: 66, overscan: 12 } as const;

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

function aggregateNumericValues(values: number[], aggMode: AggMode): number | null {
  if (values.length === 0) return null;
  switch (aggMode) {
    case 'mean':
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    case 'min':
      return Math.min(...values);
    case 'max':
      return Math.max(...values);
    case 'stdev': {
      if (values.length <= 1) return null;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance =
        values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
      return Math.sqrt(variance);
    }
    case 'sum':
    default:
      return values.reduce((sum, value) => sum + value, 0);
  }
}

function aggregateStatValues(values: StatValue[], aggMode: AggMode): StatValue {
  if (values.length === 0) return null;
  if (values.length === 1) return values[0];

  const numericValues = values.filter((value): value is number => typeof value === 'number');
  if (numericValues.length !== values.length) return null;
  return aggregateNumericValues(numericValues, aggMode);
}

function getPercentDeltaFromValues(baseline: StatValue, comparison: StatValue): number | null {
  if (typeof baseline !== 'number' || typeof comparison !== 'number' || comparison === 0) {
    return null;
  }

  const percentDelta = (comparison - baseline) / Math.abs(comparison);
  return percentDelta === 0 || Object.is(percentDelta, -0) ? 0 : percentDelta;
}

function getTableCellValues({
  row,
  stat,
  value,
  aggMode,
  rowsByOperatorPairId,
}: {
  row: PivotedRow;
  stat: string;
  value: StatValue;
  aggMode: AggMode;
  rowsByOperatorPairId: Map<string, QueryDiffTableRow>;
}): QueryDiffTableCellValues | null {
  const sourceValues = [...row.itemIds]
    .map(itemId => rowsByOperatorPairId.get(itemId)?.statDetails[stat])
    .filter((cellValues): cellValues is QueryDiffTableCellValues => cellValues != null);

  if (sourceValues.length === 0) return null;
  if (sourceValues.length === 1) return sourceValues[0];

  const baseline = aggregateStatValues(
    sourceValues.map(cellValues => cellValues.baseline),
    aggMode
  );
  const comparison = aggregateStatValues(
    sourceValues.map(cellValues => cellValues.comparison),
    aggMode
  );

  return {
    baseline,
    comparison,
    delta: value,
    percentDelta: getPercentDeltaFromValues(baseline, comparison),
  };
}

function QueryDiffDataCell({ values, stat }: { values: QueryDiffTableCellValues; stat: string }) {
  return (
    <div className="flex min-w-[11rem] flex-col gap-0.5 leading-tight">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-[10px] text-muted-foreground uppercase">Baseline</span>
        <span className="text-right font-mono text-[11px] text-foreground">
          {formatStatValue(values.baseline, stat)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-[10px] text-muted-foreground uppercase">Comparison</span>
        <span className="text-right font-mono text-[11px] text-foreground">
          {formatStatValue(values.comparison, stat)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans text-[10px] text-muted-foreground uppercase">Delta</span>
        <span className="text-right font-mono text-xs font-semibold text-foreground">
          {formatSignedDiffValue(values.delta, stat)}
          <span className="ml-1 font-normal text-muted-foreground">
            ({formatSignedPercentDelta(values.percentDelta)})
          </span>
        </span>
      </div>
    </div>
  );
}

export interface QueryDiffTableComparison {
  id: string;
  comparisonQuery: DiffQuerySummary;
  diff: QueryDiff;
}

interface QueryDiffTableProps {
  baselineQuery: DiffQuerySummary;
  comparisons: QueryDiffTableComparison[];
}

function comparisonCountLabel(comparisons: QueryDiffTableComparison[]): string {
  if (comparisons.length === 1) {
    return (
      comparisons[0]?.comparisonQuery.instance_name ?? comparisons[0]?.comparisonQuery.id ?? ''
    );
  }
  return `${comparisons.length} comparison queries`;
}

export function QueryDiffTable({ baselineQuery, comparisons }: QueryDiffTableProps) {
  const rows = useMemo(
    () =>
      comparisons.flatMap(comparison =>
        comparison.diff.compatibility === 'compatible'
          ? buildQueryDiffRows(
              baselineQuery,
              comparison.comparisonQuery,
              comparison.diff,
              comparison.id
            )
          : []
      ),
    [baselineQuery, comparisons]
  );
  const incompatibleDiffs = useMemo(
    () => comparisons.filter(comparison => comparison.diff.compatibility !== 'compatible'),
    [comparisons]
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
    filterIndexOrder: indexOrder => ['engine', ...indexOrder.filter(key => key !== 'engine')],
    persistKey: 'queryDiffTable:v4',
    rows,
    getRowIndexId: (row, key) => DIFF_TABLE_SCHEMA.groups[key].id(row),
  });

  const indexLabels: Record<IndexKey, React.ReactNode> = useMemo(
    () => ({
      engine: 'Comparison Engine',
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
        enabled: key === 'engine' || enabledIndices[key],
        locked: key === 'engine',
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
      formatDataCellValue: ({ row, stat, value, aggMode }) => {
        const cellValues = getTableCellValues({
          row,
          stat,
          value,
          aggMode,
          rowsByOperatorPairId,
        });
        return cellValues ? (
          <QueryDiffDataCell values={cellValues} stat={stat} />
        ) : (
          formatSignedDiffValue(value, stat)
        );
      },
    }),
    [maxAbsByStat, paletteTheme, rowsByEngineGroupId, rowsByOperatorPairId]
  );

  if (comparisons.length > 0 && incompatibleDiffs.length === comparisons.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        {incompatibleDiffs[0]?.diff.warnings?.[0] ??
          'Plans are not structurally equal; operator diff is unavailable.'}
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
          <DataText>{comparisonCountLabel(comparisons)}</DataText>
          {incompatibleDiffs.length > 0 && (
            <span className="ml-2 text-muted-foreground">
              {incompatibleDiffs.length} incompatible comparison
              {incompatibleDiffs.length === 1 ? '' : 's'} omitted
            </span>
          )}
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

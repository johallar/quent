// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, useState } from 'react';
import { PivotedStatTable } from '@/components/pivot-table/PivotedStatTable';
import { OptionMultiSelect } from '@/components/ui/OptionMultiSelect';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { AggMode, PivotedStatTableSchema } from '@/components/pivot-table/types';
import type { StatValue } from '@/services/query-plan/types';
import { cn } from '@/lib/utils';
import { CAR_COLUMNS, CAR_ROWS, isNumericColumn, type CarRow } from './data';

/** Each row needs a stable identity for the pivot table's hover/select logic. */
type IndexedCarRow = CarRow & { __id: string };

const ROWS: ReadonlyArray<IndexedCarRow> = CAR_ROWS.map((row, i) => ({
  ...row,
  __id: `car-${i}`,
}));

/**
 * A "pivot option" here is any column the user can either group by, or pull
 * into the value area of the pivot. Every column qualifies for both — the
 * cell renderer handles strings (categorical) and numbers (numeric heatmap)
 * uniformly.
 */
const ALL_COLUMNS: ReadonlyArray<keyof CarRow> = CAR_COLUMNS;
const ALL_COLUMN_KEYS: ReadonlyArray<string> = ALL_COLUMNS.map(c => String(c));

const DEFAULT_GROUP_BY: ReadonlyArray<string> = ['Brand', 'Fuel_Type'];
const DEFAULT_VALUE_COLUMNS: ReadonlyArray<string> = ['Year', 'Mileage', 'Engine_Size', 'Price'];

/**
 * Build a generic schema that maps every column into both a group dimension
 * and a stat. The pivot table's renderer formats numeric values with a
 * gradient and renders strings as plain labels, so a single schema handles
 * the whole dataset.
 */
function buildSchema(): PivotedStatTableSchema<IndexedCarRow> {
  const groups: PivotedStatTableSchema<IndexedCarRow>['groups'] = {};
  for (const col of ALL_COLUMNS) {
    const key = String(col);
    groups[key] = {
      id: row => String(row[col]),
      label: row => String(row[col]),
    };
  }
  return {
    groups,
    itemId: row => row.__id,
    scopeId: row => row.__id,
    stats: row => {
      const out: Record<string, StatValue> = {};
      for (const col of ALL_COLUMNS) {
        out[String(col)] = row[col] as StatValue;
      }
      return out;
    },
  };
}

const SCHEMA = buildSchema();

export function CarsPivotTable() {
  const [activeIndices, setActiveIndices] = useState<string[]>([...DEFAULT_GROUP_BY]);
  const [selectedValueCols, setSelectedValueCols] = useState<Set<string>>(
    () => new Set(DEFAULT_VALUE_COLUMNS)
  );
  const [isAggregating, setIsAggregating] = useState(true);
  const [aggMode, setAggMode] = useState<AggMode>('mean');

  // Stat columns are simply "selected" minus whatever is already a group-by.
  // Hiding the active group-bys keeps the value area readable.
  const visibleStats = useMemo(() => {
    const groupSet = new Set(activeIndices);
    return ALL_COLUMN_KEYS.filter(c => selectedValueCols.has(c) && !groupSet.has(c));
  }, [selectedValueCols, activeIndices]);

  const toggleIndex = useCallback((key: string) => {
    setActiveIndices(prev => (prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]));
  }, []);

  const toggleValueCol = useCallback((key: string) => {
    setSelectedValueCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectAllValueCols = useCallback(() => {
    setSelectedValueCols(new Set(ALL_COLUMN_KEYS));
  }, []);

  const selectNoValueCols = useCallback(() => {
    setSelectedValueCols(new Set());
  }, []);

  const indexLabels = useMemo(
    () => Object.fromEntries(activeIndices.map(k => [k, k])),
    [activeIndices]
  );

  return (
    <div className="flex flex-col h-full bg-card text-foreground isolate">
      {/*
        The toolbar wraps two header rows (group-by chips + column multiselect).
        It sits in its own stacking context above the table so popovers,
        wrapping badges, and focus outlines paint above the sticky table header
        below — never under it.
      */}
      <div className="relative z-20 shrink-0 border-b border-border bg-card">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <span className="text-xs text-muted-foreground shrink-0">Group by:</span>
          {ALL_COLUMN_KEYS.map(col => {
            const enabled = activeIndices.includes(col);
            return (
              <button
                key={col}
                onClick={() => toggleIndex(col)}
                className={cn(
                  'text-xs px-2 py-0.5 rounded border transition-colors select-none whitespace-nowrap',
                  enabled
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-muted/50 border-border text-muted-foreground hover:border-primary/30'
                )}
              >
                {col}
                {isNumericColumn(col as keyof CarRow) && (
                  <span className="ml-1 text-[10px] opacity-60">#</span>
                )}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={isAggregating}
                onChange={e => setIsAggregating(e.target.checked)}
              />
              Aggregate
            </label>
            {isAggregating && (
              <>
                <span className="text-xs text-muted-foreground shrink-0">Aggregate:</span>
                <Select value={aggMode} onValueChange={value => setAggMode(value as AggMode)}>
                  <SelectTrigger className="h-7 w-[110px] rounded border border-input px-2 py-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="start">
                    {(['sum', 'mean', 'min', 'max', 'stdev'] as AggMode[]).map(mode => (
                      <SelectItem key={mode} value={mode} className="text-xs">
                        {mode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
        <OptionMultiSelect
          label="Columns"
          triggerText="Select Columns"
          options={[...ALL_COLUMN_KEYS]}
          selectedOptionIds={selectedValueCols}
          onToggleOption={toggleValueCol}
          onSelectAllOptions={selectAllValueCols}
          onSelectNoOptions={selectNoValueCols}
          searchPlaceholder="Search columns…"
          emptyMessage="No columns found"
          noneSelectedText="No value columns selected"
        />
      </div>
      <div className="relative z-0 flex-1 min-h-0">
        {activeIndices.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Pick at least one column to group by.
          </div>
        ) : visibleStats.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
            Pick at least one value column.
          </div>
        ) : (
          <PivotedStatTable<IndexedCarRow>
            rows={[...ROWS]}
            schema={SCHEMA}
            activeIndices={activeIndices}
            visibleStats={visibleStats}
            isAggregating={isAggregating}
            aggMode={aggMode}
            indexLabels={indexLabels}
            virtualization={{ enabled: false }}
          />
        )}
      </div>
    </div>
  );
}

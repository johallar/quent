// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo, type ReactNode } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { OptionMultiSelect, type OptionMultiSelectItem } from '../ui/option-multi-select';
import type { AggMode } from './types';

export interface IndexConfigEntry {
  key: string;
  label: ReactNode;
  /** Compact label shown in the selected-badge. Defaults to `label`. */
  badgeLabel?: ReactNode;
  enabled: boolean;
}

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
}

export function PivotTableToolbar({
  indexConfig,
  isAggregating,
  aggMode,
  orderedStats,
  selectedStats,
  onToggleIndex,
  onReorderIndex,
  onSetAggMode,
  onToggleStat,
  onSelectAllStats,
  onSelectNoStats,
}: PivotTableToolbarProps) {
  const indexOptions = useMemo<OptionMultiSelectItem[]>(
    () =>
      indexConfig.map(entry => ({
        id: entry.key,
        label: entry.label,
        badgeLabel: entry.badgeLabel ?? entry.label,
      })),
    [indexConfig]
  );

  const selectedIndexIds = useMemo(
    () => new Set(indexConfig.filter(entry => entry.enabled).map(entry => entry.key)),
    [indexConfig]
  );

  const handleSelectAllIndices = useCallback(() => {
    for (const entry of indexConfig) {
      if (!entry.enabled) onToggleIndex(entry.key);
    }
  }, [indexConfig, onToggleIndex]);

  const handleSelectNoIndices = useCallback(() => {
    for (const entry of indexConfig) {
      if (entry.enabled) onToggleIndex(entry.key);
    }
  }, [indexConfig, onToggleIndex]);

  const handleReorderIndexOption = useCallback(
    (fromKey: string, toKey: string, position: 'before' | 'after') => {
      if (fromKey === toKey) return;
      const keys = indexConfig.map(entry => entry.key);
      const fromIndex = keys.indexOf(fromKey);
      const targetIndex = keys.indexOf(toKey);
      if (fromIndex < 0 || targetIndex < 0) return;

      let anchorKey = toKey;
      if (position === 'before' && fromIndex < targetIndex) {
        anchorKey = keys[targetIndex - 1] ?? toKey;
      } else if (position === 'after' && fromIndex > targetIndex) {
        anchorKey = keys[targetIndex + 1] ?? toKey;
      }
      if (anchorKey === fromKey) return;
      onReorderIndex(fromKey, anchorKey);
    },
    [indexConfig, onReorderIndex]
  );

  return (
    <>
      <OptionMultiSelect
        label="Group by"
        triggerText="Select Group By"
        options={indexOptions}
        selectedOptionIds={selectedIndexIds}
        onToggleOption={onToggleIndex}
        onSelectAllOptions={handleSelectAllIndices}
        onSelectNoOptions={handleSelectNoIndices}
        onReorderOption={handleReorderIndexOption}
        searchPlaceholder="Search groups…"
        emptyMessage="No groups"
        noneSelectedText="No grouping"
        wrapperClassName="flex items-center gap-1 px-3 py-1.5"
        trailing={
          <div className="ml-auto flex items-center gap-2 pl-2">
            <span className="text-xs text-muted-foreground shrink-0">Aggregate:</span>
            <Select
              value={isAggregating ? aggMode : '--'}
              onValueChange={value => onSetAggMode(value as AggMode)}
              disabled={!isAggregating}
            >
              <SelectTrigger className="h-7 w-[110px] rounded border border-input px-2 py-0 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                {!isAggregating && (
                  <SelectItem value="--" className="text-xs" disabled>
                    --
                  </SelectItem>
                )}
                {(['sum', 'mean', 'min', 'max', 'stdev'] as AggMode[]).map(mode => (
                  <SelectItem key={mode} value={mode} className="text-xs">
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
      />
      <OptionMultiSelect
        label="Columns"
        triggerText="Select Columns"
        options={orderedStats}
        selectedOptionIds={selectedStats}
        onToggleOption={onToggleStat}
        onSelectAllOptions={onSelectAllStats}
        onSelectNoOptions={onSelectNoStats}
        searchPlaceholder="Search columns…"
        emptyMessage="No columns found"
        noneSelectedText="None selected"
      />
    </>
  );
}

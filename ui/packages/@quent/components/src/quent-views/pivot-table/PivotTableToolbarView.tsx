// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { cn, AGG_MODES } from '@quent/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { OptionMultiSelect } from '../../ui/option-multi-select';
import type { AggMode, PivotTableDragDropConfig } from './types';

export interface IndexConfigEntry {
  key: string;
  label: React.ReactNode;
  enabled: boolean;
}

export interface PivotTableToolbarViewProps {
  indexConfig: IndexConfigEntry[];
  isAggregating: boolean;
  aggMode: AggMode;
  orderedStats: string[];
  selectedStats: Set<string> | null;
  onToggleIndex: (key: string) => void;
  onSetAggMode: (mode: AggMode) => void;
  onToggleStat: (stat: string) => void;
  onSelectAllStats: () => void;
  onSelectNoStats: () => void;
  getStatLabel?: (stat: string) => string;
  getStatTitle?: (stat: string) => string;
  dragDrop: PivotTableDragDropConfig<HTMLButtonElement>;
}

export function PivotTableToolbarView({
  indexConfig,
  isAggregating,
  aggMode,
  orderedStats,
  selectedStats,
  onToggleIndex,
  onSetAggMode,
  onToggleStat,
  onSelectAllStats,
  onSelectNoStats,
  getStatLabel,
  getStatTitle,
  dragDrop,
}: PivotTableToolbarViewProps) {
  const statOptions = useMemo(
    () =>
      orderedStats.map(stat => ({
        value: stat,
        label: getStatLabel?.(stat) ?? stat,
        title: getStatTitle?.(stat),
      })),
    [orderedStats, getStatLabel, getStatTitle]
  );

  return (
    <>
      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="text-xs text-muted-foreground shrink-0">Group by:</span>
        {indexConfig.map(({ key, label, enabled }) => {
          const dropPosition = dragDrop.getDropTargetPosition?.(key);
          const dropIndicatorStyle = dropPosition
            ? {
                boxShadow:
                  dropPosition === 'before'
                    ? 'inset 3px 0 0 hsl(var(--primary))'
                    : 'inset -3px 0 0 hsl(var(--primary))',
              }
            : undefined;
          return (
            <button
              key={key}
              draggable
              onDragStart={e => dragDrop.onDragStart(e, key)}
              onDragOver={e => dragDrop.onDragOver(e, key)}
              onDragLeave={e => dragDrop.onDragLeave(e, key)}
              onDrop={e => dragDrop.onDrop(e, key)}
              onDragEnd={dragDrop.onDragEnd}
              onClick={() => onToggleIndex(key)}
              aria-pressed={enabled}
              className={cn(
                'text-xs px-2 py-0.5 rounded border transition-colors cursor-pointer active:cursor-grabbing select-none whitespace-nowrap h-full',
                {
                  'bg-muted/40 border-primary/40 text-foreground': enabled,
                  'bg-muted/20 border-border text-muted-foreground': !enabled,
                  'opacity-45': dragDrop.draggedId === key,
                }
              )}
              style={dropIndicatorStyle}
            >
              {label}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
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
              {AGG_MODES.filter(mode => mode !== 'value').map(mode => (
                <SelectItem key={mode} value={mode} className="text-xs">
                  {mode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <OptionMultiSelect
        label="Columns"
        triggerText="Select Columns"
        options={statOptions}
        selectedOptionIds={selectedStats}
        onToggleOption={onToggleStat}
        onSelectAllOptions={onSelectAllStats}
        onSelectNoOptions={onSelectNoStats}
        searchPlaceholder="Search columns…"
        emptyMessage="No columns found"
        noneSelectedText="None selected"
        optionClassName="font-mono"
      />
    </>
  );
}

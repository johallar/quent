// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@quent/utils';
import { Button } from '../ui/button';
import { DataText } from '../ui/data-text';
import { Input } from '../ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import {
  StatisticMiniBarChart,
  type StatisticMiniBarChartProps,
  type StatisticMiniBarChartRow,
} from './StatisticCard';

export interface MultiStatStackedBarChartProps {
  rows: StatisticMiniBarChartRow[];
  statNames: string[];
  selectedStat: string;
  onSelectedStatChange: (statName: string) => void;
  statLabel?: ReactNode;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  chartClassName?: string;
  maxRows?: number;
  formatValue?: StatisticMiniBarChartProps['formatValue'];
  formatDeltaValue?: StatisticMiniBarChartProps['formatDeltaValue'];
  formatPercentDelta?: StatisticMiniBarChartProps['formatPercentDelta'];
  getRelativeValueStyle?: StatisticMiniBarChartProps['getRelativeValueStyle'];
  tooltipTitleSuffix?: StatisticMiniBarChartProps['tooltipTitleSuffix'];
}

function MultiStatSelect({
  statNames,
  value,
  onValueChange,
  label,
  searchPlaceholder,
  emptyMessage,
}: {
  statNames: string[];
  value: string;
  onValueChange: (statName: string) => void;
  label: ReactNode;
  searchPlaceholder: string;
  emptyMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const filteredStatNames = useMemo(() => {
    if (!search) return statNames;
    const needle = search.toLowerCase();
    return statNames.filter(statName => statName.toLowerCase().includes(needle));
  }, [search, statNames]);

  return (
    <div className="flex items-center justify-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Popover
        open={open}
        onOpenChange={nextOpen => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="h-7 min-w-40 justify-between gap-2 px-2 text-xs font-normal"
          >
            <DataText className="truncate">{value}</DataText>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="center" side="bottom">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              className="h-7 pl-7 pr-2 text-xs md:text-xs"
              placeholder={searchPlaceholder}
              value={search}
              onChange={event => setSearch(event.target.value)}
              autoFocus
            />
          </div>
          <div role="listbox" className="max-h-52 space-y-0.5 overflow-y-auto">
            {filteredStatNames.map(statName => {
              const selected = statName === value;
              return (
                <button
                  key={statName}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onValueChange(statName);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={cn(
                    'flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-left text-xs font-mono outline-none',
                    'transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:text-accent-foreground',
                    selected && 'bg-accent text-accent-foreground'
                  )}
                >
                  <Check
                    className={cn('size-3 shrink-0', selected ? 'opacity-100' : 'opacity-0')}
                    strokeWidth={3}
                  />
                  <span className="truncate">{statName}</span>
                </button>
              );
            })}
            {filteredStatNames.length === 0 && (
              <p className="py-2 text-center text-xs text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function MultiStatStackedBarChart({
  rows,
  statNames,
  selectedStat,
  onSelectedStatChange,
  statLabel = 'Stat',
  searchPlaceholder = 'Search stats...',
  emptyMessage = 'No stats found',
  className,
  chartClassName,
  maxRows,
  formatValue,
  formatDeltaValue,
  formatPercentDelta,
  getRelativeValueStyle,
  tooltipTitleSuffix = selectedStat,
}: MultiStatStackedBarChartProps) {
  return (
    <div className={cn('flex h-full min-h-0 flex-col gap-2', className)}>
      <MultiStatSelect
        statNames={statNames}
        value={selectedStat}
        onValueChange={onSelectedStatChange}
        label={statLabel}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
      />
      <StatisticMiniBarChart
        rows={rows}
        maxRows={maxRows ?? rows.length}
        formatValue={formatValue}
        formatDeltaValue={formatDeltaValue}
        formatPercentDelta={formatPercentDelta}
        getRelativeValueStyle={getRelativeValueStyle}
        tooltipTitleSuffix={tooltipTitleSuffix}
        className={cn('min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:thin]', chartClassName)}
      />
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { ChartNoAxesCombined } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@quent/components';
import { cn } from '@quent/utils';
import type { ResourceChartType } from '@/lib/resourceCharts';

const CHART_LABELS: Record<ResourceChartType, string> = {
  operators: 'Operators',
  entities: 'Entities',
};

type ResourceChartMenuProps = {
  resourceLabel: string;
  availableCharts: ResourceChartType[];
  selectedCharts: ResourceChartType[];
  onSelectionChange: (charts: ResourceChartType[]) => void;
};

export function ResourceChartMenu({
  resourceLabel,
  availableCharts,
  selectedCharts,
  onSelectionChange,
}: ResourceChartMenuProps) {
  const selectedCount = availableCharts.filter(chart => selectedCharts.includes(chart)).length;

  const setSelected = (chart: ResourceChartType, selected: boolean) => {
    const next = new Set(selectedCharts);
    if (selected) next.add(chart);
    else next.delete(chart);
    onSelectionChange(availableCharts.filter(candidate => next.has(candidate)));
  };

  return (
    <div
      className="shrink-0"
      onClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()}
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={`Choose charts for ${resourceLabel}`}
            title="Choose charts"
            className={cn(
              'inline-flex h-5 min-w-7 cursor-pointer items-center justify-center gap-1 rounded-sm border border-border px-1 text-[10px] transition-colors',
              selectedCount > 0
                ? 'bg-muted text-foreground hover:bg-accent'
                : 'bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <ChartNoAxesCombined className="h-3 w-3" />
            {selectedCount > 0 && <span className="font-semibold">{selectedCount}</span>}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs">Charts</DropdownMenuLabel>
          {availableCharts.map(chart => (
            <DropdownMenuCheckboxItem
              key={chart}
              checked={selectedCharts.includes(chart)}
              onCheckedChange={checked => setSelected(chart, checked === true)}
              onSelect={event => event.preventDefault()}
              className="text-xs"
            >
              {CHART_LABELS[chart]}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

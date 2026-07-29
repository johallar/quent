// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { ChartNoAxesCombined } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@quent/components';
import type { ResourceChartAggregateState, ResourceChartType } from '@/lib/resourceCharts';

const CHART_LABELS: Record<ResourceChartType, string> = {
  operators: 'Operators',
  entities: 'Entities',
};

type ResourceChartGlobalMenuProps = {
  availableCharts: ResourceChartType[];
  chartStates: Record<ResourceChartType, ResourceChartAggregateState>;
  onToggleChart: (chart: ResourceChartType, selected: boolean) => void;
  onShowAll: () => void;
  onHideAll: () => void;
};

export function ResourceChartGlobalMenu({
  availableCharts,
  chartStates,
  onToggleChart,
  onShowAll,
  onHideAll,
}: ResourceChartGlobalMenuProps) {
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
            aria-label="Charts on all resource rows"
            title="Charts on all resource rows"
            className="inline-flex h-5 cursor-pointer items-center justify-center gap-1 rounded-sm border border-border bg-transparent px-1.5 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground mr-2"
          >
            <ChartNoAxesCombined className="h-3 w-3" />
            <span className="font-semibold">All</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs">Charts on all resource rows</DropdownMenuLabel>
          {availableCharts.map(chart => {
            const state = chartStates[chart];
            return (
              <DropdownMenuCheckboxItem
                key={chart}
                checked={state === 'mixed' ? 'indeterminate' : state === 'all'}
                onSelect={event => {
                  event.preventDefault();
                  onToggleChart(chart, state !== 'all');
                }}
                className="text-xs"
              >
                {CHART_LABELS[chart]}
              </DropdownMenuCheckboxItem>
            );
          })}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-xs" onSelect={onShowAll}>
            Show all
          </DropdownMenuItem>
          <DropdownMenuItem className="text-xs" onSelect={onHideAll}>
            Hide all
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

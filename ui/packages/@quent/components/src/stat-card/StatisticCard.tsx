// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@quent/utils';
import { DataText } from '../ui/data-text';

export type StatisticCardValueTone = 'positive' | 'negative' | 'neutral';

export interface StatisticCardComparison {
  id: string;
  label: ReactNode;
  value: ReactNode;
  color?: string;
}

export interface StatisticCardProps {
  title: ReactNode;
  value?: ReactNode;
  valueTone?: StatisticCardValueTone;
  valueStyle?: CSSProperties;
  secondaryValue?: ReactNode;
  comparisons?: StatisticCardComparison[];
  comparisonSeparator?: ReactNode;
  chart?: ReactNode;
  chartLabel?: ReactNode;
  valueClassName?: string;
  className?: string;
}

export interface StatisticMiniBarChartBar {
  id: string;
  value: number;
  color: string;
  label?: string;
}

export interface StatisticMiniBarChartRow {
  id: string;
  label: ReactNode;
  bars: StatisticMiniBarChartBar[];
  title?: string;
  labelColor?: string;
}

export interface StatisticMiniBarChartProps {
  rows: StatisticMiniBarChartRow[];
  maxRows?: number;
  className?: string;
}

function valueToneClassName(tone: StatisticCardValueTone): string {
  switch (tone) {
    case 'positive':
      return 'text-emerald-600 dark:text-emerald-400';
    case 'negative':
      return 'text-destructive';
    case 'neutral':
      return 'text-muted-foreground';
  }
}

function valueBarWidth(value: number, maxValue: number): string {
  if (maxValue <= 0) return '0%';
  return `${Math.max(2, (Math.max(0, value) / maxValue) * 100)}%`;
}

export function StatisticMiniBarChart({
  rows,
  maxRows = 5,
  className,
}: StatisticMiniBarChartProps) {
  const visibleRows = rows.slice(0, maxRows);
  const maxValue = Math.max(
    ...visibleRows.flatMap(row => row.bars.map(bar => Math.max(0, bar.value))),
    0
  );

  return (
    <div className={cn('space-y-1', className)}>
      {visibleRows.map(row => (
        <div
          key={row.id}
          className="grid min-w-0 grid-cols-[minmax(5rem,7rem)_minmax(0,1fr)] items-center gap-2"
        >
          <DataText
            className="truncate text-[11px] text-muted-foreground"
            style={{ color: row.labelColor }}
          >
            {row.label}
          </DataText>
          <div className="min-w-0 space-y-0.5" title={row.title}>
            {row.bars.map(bar => (
              <div key={bar.id} className="h-1 bg-muted" aria-label={bar.label}>
                <div
                  className="h-full"
                  style={{ width: valueBarWidth(bar.value, maxValue), backgroundColor: bar.color }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatisticCard({
  title,
  value,
  valueTone = 'neutral',
  valueStyle,
  secondaryValue,
  comparisons = [],
  comparisonSeparator,
  chart,
  chartLabel,
  valueClassName,
  className,
}: StatisticCardProps) {
  const hasValue = value != null;
  const hasSupportingContent = comparisons.length > 0 || chart != null;

  return (
    <section
      className={cn(
        'grid min-h-24 min-w-0 gap-1 border-r border-border px-4 py-1.5 last:border-r-0 [container-type:inline-size]',
        hasValue ? 'grid-rows-[auto_minmax(2.75rem,1fr)_auto]' : 'grid-rows-[auto_minmax(0,1fr)]',
        className
      )}
    >
      <div className="grid min-w-0 place-items-center gap-1 text-center">
        <div className="min-w-0">
          <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
        </div>
        {secondaryValue != null && (
          <div className="text-[11px] text-muted-foreground tabular-nums">{secondaryValue}</div>
        )}
      </div>

      {hasValue && (
        <div
          className={cn(
            'flex min-h-0 min-w-0 items-center justify-center text-center',
            !hasSupportingContent && 'row-span-2'
          )}
        >
          <div
            className={cn(
              'max-w-full overflow-hidden text-ellipsis whitespace-nowrap font-semibold leading-none tabular-nums text-[clamp(1.375rem,12cqi,3.5rem)]',
              valueToneClassName(valueTone),
              valueClassName
            )}
            style={valueStyle}
          >
            {value}
          </div>
        </div>
      )}

      {hasSupportingContent && (
        <div className={cn('min-w-0', hasValue ? 'self-end' : 'min-h-0 self-stretch')}>
          {comparisons.length > 0 && (
            <div className="flex min-w-0 items-center justify-center gap-3 text-center">
              {comparisons.map((comparison, index) => (
                <div key={comparison.id} className="contents">
                  {index > 0 && comparisonSeparator && (
                    <div className="shrink-0">{comparisonSeparator}</div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                      {comparison.color && (
                        <span
                          className="h-2 w-2 shrink-0"
                          style={{ backgroundColor: comparison.color }}
                        />
                      )}
                      <DataText className="truncate">{comparison.label}</DataText>
                    </div>
                    <div className="truncate text-sm font-medium tabular-nums">
                      {comparison.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {chart && (
            <div
              className={cn(
                !hasValue && comparisons.length === 0 && 'h-full min-h-0',
                (hasValue || comparisons.length > 0) && 'border-t border-border pt-1.5',
                comparisons.length > 0 && 'mt-1.5'
              )}
            >
              {chartLabel && (
                <div className="mb-1 text-center text-[11px] font-medium text-muted-foreground">
                  {chartLabel}
                </div>
              )}
              {chart}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

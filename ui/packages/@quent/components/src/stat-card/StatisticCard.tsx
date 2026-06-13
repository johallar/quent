// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  details?: StatisticMiniBarChartBarDetail[];
  deltaValue?: number;
  percentDelta?: number | null;
}

export interface StatisticMiniBarChartBarDetail {
  id: string;
  label: ReactNode;
  value: ReactNode;
}

export interface StatisticMiniBarChartRow {
  id: string;
  label: ReactNode;
  bars: StatisticMiniBarChartBar[];
  title?: string;
  labelColor?: string;
}

export type StatisticMiniBarChartValueFormatter = (
  value: number,
  bar: StatisticMiniBarChartBar,
  row: StatisticMiniBarChartRow
) => ReactNode;

export type StatisticMiniBarChartPercentDeltaFormatter = (
  percentDelta: number | null,
  bar: StatisticMiniBarChartBar,
  row: StatisticMiniBarChartRow
) => ReactNode;

export type StatisticMiniBarChartRelativeValueStyle = (
  value: number | null,
  bar: StatisticMiniBarChartBar,
  row: StatisticMiniBarChartRow
) => CSSProperties | undefined;

export interface StatisticMiniBarChartProps {
  rows: StatisticMiniBarChartRow[];
  maxRows?: number;
  className?: string;
  tooltipTitleSuffix?: ReactNode;
  formatValue?: StatisticMiniBarChartValueFormatter;
  formatDeltaValue?: StatisticMiniBarChartValueFormatter;
  formatPercentDelta?: StatisticMiniBarChartPercentDeltaFormatter;
  getRelativeValueStyle?: StatisticMiniBarChartRelativeValueStyle;
}

interface StatisticMiniBarChartHover {
  row: StatisticMiniBarChartRow;
  clientX: number;
  clientY: number;
}

const MINI_BAR_TOOLTIP_POINTER_OFFSET = 12;
const MINI_BAR_TOOLTIP_VIEWPORT_MARGIN = 4;

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

function defaultFormatMiniBarChartValue(value: number): ReactNode {
  return value.toLocaleString();
}

function defaultFormatMiniBarChartDeltaValue(value: number): ReactNode {
  if (value === 0 || Object.is(value, -0)) return '0';
  const formatted = Math.abs(value).toLocaleString();
  return value > 0 ? `+${formatted}` : `-${formatted}`;
}

function defaultFormatMiniBarChartPercentDelta(percentDelta: number | null): ReactNode {
  if (percentDelta === null) return '-';
  if (percentDelta === 0 || Object.is(percentDelta, -0)) return '0.0%';
  const formatted = `${Math.abs(percentDelta * 100).toFixed(1)}%`;
  return percentDelta > 0 ? `+${formatted}` : `-${formatted}`;
}

function StatisticMiniBarChartTooltip({
  row,
  formatValue,
  formatDeltaValue,
  formatPercentDelta,
  getRelativeValueStyle,
  tooltipTitleSuffix,
}: {
  row: StatisticMiniBarChartRow;
  formatValue: StatisticMiniBarChartValueFormatter;
  formatDeltaValue: StatisticMiniBarChartValueFormatter;
  formatPercentDelta: StatisticMiniBarChartPercentDeltaFormatter;
  getRelativeValueStyle?: StatisticMiniBarChartRelativeValueStyle;
  tooltipTitleSuffix?: ReactNode;
}) {
  const showComparisonColumns = row.bars.some(
    bar => bar.deltaValue !== undefined || bar.percentDelta !== undefined
  );

  return (
    <div className="min-w-0 space-y-2">
      <div className="flex min-w-0 items-baseline gap-1 text-xs font-medium">
        <DataText className="truncate">{row.label}</DataText>
        {tooltipTitleSuffix != null && (
          <span className="shrink-0 text-muted-foreground">
            (<DataText>{tooltipTitleSuffix}</DataText>)
          </span>
        )}
      </div>
      <div
        className={cn(
          'grid min-w-0 gap-x-3 gap-y-1.5',
          showComparisonColumns
            ? 'grid-cols-[minmax(0,1fr)_auto_auto_auto]'
            : 'grid-cols-[minmax(0,1fr)_auto]'
        )}
      >
        {row.bars.map(bar => {
          return (
            <div key={bar.id} className="contents">
              <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 self-center">
                <span
                  className="row-span-2 h-full min-h-5 w-1 rounded-full"
                  style={{ backgroundColor: bar.color }}
                />
                <DataText className="truncate text-xs text-muted-foreground">
                  {bar.label ?? bar.id}
                </DataText>
                {bar.details && bar.details.length > 0 && (
                  <div className="col-start-2 mt-0.5 flex min-w-0 flex-col text-[10px] leading-3 text-muted-foreground">
                    {bar.details.map(detail => (
                      <div key={detail.id} className="contents">
                        <DataText className="truncate">{detail.value}</DataText>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <DataText className="block self-center text-right text-xs font-medium tabular-nums">
                {formatValue(bar.value, bar, row)}
              </DataText>
              {showComparisonColumns && (
                <>
                  <DataText
                    className="block self-center text-right text-xs text-muted-foreground tabular-nums"
                    style={
                      bar.deltaValue !== undefined
                        ? getRelativeValueStyle?.(bar.deltaValue, bar, row)
                        : undefined
                    }
                  >
                    {bar.deltaValue !== undefined
                      ? formatDeltaValue(bar.deltaValue, bar, row)
                      : null}
                  </DataText>
                  <DataText
                    className="block self-center text-right text-xs text-muted-foreground tabular-nums"
                    style={
                      bar.percentDelta !== undefined
                        ? getRelativeValueStyle?.(bar.percentDelta, bar, row)
                        : undefined
                    }
                  >
                    {bar.percentDelta !== undefined
                      ? formatPercentDelta(bar.percentDelta, bar, row)
                      : null}
                  </DataText>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PositionedStatisticMiniBarChartTooltip({
  hover,
  formatValue,
  formatDeltaValue,
  formatPercentDelta,
  getRelativeValueStyle,
  tooltipTitleSuffix,
}: {
  hover: StatisticMiniBarChartHover;
  formatValue: StatisticMiniBarChartValueFormatter;
  formatDeltaValue: StatisticMiniBarChartValueFormatter;
  formatPercentDelta: StatisticMiniBarChartPercentDeltaFormatter;
  getRelativeValueStyle?: StatisticMiniBarChartRelativeValueStyle;
  tooltipTitleSuffix?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: hover.clientX + MINI_BAR_TOOLTIP_POINTER_OFFSET,
    top: hover.clientY + MINI_BAR_TOOLTIP_POINTER_OFFSET,
  });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let left = hover.clientX + MINI_BAR_TOOLTIP_POINTER_OFFSET;
    let top = hover.clientY + MINI_BAR_TOOLTIP_POINTER_OFFSET;

    if (left + rect.width + MINI_BAR_TOOLTIP_VIEWPORT_MARGIN > viewportWidth) {
      left = Math.max(
        MINI_BAR_TOOLTIP_VIEWPORT_MARGIN,
        hover.clientX - rect.width - MINI_BAR_TOOLTIP_POINTER_OFFSET
      );
    }

    if (top + rect.height + MINI_BAR_TOOLTIP_VIEWPORT_MARGIN > viewportHeight) {
      top = Math.max(
        MINI_BAR_TOOLTIP_VIEWPORT_MARGIN,
        hover.clientY - rect.height - MINI_BAR_TOOLTIP_POINTER_OFFSET
      );
    }

    setPosition({ left, top });
  }, [hover.clientX, hover.clientY, hover.row]);

  return createPortal(
    <div
      ref={hostRef}
      className="z-50 w-80 max-w-[calc(100vw-2rem)] rounded-md border bg-popover p-3 text-popover-foreground shadow-md"
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        pointerEvents: 'none',
      }}
    >
      <StatisticMiniBarChartTooltip
        row={hover.row}
        formatValue={formatValue}
        formatDeltaValue={formatDeltaValue}
        formatPercentDelta={formatPercentDelta}
        getRelativeValueStyle={getRelativeValueStyle}
        tooltipTitleSuffix={tooltipTitleSuffix}
      />
    </div>,
    document.body
  );
}

export function StatisticMiniBarChart({
  rows,
  maxRows = 5,
  className,
  formatValue = defaultFormatMiniBarChartValue,
  formatDeltaValue = defaultFormatMiniBarChartDeltaValue,
  formatPercentDelta = defaultFormatMiniBarChartPercentDelta,
  getRelativeValueStyle,
  tooltipTitleSuffix,
}: StatisticMiniBarChartProps) {
  const [hover, setHover] = useState<StatisticMiniBarChartHover | null>(null);
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
          className="grid min-w-0 grid-cols-[minmax(5rem,7rem)_minmax(0,1fr)] items-center gap-2 py-1"
        >
          <DataText
            className="truncate text-[11px] text-muted-foreground"
            style={{ color: row.labelColor }}
          >
            {row.label}
          </DataText>
          <div
            className="min-w-0 space-y-0.5"
            aria-label={row.title}
            onMouseEnter={event =>
              setHover({ row, clientX: event.clientX, clientY: event.clientY })
            }
            onMouseMove={event => setHover({ row, clientX: event.clientX, clientY: event.clientY })}
            onMouseLeave={() => setHover(null)}
          >
            {row.bars.map(bar => (
              <div key={bar.id} className="h-1 bg-muted" aria-label={bar.label}>
                <div
                  className="h-full"
                  style={{
                    width: valueBarWidth(bar.value, maxValue),
                    backgroundColor: bar.color,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
      {hover && (
        <PositionedStatisticMiniBarChartTooltip
          hover={hover}
          formatValue={formatValue}
          formatDeltaValue={formatDeltaValue}
          formatPercentDelta={formatPercentDelta}
          getRelativeValueStyle={getRelativeValueStyle}
          tooltipTitleSuffix={tooltipTitleSuffix}
        />
      )}
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

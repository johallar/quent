// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import EChartsReactCore from 'echarts-for-react/lib/core';

import type { EChartsInstance } from 'echarts-for-react';
import { echarts } from '../lib/echarts';
import { registerAxisPointerSync, unregisterAxisPointerSync } from '../lib/timeline.utils';
import { useChartConnect } from '../lib/useChartConnect';
import { useMinZoomSpanPct } from '../lib/useMinZoomSpanPct';
import { useTimelineWheelNavigation } from '../lib/useTimelineWheelNavigation';
import { CHART_GROUP } from '../timeline/types';
import { useTimelineEchartsTheme } from '../timeline/timelineEchartsTheme';
import { Button } from '../ui/button';
import { HiddenScroll } from '../ui/thin-scroll';
import { observeGanttHover, type GanttHover } from './hover';
import {
  buildGanttOption,
  type GanttDatum,
  type GanttGridSpacing,
  type GanttRenderItem,
  type GanttSeriesCursor,
} from './options';
import { ganttExpansionLayout } from './utils';

export type { GanttDatum, GanttGridSpacing, GanttRenderItem } from './options';
type EChartsEvents = ComponentProps<typeof EChartsReactCore>['onEvents'];

export interface GanttChartProps<T extends GanttDatum> {
  data: T[];
  durationSeconds: number;
  height: number;
  maxHeight: number;
  rowHeight: number;
  isDark: boolean;
  seriesName: string;
  renderItem: GanttRenderItem;
  emptyMessage: ReactNode;
  cursor?: GanttSeriesCursor;
  onEvents?: EChartsEvents;
  gridSpacing?: GanttGridSpacing;
  contentPaddingBottom?: number;
  animateHeight?: boolean;
  /** Grow the row to fit stacked lanes instead of scrolling inside a fixed max height. */
  expandable?: boolean;
  expandLabel?: string;
  collapseLabel?: string;
  renderTooltip?: (hover: GanttHover | null) => ReactNode;
}

export function GanttChart<T extends GanttDatum>({
  data,
  durationSeconds,
  height,
  maxHeight,
  rowHeight,
  isDark,
  seriesName,
  renderItem,
  emptyMessage,
  cursor,
  onEvents,
  gridSpacing,
  contentPaddingBottom = 0,
  animateHeight = false,
  expandable = false,
  expandLabel = 'Expand chart',
  collapseLabel = 'Collapse chart',
  renderTooltip,
}: GanttChartProps<T>) {
  const { themeName } = useTimelineEchartsTheme(isDark);
  const [hover, setHover] = useState<GanttHover | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const minZoomSpanPct = useMinZoomSpanPct(durationSeconds);
  const attachWheelNavigation = useTimelineWheelNavigation(minZoomSpanPct);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const chartCleanupRef = useRef<(() => void) | null>(null);

  const { yAxisCategories, rowCount } = useMemo(() => {
    if (data.length === 0) return { yAxisCategories: [] as number[], rowCount: 0 };
    const maxRow = data.reduce((max, datum) => Math.max(max, datum.value[2]), 0);
    return {
      yAxisCategories: Array.from({ length: maxRow + 1 }, (_, index) => index),
      rowCount: maxRow + 1,
    };
  }, [data]);
  const expansion = expandable
    ? ganttExpansionLayout({
        rowCount,
        rowHeight,
        collapsedHeight: height,
        isExpanded,
      })
    : null;
  const resolvedMaxHeight = expansion?.maxHeight ?? maxHeight;
  const resolvedPadding = expansion?.contentPaddingBottom ?? contentPaddingBottom;
  const resolvedGridSpacing = expansion?.gridSpacing ?? gridSpacing;
  const chartHeight = Math.max(height, rowCount * rowHeight + resolvedPadding);
  const wrapperHeight = Math.min(chartHeight, resolvedMaxHeight);
  const shouldAnimateHeight = expandable || animateHeight;

  const option = useMemo(
    () =>
      buildGanttOption({
        data,
        durationSeconds,
        yAxisCategories,
        seriesName,
        renderItem,
        minZoomSpanPct,
        cursor,
        gridSpacing: resolvedGridSpacing,
      }),
    [
      data,
      durationSeconds,
      yAxisCategories,
      seriesName,
      renderItem,
      minZoomSpanPct,
      cursor,
      resolvedGridSpacing,
    ]
  );

  const onChartReady = useCallback(
    (instance: EChartsInstance) => {
      chartCleanupRef.current?.();
      registerAxisPointerSync(instance, 0, { receiveShowTip: false });
      const detachWheelNavigation = attachWheelNavigation(
        instance,
        wrapperRef.current ?? undefined
      );
      const detachHover = renderTooltip ? observeGanttHover(instance, setHover) : undefined;
      const cleanup = () => {
        unregisterAxisPointerSync(instance);
        detachWheelNavigation();
        detachHover?.();
        if (chartCleanupRef.current === cleanup) chartCleanupRef.current = null;
      };
      chartCleanupRef.current = cleanup;
    },
    [attachWheelNavigation, renderTooltip]
  );

  const { handleChartReady, instanceRef } = useChartConnect({
    durationSeconds,
    chartGroup: CHART_GROUP,
    onReady: onChartReady,
  });

  useEffect(() => {
    return () => {
      chartCleanupRef.current?.();
      instanceRef.current = null;
    };
  }, [instanceRef]);

  return (
    <div className="relative">
      <HiddenScroll
        ref={wrapperRef}
        className={
          shouldAnimateHeight
            ? 'relative transition-[height] duration-150 ease-out motion-reduce:transition-none'
            : 'relative'
        }
        style={{ height: wrapperHeight }}
      >
        <EChartsReactCore
          echarts={echarts}
          theme={themeName}
          option={option}
          style={{ height: chartHeight }}
          onChartReady={handleChartReady}
          onEvents={onEvents}
          notMerge={false}
          lazyUpdate={false}
          replaceMerge={['series']}
          autoResize={false}
        />
        {data.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </HiddenScroll>
      {expansion?.canResize && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="absolute bottom-0 left-0 z-10 h-3 rounded-none border-t border-border/50 bg-background/90 p-0 text-muted-foreground backdrop-blur-sm focus-visible:bg-accent focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:size-3"
          style={{ right: expansion.gridSpacing.right }}
          aria-label={isExpanded ? collapseLabel : expandLabel}
          aria-expanded={isExpanded}
          onClick={event => {
            event.stopPropagation();
            setIsExpanded(current => !current);
          }}
        >
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </Button>
      )}
      {data.length > 0 && renderTooltip?.(hover)}
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from 'react';
import type { NvtxLane } from '@quent/utils';
import { formatDuration, withOpacity } from '@quent/utils';
import {
  MARK_AREA_BORDER_OPACITY,
  MARK_AREA_FILL_OPACITY,
  useTimelineEchartsTheme,
} from '../timeline/timelineEchartsTheme';
import { DEFAULT_TIMELINE_HEIGHT } from '../timeline/types';
import { GanttChart, type GanttRenderItem } from '../gantt-chart/GanttChart';
import type { GanttHover } from '../gantt-chart/hover';
import { layoutGanttBar } from '../gantt-chart/utils';
import { GanttTooltipPortal, type GanttTooltipItem } from '../ui/gantt-tooltip';
import {
  nvtxItemsAtTimestamp,
  nvtxKindLabel,
  nvtxLanesToGanttData,
  rgbHex,
  type NvtxGanttDatum,
} from './utils';

const BAR_FONT_SIZE = 10;
const BAR_HEIGHT = 14;
const BAR_GAP = 2;
const ROW_HEIGHT = BAR_HEIGHT + BAR_GAP;
const SERIES_NAME = 'nvtx-range';

export interface NvtxGanttProps {
  lanes: NvtxLane[];
  durationSeconds: number;
  height?: number;
  isDark: boolean;
}

export function NvtxGantt({
  lanes,
  durationSeconds,
  height = DEFAULT_TIMELINE_HEIGHT,
  isDark,
}: NvtxGanttProps) {
  const { textColor } = useTimelineEchartsTheme(isDark);
  const customSeriesData = useMemo(() => nvtxLanesToGanttData(lanes), [lanes]);

  const renderTooltip = useCallback(
    (hover: GanttHover | null) => {
      const items: GanttTooltipItem[] = hover
        ? nvtxItemsAtTimestamp(customSeriesData, hover.timestampMs).map((datum, index) =>
            tooltipItem(datum, index)
          )
        : [];
      return <GanttTooltipPortal hover={hover} items={items} />;
    },
    [customSeriesData]
  );

  const renderItem: GanttRenderItem = useCallback(
    (params, api) => {
      const datum = customSeriesData[params.dataIndex];
      if (!datum) return null;
      const layout = layoutGanttBar(params, api, {
        barHeight: BAR_HEIGHT,
        minWidth: 2,
        allowInstant: true,
      });
      if (!layout) return null;
      const { clippedShape } = layout;
      const color = rgbHex(datum.range?.color ?? datum.mark?.color ?? '#2563eb');
      const label = datum.range?.message ?? datum.mark?.message ?? '';
      const rect = {
        type: 'rect' as const,
        shape: { ...clippedShape, r: datum.mark ? 0 : 2 },
        style: {
          fill: withOpacity(color, MARK_AREA_FILL_OPACITY),
          stroke: withOpacity(color, MARK_AREA_BORDER_OPACITY),
          lineWidth: 1,
        },
      };
      const text =
        clippedShape.width > 10
          ? {
              type: 'text' as const,
              style: {
                text: label,
                x: clippedShape.x + 6,
                y: clippedShape.y + clippedShape.height / 2,
                textVerticalAlign: 'middle' as const,
                fontSize: BAR_FONT_SIZE,
                fill: textColor,
                overflow: 'truncate' as const,
                width: Math.max(0, clippedShape.width - 12),
              },
            }
          : null;
      return { type: 'group' as const, children: text ? [rect, text] : [rect] };
    },
    [customSeriesData, textColor]
  );

  return (
    <GanttChart
      data={customSeriesData}
      durationSeconds={durationSeconds}
      height={height}
      maxHeight={height}
      rowHeight={ROW_HEIGHT}
      isDark={isDark}
      seriesName={SERIES_NAME}
      renderItem={renderItem}
      expandable
      expandLabel="Expand NVTX chart"
      collapseLabel="Collapse NVTX chart"
      emptyMessage="No NVTX ranges"
      renderTooltip={renderTooltip}
    />
  );
}

function tooltipItem(datum: NvtxGanttDatum, index: number): GanttTooltipItem {
  if (datum.mark) {
    return {
      id: `mark-${index}-${datum.mark.timestamp}`,
      color: datum.mark.color,
      name: datum.mark.message,
      fields: [
        { label: 'kind', value: nvtxKindLabel('mark') },
        { label: 'domain', value: datum.mark.domain_name },
        { label: 'category', value: datum.mark.category_name ?? 'Uncategorized' },
      ],
    };
  }
  const range = datum.range!;
  const durationMs = range.observed_duration != null ? range.observed_duration * 1_000 : null;
  return {
    id: `range-${index}-${range.display_start}`,
    color: range.color,
    name: range.message,
    detail: durationMs != null ? formatDuration(durationMs) : range.incomplete ? 'open' : undefined,
    fields: [
      {
        label: 'start',
        value: formatDuration(range.observed_start * 1_000),
      },
      {
        label: 'end',
        value: range.observed_end != null ? formatDuration(range.observed_end * 1_000) : '(open)',
      },
      { label: 'kind', value: nvtxKindLabel(range.kind) },
      ...(range.thread_id != null
        ? [{ label: 'thread', value: range.thread_name ?? String(range.thread_id) }]
        : []),
      { label: 'domain', value: range.domain_name },
      { label: 'category', value: range.category_name ?? 'Uncategorized' },
    ],
  };
}

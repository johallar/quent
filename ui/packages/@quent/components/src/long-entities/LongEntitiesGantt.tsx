// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useMemo } from 'react';

import {
  MARK_AREA_BORDER_OPACITY,
  MARK_AREA_FILL_OPACITY,
  MARK_LABEL_TEXT_COLOR,
} from '../timeline/timelineEchartsTheme';
import { withOpacity } from '@quent/utils';
import type { LongEntityEntry } from './types';
import { GanttChart, type GanttRenderItem } from '../gantt-chart/GanttChart';
import { clipRectByRect } from '../gantt-chart/utils';

const DEFAULT_HEIGHT = 120;
const MAX_HEIGHT = 400;
const BAR_FONT_SIZE = 9;
const BAR_HEIGHT = 16;
const BAR_GAP = 2;
const SERIES_NAME = 'long-entity-segment';

/** Flat segment datum: one ECharts custom-series item per state span. */
type SegmentDatum = {
  value: [number, number, number];
  entryIndex: number;
  segmentIndex: number;
};

export interface LongEntitiesGanttProps {
  entries: LongEntityEntry[];
  durationSeconds: number;
  height?: number;
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
}

export function LongEntitiesGantt({
  entries,
  durationSeconds,
  height = DEFAULT_HEIGHT,
  isDark,
}: LongEntitiesGanttProps) {
  // One custom-series datum per segment, tagged with its parent entry/segment.
  const customSeriesData = useMemo<SegmentDatum[]>(() => {
    const data: SegmentDatum[] = [];
    entries.forEach((entry, entryIndex) => {
      entry.segments.forEach((seg, segmentIndex) => {
        data.push({
          value: [seg.startMs, seg.endMs, entry.rowIndex],
          entryIndex,
          segmentIndex,
        });
      });
    });
    return data;
  }, [entries]);

  const renderItem: GanttRenderItem = useCallback(
    (params, api) => {
      const startMs = api.value(0) as number;
      const endMs = api.value(1) as number;
      const rowIndex = api.value(2) as number;
      if (endMs <= startMs) return null;

      const datum = customSeriesData[params.dataIndex];
      const entry = datum ? entries[datum.entryIndex] : undefined;
      const segment = entry?.segments[datum!.segmentIndex];
      if (!entry || !segment) return null;

      const startPoint = api.coord([startMs, rowIndex]);
      const endPoint = api.coord([endMs, rowIndex]);

      const barHeight = Math.max(1, BAR_HEIGHT - BAR_GAP);
      const y = startPoint[1] - barHeight / 2;
      const width = Math.max(1, endPoint[0] - startPoint[0]);

      const coord = params.coordSys as { x?: number; y?: number; width?: number; height?: number };
      const clipBound =
        typeof coord.width === 'number' && typeof coord.height === 'number'
          ? { x: coord.x ?? 0, y: coord.y ?? 0, width: coord.width, height: coord.height }
          : null;
      const rectShape = { x: startPoint[0], y, width, height: barHeight };
      const clippedShape = clipBound ? clipRectByRect(rectShape, clipBound) : rectShape;
      if (!clippedShape) return null;

      const color = segment.color;
      const rect = {
        type: 'rect' as const,
        shape: { ...clippedShape, r: 1 },
        // Mirror timeline marks: faint fill, stronger border, same state color.
        style: {
          fill: withOpacity(color, MARK_AREA_FILL_OPACITY),
          stroke: withOpacity(color, MARK_AREA_BORDER_OPACITY),
          lineWidth: 1,
        },
      };

      // Entity label chip on the first segment only (white text on state color).
      const textX = clippedShape.x + 4;
      const textY = clippedShape.y + clippedShape.height / 2;
      const labelChildren =
        datum!.segmentIndex === 0
          ? [
              {
                type: 'text' as const,
                style: {
                  text: entry.label,
                  x: textX,
                  y: textY,
                  textVerticalAlign: 'middle' as const,
                  fontSize: BAR_FONT_SIZE,
                  fontWeight: 500,
                  fill: MARK_LABEL_TEXT_COLOR,
                  backgroundColor: withOpacity(color, 0.85),
                  borderRadius: 1,
                  padding: [1, 2] as [number, number],
                  overflow: 'truncate' as const,
                  width: Math.max(0, clippedShape.width - 8),
                },
              },
            ]
          : [];

      return { type: 'group' as const, children: [rect, ...labelChildren] };
    },
    [entries, customSeriesData]
  );

  return (
    <GanttChart
      data={customSeriesData}
      durationSeconds={durationSeconds}
      height={height}
      maxHeight={MAX_HEIGHT}
      rowHeight={BAR_HEIGHT}
      isDark={isDark}
      seriesName={SERIES_NAME}
      renderItem={renderItem}
      emptyMessage="No long entities"
    />
  );
}

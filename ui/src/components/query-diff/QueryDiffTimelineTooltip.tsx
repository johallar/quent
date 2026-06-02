// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Timeline,
  TIMELINE_MONO_FONT,
  useTimelineEchartsTheme,
  type TimelineSeries,
} from '@quent/components';

interface TimelineHoverPosition {
  dataIndex: number;
  timestampMs: number;
  clientX: number;
  clientY: number;
}
import { useSetTimelineHover, useTimelineHover } from '@quent/hooks';
import { formatDuration } from '@quent/utils';
import { findBinIndexAtTime, type DiffHeatmapRowData } from './QueryDiffTimeline.utils';
import { formatRelativePercent } from './QueryDiffTimelineTooltip.utils';

const POINTER_OFFSET = 12;
const VIEWPORT_MARGIN = 4;

export type QueryDiffTimelineTooltipData = DiffHeatmapRowData & { label: string };

interface QueryDiffTimelineWithTooltipProps {
  tooltipData: QueryDiffTimelineTooltipData;
  startTime: bigint;
  durationSeconds: number;
  timestamps: number[];
  series: TimelineSeries;
  isDark: boolean;
  positiveColor: string;
  negativeColor: string;
}

export function QueryDiffTimelineWithTooltip({
  tooltipData,
  startTime,
  durationSeconds,
  timestamps,
  series,
  isDark,
  positiveColor,
  negativeColor,
}: QueryDiffTimelineWithTooltipProps) {
  const ownerId = useId();
  const setTimelineHover = useSetTimelineHover();
  const handleHoverChange = useCallback(
    (position: TimelineHoverPosition | null) => {
      if (position == null) {
        setTimelineHover(prev => (prev?.sourceId === ownerId ? null : prev));
      } else {
        setTimelineHover({ ...position, sourceId: ownerId });
      }
    },
    [ownerId, setTimelineHover]
  );

  useEffect(() => {
    return () => {
      setTimelineHover(prev => (prev?.sourceId === ownerId ? null : prev));
    };
  }, [ownerId, setTimelineHover]);

  return (
    <>
      <Timeline
        startTime={startTime}
        durationSeconds={durationSeconds}
        timestamps={timestamps}
        series={series}
        showTooltip
        isDark={isDark}
        onHoverChange={handleHoverChange}
      />
      <QueryDiffTimelineTooltipPortal
        ownerId={ownerId}
        tooltipData={tooltipData}
        timestamps={timestamps}
        positiveColor={positiveColor}
        negativeColor={negativeColor}
        isDark={isDark}
      />
    </>
  );
}

function QueryDiffTimelineTooltipPortal({
  ownerId,
  tooltipData,
  timestamps,
  positiveColor,
  negativeColor,
  isDark,
}: {
  ownerId: string;
  tooltipData: QueryDiffTimelineTooltipData;
  timestamps: number[];
  positiveColor: string;
  negativeColor: string;
  isDark: boolean;
}) {
  const hover = useTimelineHover();
  const isOwned = hover?.sourceId === ownerId;

  if (!isOwned || !hover) return null;
  if (timestamps.length === 0) return null;

  const chartIndex = Math.max(0, Math.min(timestamps.length - 1, hover.dataIndex));
  const chartTimestamp = timestamps[chartIndex] ?? hover.timestampMs;
  const tooltipBinIndex = findBinIndexAtTime(tooltipData.timestamps, chartTimestamp);

  return (
    <PositionedDiffTooltip
      clientX={hover.clientX}
      clientY={hover.clientY}
      dataIndex={tooltipBinIndex}
      tooltipData={tooltipData}
      positiveColor={positiveColor}
      negativeColor={negativeColor}
      isDark={isDark}
    />
  );
}

function PositionedDiffTooltip({
  clientX,
  clientY,
  dataIndex,
  tooltipData,
  positiveColor,
  negativeColor,
  isDark,
}: {
  clientX: number;
  clientY: number;
  dataIndex: number;
  tooltipData: QueryDiffTimelineTooltipData;
  positiveColor: string;
  negativeColor: string;
  isDark: boolean;
}) {
  const { axisLabelColor, labelBackgroundColor } = useTimelineEchartsTheme(isDark);
  const bin = useMemo(() => {
    const timestamp = tooltipData.timestamps[dataIndex] ?? 0;
    return {
      label: tooltipData.label,
      relative: tooltipData.relativeValues[dataIndex] ?? 0,
      signedDelta: tooltipData.signedDeltaValues[dataIndex] ?? 0,
      baseline: tooltipData.baselineValues[dataIndex] ?? 0,
      comparison: tooltipData.comparisonValues[dataIndex] ?? 0,
      timestamp,
      formatter: tooltipData.formatter,
    };
  }, [dataIndex, tooltipData]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: clientX + POINTER_OFFSET,
    top: clientY + POINTER_OFFSET,
  });

  useLayoutEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = clientX + POINTER_OFFSET;
    let top = clientY + POINTER_OFFSET;
    if (left + rect.width + VIEWPORT_MARGIN > vw) {
      left = Math.max(VIEWPORT_MARGIN, clientX - rect.width - POINTER_OFFSET);
    }
    if (top + rect.height + VIEWPORT_MARGIN > vh) {
      top = Math.max(VIEWPORT_MARGIN, clientY - rect.height - POINTER_OFFSET);
    }
    setPosition({ left, top });
  }, [clientX, clientY, bin.timestamp]);

  const deltaLabel =
    bin.signedDelta > 0
      ? 'Comparison higher'
      : bin.signedDelta < 0
        ? 'Comparison lower'
        : 'No change';
  const deltaColor =
    bin.signedDelta > 0 ? positiveColor : bin.signedDelta < 0 ? negativeColor : axisLabelColor;

  return createPortal(
    <div
      ref={hostRef}
      style={{
        position: 'fixed',
        left: position.left,
        top: position.top,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div
        className="rounded border px-2 py-1.5 text-[11px] leading-tight shadow-md"
        style={{
          fontFamily: TIMELINE_MONO_FONT,
          color: axisLabelColor,
          backgroundColor: labelBackgroundColor,
          borderColor: axisLabelColor,
        }}
      >
        <div className="font-semibold">{bin.label}</div>
        <div>
          <span style={{ color: deltaColor, fontWeight: 600 }}>{deltaLabel}</span>
          {` (${formatRelativePercent(bin.relative)})`}
        </div>
        <div>Baseline: {bin.formatter(bin.baseline, 2)}</div>
        <div>Comparison: {bin.formatter(bin.comparison, 2)}</div>
        <div>
          Delta:{' '}
          <span style={{ color: deltaColor, fontWeight: 600 }}>
            {bin.formatter(bin.signedDelta, 2)}
          </span>
        </div>
        <div>Time: {formatDuration(bin.timestamp)}</div>
      </div>
    </div>,
    document.body
  );
}

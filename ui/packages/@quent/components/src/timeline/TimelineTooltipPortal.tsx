// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTimelineHover, useZoomRange } from '@quent/hooks';
import { TooltipContent } from './TimelineTooltip';
import type { TimelineMark, TimelineSeries } from './types';

const POINTER_OFFSET = 12;
const VIEWPORT_MARGIN = 4;

/**
 * Pointer-driven tooltip rendered as a single body-level portal.
 *
 * Each Timeline mounts one of these guarded by `sourceId === ownerId`, so at
 * most one portal ever renders DOM at a time. This replaces ECharts' built-in
 * `tooltip.formatter` + `appendToBody` path:
 *
 *   - No reliance on `connect()` mirroring `showTip` across charts (which
 *     caused duplicate tooltips on every chart in the group).
 *   - No `renderToStaticMarkup` injection — the tooltip is regular React.
 *   - Cleanup is automatic via component unmount; no orphan-tooltip DOM.
 *
 * Series values at the hovered timestamp are resolved by binary-searching the
 * shared `timestamps` array for the nearest bin, mirroring ECharts' axis-trigger
 * snap behavior.
 */
export function TimelineTooltipPortal({
  ownerId,
  series,
  timestamps,
  marks,
  startTime,
}: {
  /** Stable id of the Timeline that owns this portal. */
  ownerId: string;
  series: TimelineSeries;
  timestamps: number[];
  marks?: TimelineMark[];
  startTime: bigint;
}) {
  const hover = useTimelineHover();
  const zoomRange = useZoomRange();
  const isOwned = hover?.sourceId === ownerId;

  if (!isOwned || !hover) return null;
  if (timestamps.length === 0) return null;

  return (
    <PositionedTooltip
      clientX={hover.clientX}
      clientY={hover.clientY}
      timestampMs={hover.timestampMs}
      series={series}
      timestamps={timestamps}
      marks={marks}
      startTime={startTime}
      windowMs={(zoomRange.end - zoomRange.start) * 1000}
    />
  );
}

function PositionedTooltip({
  clientX,
  clientY,
  timestampMs,
  series,
  timestamps,
  marks,
  startTime,
  windowMs,
}: {
  clientX: number;
  clientY: number;
  timestampMs: number;
  series: TimelineSeries;
  timestamps: number[];
  marks?: TimelineMark[];
  startTime: bigint;
  windowMs: number;
}) {
  // Snap to the nearest bin so values match what the crosshair is pointing at,
  // matching ECharts' axis-trigger behavior. Then sample each series at that
  // bin to reproduce the legacy formatter output, but as ordinary React.
  const { snappedTimestamp, tooltipSeries, activeMarks } = useMemo(() => {
    const idx = findNearestBinIndex(timestamps, timestampMs);
    const snapped = timestamps[idx] ?? timestampMs;
    const tooltipSeriesValues = Object.entries(series).map(([name, entry]) => ({
      color: entry.color,
      name,
      value: entry.values[idx] ?? 0,
      isOverlay: entry.isOverlay ?? false,
      isDimmed: entry.isDimmed ?? false,
    }));
    const activeMarksAtTs = marks
      ?.filter(m => snapped >= m.xStart && snapped <= m.xEnd)
      .map(m => ({ label: m.label, stateName: m.stateName, color: m.color }));
    return {
      snappedTimestamp: snapped,
      tooltipSeries: tooltipSeriesValues,
      activeMarks: activeMarksAtTs && activeMarksAtTs.length > 0 ? activeMarksAtTs : undefined,
    };
  }, [series, timestamps, marks, timestampMs]);

  const fmt = useMemo(() => Object.values(series)[0]?.formatter, [series]);

  const hostRef = useRef<HTMLDivElement | null>(null);
  // Defer-clamp to viewport: render once at the raw position, measure, then
  // adjust if the box would overflow. Two-phase keeps us simple — confine: true
  // was free with ECharts; here it's ~10 lines.
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
  }, [clientX, clientY, snappedTimestamp]);

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
      <TooltipContent
        timestamp={snappedTimestamp}
        series={tooltipSeries}
        startTime={startTime}
        fmt={fmt}
        windowMs={windowMs}
        activeMarks={activeMarks}
      />
    </div>,
    document.body
  );
}

/** Binary-search the nearest index in a monotone-increasing array. */
function findNearestBinIndex(timestamps: number[], ts: number): number {
  if (timestamps.length === 0) return -1;
  let lo = 0;
  let hi = timestamps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((timestamps[mid] ?? 0) < ts) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0) {
    const a = timestamps[lo - 1] ?? 0;
    const b = timestamps[lo] ?? 0;
    if (Math.abs(a - ts) < Math.abs(b - ts)) return lo - 1;
  }
  return lo;
}

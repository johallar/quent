// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EChartsInstance } from 'echarts-for-react';
import { connect } from './echarts';
import { DEFAULT_CHART_GROUP } from './constants';

/** Joins a connect group and seeds its first dataZoom without replacing components. */
export const connectChart = (
  instance: EChartsInstance,
  chartGroup: string = DEFAULT_CHART_GROUP,
  activateBrushSelect = true,
  zoomPct: { start: number; end: number } | null = null
) => {
  // Apply current zoom to this chart without replacing its dataZoom components.
  // setOption({ dataZoom: [zoomState] }) would replace the array and break slider/inside config.
  if (zoomPct) {
    instance.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      start: zoomPct.start,
      end: zoomPct.end,
    });
  }

  if (activateBrushSelect) {
    instance.dispatchAction({
      type: 'takeGlobalCursor',
      key: 'dataZoomSelect',
      dataZoomSelectActive: true,
    });
  }

  instance.group = chartGroup;
  connect(chartGroup);
};

/** Synchronizes pointers by shared x-axis values across heterogeneous charts. */
interface AxisPointerEntry {
  instance: EChartsInstance;
  xAxisIndex: number;
  receiveShowTip: boolean;
  onMouseMove: (e: { offsetX: number }) => void;
  onGlobalOut: () => void;
}

const axisPointerRegistry = new Set<AxisPointerEntry>();
let isBroadcasting = false;

function broadcastShowPointer(source: EChartsInstance | null, timestampMs: number) {
  if (isBroadcasting) return;
  isBroadcasting = true;
  try {
    axisPointerRegistry.forEach(({ instance, xAxisIndex, receiveShowTip }) => {
      if (instance === source || !receiveShowTip) return;
      try {
        const pixel = instance.convertToPixel({ xAxisIndex }, timestampMs);
        if (pixel != null && isFinite(pixel)) {
          instance.dispatchAction({
            type: 'showTip',
            x: pixel,
            y: instance.getHeight() / 2,
          });
        }
      } catch {
        // Target chart may not be ready or value out of range
      }
    });
  } finally {
    isBroadcasting = false;
  }
}

function broadcastHidePointer(source: EChartsInstance | null) {
  if (isBroadcasting) return;
  isBroadcasting = true;
  try {
    axisPointerRegistry.forEach(({ instance }) => {
      if (instance === source) return;
      try {
        instance.dispatchAction({ type: 'hideTip' });
      } catch {
        // Ignore disposed instances
      }
    });
  } finally {
    isBroadcasting = false;
  }
}

/**
 * Broadcast a synced axis-pointer crosshair at `timestampMs` (ms relative to
 * query start) to every registered timeline chart, without a source chart. Used by the DAG
 * playhead so scrubbing/playing draws a crosshair on the right-panel
 * timelines with zero React re-renders.
 */
export function broadcastSyncedPointer(timestampMs: number) {
  broadcastShowPointer(null, timestampMs);
}

/** Hide the crosshair broadcast by {@link broadcastSyncedPointer}. */
export function hideSyncedPointer() {
  broadcastHidePointer(null);
}

export interface AxisPointerSyncOptions {
  /** If false, this chart will not receive showTip when the pointer is synced from another chart (default true). */
  receiveShowTip?: boolean;
}

/**
 * Register a chart instance for manual axis pointer sync.
 * Uses zr-level mouse events + convertFromPixel for reliable cross-chart sync
 * regardless of tooltip/axisPointer configuration differences.
 * @param xAxisIndex Which xAxis index carries the timestamp values (default 0).
 * @param options.receiveShowTip If false, tooltip is only shown when the user hovers this chart (default true).
 */
export function registerAxisPointerSync(
  instance: EChartsInstance,
  xAxisIndex = 0,
  options: AxisPointerSyncOptions = {}
) {
  const receiveShowTip = options.receiveShowTip !== false;
  const onMouseMove = (e: { offsetX: number }) => {
    try {
      const value = instance.convertFromPixel({ xAxisIndex }, e.offsetX);
      if (value != null && isFinite(value as number)) {
        broadcastShowPointer(instance, value as number);
      }
    } catch {
      // Chart grid not ready
    }
  };

  const onGlobalOut = () => {
    broadcastHidePointer(instance);
  };

  const zr = instance.getZr();
  zr.on('mousemove', onMouseMove);
  zr.on('globalout', onGlobalOut);

  const entry = { instance, xAxisIndex, receiveShowTip, onMouseMove, onGlobalOut };
  axisPointerRegistry.add(entry);

  (instance as unknown as Record<string, unknown>).__axisPointerEntry = entry;
}

/** Unregister a chart instance from axis pointer sync. */
export function unregisterAxisPointerSync(instance: EChartsInstance) {
  const entry = (instance as unknown as Record<string, unknown>).__axisPointerEntry as
    | AxisPointerEntry
    | undefined;
  if (!entry) return;

  axisPointerRegistry.delete(entry);

  const zr = instance.getZr?.();
  if (zr) {
    zr.off('mousemove', entry.onMouseMove);
    zr.off('globalout', entry.onGlobalOut);
  }

  delete (instance as unknown as Record<string, unknown>).__axisPointerEntry;
}

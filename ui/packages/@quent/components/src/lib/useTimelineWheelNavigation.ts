// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import { TIMELINE_SPACING } from '../timeline/types';

type DataZoomState = {
  start?: number;
  end?: number;
};

function getDataZoomState(instance: EChartsInstance): DataZoomState | undefined {
  const option = instance.getOption() as { dataZoom?: DataZoomState[] };
  return option.dataZoom?.[0];
}

/**
 * Adds native vertical scrolling, horizontal trackpad panning, and minimum-zoom guarding.
 * Call the returned function from the chart's `onReady` callback.
 */
export function useTimelineWheelNavigation(minZoomSpanPct: number) {
  const minZoomSpanPctRef = useRef(minZoomSpanPct);
  minZoomSpanPctRef.current = minZoomSpanPct;
  const cleanupRef = useRef<(() => void) | null>(null);

  const attachWheelNavigation = useCallback(
    (instance: EChartsInstance, wheelTarget: HTMLElement = instance.getDom()) => {
      cleanupRef.current?.();

      let atZoomLimit = false;
      const updateZoomLimit = () => {
        if (instance.isDisposed?.()) return;
        const dataZoom = getDataZoomState(instance);
        if (!dataZoom) return;
        const spanPct = (dataZoom.end ?? 100) - (dataZoom.start ?? 0);
        atZoomLimit = spanPct <= minZoomSpanPctRef.current * 1.01;
      };

      const handleWheel = (event: WheelEvent) => {
        if (event.shiftKey) {
          const zoomDelta = event.deltaY || event.deltaX;
          if (zoomDelta < 0 && atZoomLimit) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }

        event.stopPropagation();
        if (event.deltaX === 0 || Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
        if (instance.isDisposed?.()) return;

        event.preventDefault();
        const dataZoom = getDataZoomState(instance);
        if (!dataZoom) return;

        const currentStart = dataZoom.start ?? 0;
        const currentEnd = dataZoom.end ?? 100;
        const spanPct = currentEnd - currentStart;
        const rect = instance.getDom().getBoundingClientRect();
        const usableWidth = Math.max(
          1,
          rect.width - TIMELINE_SPACING.left - TIMELINE_SPACING.right
        );
        const deltaPct = (event.deltaX / usableWidth) * spanPct;
        const newStart = Math.max(0, Math.min(100 - spanPct, currentStart + deltaPct));

        instance.dispatchAction({
          type: 'dataZoom',
          dataZoomIndex: 0,
          start: newStart,
          end: newStart + spanPct,
        });
      };

      updateZoomLimit();
      instance.on('datazoom', updateZoomLimit);
      wheelTarget.addEventListener('wheel', handleWheel, { capture: true, passive: false });

      cleanupRef.current = () => {
        wheelTarget.removeEventListener('wheel', handleWheel, { capture: true });
        if (!instance.isDisposed?.()) instance.off('datazoom', updateZoomLimit);
      };
    },
    []
  );

  useEffect(
    () => () => {
      cleanupRef.current?.();
      cleanupRef.current = null;
    },
    []
  );

  return attachWheelNavigation;
}

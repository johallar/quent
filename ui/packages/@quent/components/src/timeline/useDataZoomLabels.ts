// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import { formatDuration } from '@quent/utils';

const LABEL_FONT_SIZE = 10;
const LABEL_CHIP_VERTICAL_EXTRA = 4;
const LABEL_BELOW_GAP = 2;

export const DATA_ZOOM_LABEL_BELOW_STRIP_HEIGHT =
  LABEL_BELOW_GAP + LABEL_FONT_SIZE + LABEL_CHIP_VERTICAL_EXTRA;
export const DATA_ZOOM_LABEL_FONT_SIZE = LABEL_FONT_SIZE;
export const DATA_ZOOM_LABEL_BELOW_GAP = LABEL_BELOW_GAP;

/**
 * Manages imperative DOM positioning of the start/end zoom handle labels.
 * Returns refs to attach to the label divs and wrapper, plus `registerInstance`
 * to call inside `onChartReady`.
 */
export function useDataZoomLabels(startTimeMillis: number, endTimeMillis: number) {
  const startLabelRef = useRef<HTMLDivElement>(null);
  const endLabelRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Live refs so listeners registered once never close over stale values.
  const startTimeMillisRef = useRef(startTimeMillis);
  startTimeMillisRef.current = startTimeMillis;
  const endTimeMillisRef = useRef(endTimeMillis);
  endTimeMillisRef.current = endTimeMillis;

  const windowListenerCleanupRef = useRef<(() => void) | null>(null);

  const updateLabels = useCallback((instance: EChartsInstance) => {
    const t0 = startTimeMillisRef.current;
    const t1 = endTimeMillisRef.current;
    const span = t1 - t0;
    if (span <= 0) return;

    const opt = instance.getOption() as {
      dataZoom?: Array<{ start?: number; end?: number }>;
    };
    const dz = opt.dataZoom?.[0];
    const startPct = dz?.start ?? 0;
    const endPct = dz?.end ?? 100;

    const startVal = t0 + (startPct / 100) * span;
    const endVal = t0 + (endPct / 100) * span;

    // xAxis 0 always spans the full duration; xAxis 1 is bound to the dataZoom
    // and would pin both labels to the grid edges.
    const startX = instance.convertToPixel({ xAxisIndex: 0 }, startVal);
    const endX = instance.convertToPixel({ xAxisIndex: 0 }, endVal);
    if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;

    const chartDom = instance.getDom() as HTMLElement | null;
    if (!chartDom) return;
    const rect = chartDom.getBoundingClientRect();
    const labelTopVp = rect.bottom + LABEL_BELOW_GAP;

    const sl = startLabelRef.current;
    if (sl) {
      sl.textContent = formatDuration(startVal - t0);
      sl.style.top = `${labelTopVp}px`;
      sl.style.left = `${rect.left + startX}px`;
      // Right edge flush with the handle, then clamp inside the wrapper column.
      sl.style.transform = 'translateX(-100%)';
      const slRect = sl.getBoundingClientRect();
      const minLeft = wrapperRef.current?.getBoundingClientRect().left ?? 0;
      if (slRect.left < minLeft) {
        sl.style.transform = `translateX(calc(-100% + ${minLeft - slRect.left}px))`;
      }
    }

    const el = endLabelRef.current;
    if (el) {
      el.textContent = formatDuration(endVal - t0);
      el.style.top = `${labelTopVp}px`;
      el.style.left = `${rect.left + endX}px`;
      // Left edge flush with the handle, then clamp inside the viewport.
      el.style.transform = 'translateX(0)';
      const elRect = el.getBoundingClientRect();
      if (elRect.right > window.innerWidth) {
        el.style.transform = `translateX(${-(elRect.right - window.innerWidth)}px)`;
      }
    }
  }, []);

  const registerInstance = useCallback(
    (instance: EChartsInstance) => {
      const update = () => updateLabels(instance);
      // `datazoom` for drags/brush/dispatch; `finished` for initial + resize.
      instance.on('datazoom', update);
      instance.on('finished', update);

      // `position: fixed` labels must re-anchor on scroll/resize.
      windowListenerCleanupRef.current?.();
      const onWindowChange = () => updateLabels(instance);
      window.addEventListener('scroll', onWindowChange, { passive: true, capture: true });
      window.addEventListener('resize', onWindowChange);
      windowListenerCleanupRef.current = () => {
        window.removeEventListener('scroll', onWindowChange, { capture: true });
        window.removeEventListener('resize', onWindowChange);
      };
    },
    [updateLabels]
  );

  useEffect(() => {
    return () => {
      windowListenerCleanupRef.current?.();
      windowListenerCleanupRef.current = null;
    };
  }, []);

  return {
    startLabelRef,
    endLabelRef,
    wrapperRef,
    registerInstance,
  };
}

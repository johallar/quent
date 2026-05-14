// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import { formatDuration } from '@quent/utils';

const LABEL_CHIP_VERTICAL_EXTRA = 4;
const LABEL_BELOW_GAP = 2;
export const LABEL_FONT_SIZE = 10;

export const DATA_ZOOM_LABEL_BELOW_STRIP_HEIGHT =
  LABEL_BELOW_GAP + LABEL_FONT_SIZE + LABEL_CHIP_VERTICAL_EXTRA;

/** How each handle label aligns to its anchor pixel. */
type LabelAlign = 'left' | 'right' | 'center';

/** Clamping boundaries in viewport pixels. */
interface ClampBounds {
  minLeft?: number;
  maxRight?: number;
}

/**
 * Positions a label div imperatively at (`vpX`, `vpY`) in viewport coords.
 * `align` controls which edge of the label touches the anchor:
 *   - `'right'`  — right edge at vpX (label sits to the left of the handle)
 *   - `'left'`   — left edge at vpX  (label sits to the right of the handle)
 *   - `'center'` — centered on vpX
 * Clamp bounds nudge the label back into view when it would overflow.
 */
export function positionLabel(
  el: HTMLDivElement,
  vpX: number,
  vpY: number,
  text: string,
  align: LabelAlign,
  clamp: ClampBounds = {}
): void {
  el.textContent = text;
  el.style.top = `${vpY}px`;
  el.style.left = `${vpX}px`;
  const basePct = align === 'right' ? -100 : align === 'center' ? -50 : 0;
  el.style.transform = `translateX(${basePct}%)`;

  const r = el.getBoundingClientRect();
  let nudge = 0;
  if (clamp.minLeft !== undefined && r.left < clamp.minLeft) nudge = clamp.minLeft - r.left;
  if (clamp.maxRight !== undefined && r.right > clamp.maxRight) nudge = -(r.right - clamp.maxRight);
  if (nudge !== 0) el.style.transform = `translateX(calc(${basePct}% + ${nudge}px))`;
}

/** Controls how start/end labels sit relative to their handles. */
export type DataZoomLabelPlacement = 'outside' | 'inside' | 'center';

const PLACEMENT_ALIGNS: Record<DataZoomLabelPlacement, [LabelAlign, LabelAlign]> = {
  outside: ['right', 'left'],
  inside: ['left', 'right'],
  center: ['center', 'center'],
};

/**
 * Manages imperative DOM positioning of the start/end zoom handle labels.
 * Returns refs to attach to the label divs and wrapper, plus `registerInstance`
 * to call inside `onChartReady`.
 */
export function useDataZoomLabels(
  startTimeMillis: number,
  endTimeMillis: number,
  placement: DataZoomLabelPlacement = 'outside'
) {
  const startLabelRef = useRef<HTMLDivElement>(null);
  const endLabelRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Live refs so listeners registered once never close over stale values.
  const startTimeMillisRef = useRef(startTimeMillis);
  startTimeMillisRef.current = startTimeMillis;
  const endTimeMillisRef = useRef(endTimeMillis);
  endTimeMillisRef.current = endTimeMillis;

  const windowListenerCleanupRef = useRef<(() => void) | null>(null);

  const updateLabels = useCallback(
    (instance: EChartsInstance) => {
      const t0 = startTimeMillisRef.current;
      const t1 = endTimeMillisRef.current;
      const span = t1 - t0;
      if (span <= 0) return;

      const opt = instance.getOption() as {
        dataZoom?: Array<{ start?: number; end?: number }>;
      };
      const dz = opt.dataZoom?.[0];
      const startVal = t0 + ((dz?.start ?? 0) / 100) * span;
      const endVal = t0 + ((dz?.end ?? 100) / 100) * span;

      // xAxis 0 always spans the full duration; xAxis 1 is bound to the dataZoom
      // and would pin both labels to the grid edges.
      const startX = instance.convertToPixel({ xAxisIndex: 0 }, startVal);
      const endX = instance.convertToPixel({ xAxisIndex: 0 }, endVal);
      if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;

      const chartDom = instance.getDom() as HTMLElement | null;
      if (!chartDom) return;
      const rect = chartDom.getBoundingClientRect();
      const labelTopVp = rect.bottom + LABEL_BELOW_GAP;

      const [startAlign, endAlign] = PLACEMENT_ALIGNS[placement];

      if (startLabelRef.current) {
        positionLabel(
          startLabelRef.current,
          rect.left + startX,
          labelTopVp,
          formatDuration(startVal - t0),
          startAlign,
          { minLeft: wrapperRef.current?.getBoundingClientRect().left ?? 0 }
        );
      }
      if (endLabelRef.current) {
        positionLabel(
          endLabelRef.current,
          rect.left + endX,
          labelTopVp,
          formatDuration(endVal - t0),
          endAlign,
          { maxRight: window.innerWidth }
        );
      }
    },
    [placement]
  );

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

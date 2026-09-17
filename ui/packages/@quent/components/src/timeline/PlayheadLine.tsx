// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import {
  useDataFlowIsPlaying,
  useSetDataFlowIsPlaying,
  useSetPlayheadLineTimeMs,
  useSetPlayheadTimeS,
} from '@quent/hooks';
import { cn } from '@quent/utils';
import { usePlayheadLinePixel } from '../lib/usePlayheadLinePixel';

const PLAYHEAD_HIT_AREA_PX = 10;

type PlayheadLineProps = {
  instance: EChartsInstance | null;
  xAxisIndex?: number;
};

/** Playhead overlay aligned to an ECharts x-axis. */
export function PlayheadLine({ instance, xAxisIndex = 0 }: PlayheadLineProps) {
  const pixelX = usePlayheadLinePixel(instance, xAxisIndex);
  const isPlaying = useDataFlowIsPlaying();
  const setIsPlaying = useSetDataFlowIsPlaying();
  const setPlayheadLineTimeMs = useSetPlayheadLineTimeMs();
  const setPlayheadTimeS = useSetPlayheadTimeS();
  const isDraggingRef = useRef(false);
  const pendingClientXRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const applyClientX = useCallback(
    (clientX: number) => {
      if (!instance || instance.isDisposed?.()) {
        return;
      }
      const rect = instance.getDom().getBoundingClientRect();
      if (rect.width <= 0) {
        return;
      }
      const offsetX = Math.min(rect.width, Math.max(0, clientX - rect.left));

      try {
        const value = instance.convertFromPixel({ xAxisIndex }, offsetX);
        const timeMs = Array.isArray(value) ? value[0] : value;
        if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
          return;
        }
        setPlayheadLineTimeMs(timeMs);
        setPlayheadTimeS(timeMs / 1000);
      } catch {
        // The chart can be disposed between pointer events.
      }
    },
    [instance, xAxisIndex, setPlayheadLineTimeMs, setPlayheadTimeS]
  );

  const flushPendingClientX = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (pendingClientXRef.current != null) {
      applyClientX(pendingClientXRef.current);
      pendingClientXRef.current = null;
    }
  }, [applyClientX]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      isDraggingRef.current = true;
      setIsPlaying(false);
      event.currentTarget.setPointerCapture(event.pointerId);
      applyClientX(event.clientX);
    },
    [applyClientX, setIsPlaying]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) {
        return;
      }
      event.stopPropagation();
      pendingClientXRef.current = event.clientX;
      if (rafRef.current != null) {
        return;
      }
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        if (pendingClientXRef.current != null) {
          applyClientX(pendingClientXRef.current);
          pendingClientXRef.current = null;
        }
      });
    },
    [applyClientX]
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingRef.current) {
        return;
      }
      event.stopPropagation();
      isDraggingRef.current = false;
      if (event.type === 'pointerup') {
        pendingClientXRef.current = event.clientX;
      }
      flushPendingClientX();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [flushPendingClientX]
  );

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

  if (pixelX == null) {
    return null;
  }

  return (
    <div
      aria-hidden
      className={cn(
        'absolute bottom-0 top-0 z-[10] -translate-x-1/2 cursor-col-resize touch-none',
        isPlaying && 'transition-[left] duration-100 ease-linear motion-reduce:transition-none'
      )}
      style={{ left: pixelX, width: PLAYHEAD_HIT_AREA_PX }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
    >
      <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-primary/70" />
    </div>
  );
}

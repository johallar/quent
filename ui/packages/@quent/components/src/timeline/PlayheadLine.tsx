// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import {
  useDataFlowIsPlaying,
  useSetDataFlowIsPlaying,
  useSetPlayheadLineTimeMs,
  useSetPlayheadTimeS,
  useZoomRange,
} from '@quent/hooks';
import { clamp, cn } from '@quent/utils';
import { usePlayheadLinePixel } from '../lib/usePlayheadLinePixel';

const PLAYHEAD_HIT_AREA_PX = 10;

type PlayheadLineProps = {
  instance: EChartsInstance | null;
  xAxisIndex?: number;
  draggable?: boolean;
};

/** Playhead overlay aligned to an ECharts x-axis. */
export function PlayheadLine({ instance, xAxisIndex = 0, draggable = false }: PlayheadLineProps) {
  const pixelX = usePlayheadLinePixel(instance, xAxisIndex);
  const isPlaying = useDataFlowIsPlaying();
  const setIsPlaying = useSetDataFlowIsPlaying();
  const setPlayheadLineTimeMs = useSetPlayheadLineTimeMs();
  const setPlayheadTimeS = useSetPlayheadTimeS();
  const zoomRange = useZoomRange();
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
      const offsetX = clamp(clientX - rect.left, 0, rect.width);

      try {
        const value = instance.convertFromPixel({ xAxisIndex }, offsetX);
        const timeMs = Array.isArray(value) ? value[0] : value;
        if (typeof timeMs !== 'number' || !Number.isFinite(timeMs)) {
          return;
        }
        const viewportStartMs = zoomRange.start * 1000;
        const viewportEndMs = zoomRange.end * 1000;
        const clampedTimeMs = clamp(
          timeMs,
          Math.min(viewportStartMs, viewportEndMs),
          Math.max(viewportStartMs, viewportEndMs)
        );
        setPlayheadLineTimeMs(clampedTimeMs);
        setPlayheadTimeS(clampedTimeMs / 1000);
      } catch {
        // The chart can be disposed between pointer events.
      }
    },
    [instance, xAxisIndex, setPlayheadLineTimeMs, setPlayheadTimeS, zoomRange]
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
      if (!draggable) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      isDraggingRef.current = true;
      setIsPlaying(false);
      event.currentTarget.setPointerCapture(event.pointerId);
      applyClientX(event.clientX);
    },
    [applyClientX, draggable, setIsPlaying]
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable || !isDraggingRef.current) {
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
    [applyClientX, draggable]
  );

  const handlePointerEnd = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggable || !isDraggingRef.current) {
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
    [draggable, flushPendingClientX]
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
        'absolute bottom-0 top-0 z-[10] -translate-x-1/2',
        draggable ? 'cursor-col-resize touch-none' : 'pointer-events-none',
        isPlaying && 'transition-[left] duration-100 ease-linear motion-reduce:transition-none'
      )}
      style={{ left: pixelX, width: PLAYHEAD_HIT_AREA_PX }}
      onPointerDown={draggable ? handlePointerDown : undefined}
      onPointerMove={draggable ? handlePointerMove : undefined}
      onPointerUp={draggable ? handlePointerEnd : undefined}
      onPointerCancel={draggable ? handlePointerEnd : undefined}
    >
      <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-px -translate-x-1/2 bg-primary/70" />
    </div>
  );
}

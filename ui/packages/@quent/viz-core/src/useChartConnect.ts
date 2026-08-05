// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';
import type { EChartsInstance } from 'echarts-for-react';
import { connectChart } from './chartSync';
import { DEFAULT_CHART_GROUP } from './constants';
import { useChartResize } from './useChartResize';

export interface ChartZoomRange {
  start: number;
  end: number;
}

export interface UseChartConnectOptions {
  durationSeconds: number;
  zoomRange: ChartZoomRange;
  chartGroup?: string;
  activateBrushSelect?: boolean;
  onReady?: (instance: EChartsInstance) => void;
}

export interface UseChartConnectResult {
  handleChartReady: (instance: EChartsInstance) => void;
  instanceRef: MutableRefObject<EChartsInstance | null>;
}

/** Connects a chart using caller-owned zoom state. */
export function useChartConnect({
  durationSeconds,
  zoomRange,
  chartGroup = DEFAULT_CHART_GROUP,
  activateBrushSelect = false,
  onReady,
}: UseChartConnectOptions): UseChartConnectResult {
  const zoomRangeRef = useRef(zoomRange);
  zoomRangeRef.current = zoomRange;
  const durationSecondsRef = useRef(durationSeconds);
  durationSecondsRef.current = durationSeconds;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const { handleChartReady: handleResize, instanceRef } = useChartResize();

  const handleChartReady = useCallback(
    (instance: EChartsInstance) => {
      handleResize(instance);
      const duration = durationSecondsRef.current;
      const range = zoomRangeRef.current;
      const zoomPct =
        duration > 0
          ? { start: (range.start / duration) * 100, end: (range.end / duration) * 100 }
          : null;
      connectChart(instance, chartGroup, activateBrushSelect, zoomPct);
      onReadyRef.current?.(instance);
    },
    [handleResize, chartGroup, activateBrushSelect]
  );

  return { handleChartReady, instanceRef };
}

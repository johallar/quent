// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactEChartsComponent from 'echarts-for-react';
import { echarts } from '../lib/echarts';
import type { EChartsOption } from '../lib/echarts';
import type { EChartsInstance } from 'echarts-for-react';
import { useZoomRange } from '@quent/hooks';
import { formatDuration } from '@quent/utils';
import type { ZoomRange } from '@quent/utils';
import {
  buildBinnedTimelineSeries,
  getAdaptiveNumBins,
  getTimelineXAxisIntervalMs,
  MIN_ZOOM_WINDOW_S,
  nanosToMs,
  registerAxisPointerSync,
  unregisterAxisPointerSync,
} from '../lib/timeline.utils';
import { useChartConnect } from '../lib/useChartConnect';
import { TIMELINE_X_AXIS_ANIMATION, TIMELINE_SPACING } from './types';
import type { SingleTimelineResponse } from '@quent/utils';
import { TIMELINE_MONO_FONT, useTimelineEchartsTheme } from './timelineEchartsTheme';
import type { PaletteTheme } from '@quent/utils';

const CONTROLLER_HEIGHT = 30;
const CONTROLLER_TOP_HEADROOM_RATIO = 0.2;
const CONTROLLER_X_MIN_LABELS = 8;
/** Extra space below the chart reserved for the portal handle labels. */
const LABEL_MARGIN_PX = 16;

type TimelineControllerProps = {
  /** Start time in nanoseconds (bigint) */
  startTime: bigint;
  /** Duration in seconds */
  durationSeconds: number;
  height?: number;
  /** Optional timeline data to render on the static display (e.g. overlay from root resource group) */
  timelineData?: SingleTimelineResponse | null;
  /** Called when the zoom/pan range changes, with start/end in seconds */
  onZoomChange?: (range: ZoomRange) => void;
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
};

/** Zoom controller bar with datazoom slider and optional background timeline data. */
export function TimelineController({
  startTime,
  durationSeconds,
  height = CONTROLLER_HEIGHT,
  timelineData,
  onZoomChange,
  isDark,
}: TimelineControllerProps) {
  const { themeName, controllerGridBackgroundColor, textColor, labelBackgroundColor } =
    useTimelineEchartsTheme(isDark);
  const paletteTheme: PaletteTheme = isDark ? 'dark' : 'light';

  const startTimeMillis = useMemo(() => nanosToMs(startTime), [startTime]);

  const { timestamps, seriesData } = useMemo(() => {
    if (timelineData) {
      const { timestamps: ts, series } = buildBinnedTimelineSeries(
        timelineData.data,
        timelineData.config,
        startTime,
        paletteTheme
      );
      const entries = Object.entries(series);
      const values = entries.length > 0 ? entries[0][1].values : null;
      return { timestamps: ts, seriesData: values };
    } else {
      const numBins = getAdaptiveNumBins();
      const binDurationMs = (durationSeconds * 1000) / numBins;
      const ts = Array.from({ length: numBins }, (_, i) => startTimeMillis + i * binDurationMs);
      return { timestamps: ts, seriesData: null };
    }
  }, [timelineData, startTime, startTimeMillis, durationSeconds, paletteTheme]);

  const hasSeriesData = useMemo(() => Boolean(seriesData && seriesData.length > 0), [seriesData]);

  const seriesOptions = useMemo(() => {
    const toTimePoints = (values: number[]) =>
      values.map((value, index) => [timestamps[index], value] as [number, number]);

    const zoomControlSeries = {
      name: 'zoom-control',
      type: 'line',
      xAxisIndex: 1,
      data: toTimePoints(Array(timestamps.length).fill(0)),
      symbol: 'none',
      lineStyle: { width: 0 },
      areaStyle: { opacity: 0 },
      silent: true,
      emphasis: { disabled: true },
      z: 1,
    };
    const staticValues: number[] | null = hasSeriesData
      ? seriesData
      : Array(timestamps.length).fill(0);
    // Color comes from the registered timeline theme's color palette
    // (rollupTimelineColor); areaStyle inherits the line color at 80% opacity.
    const staticDisplaySeries = {
      name: 'static-display',
      type: 'line',
      xAxisIndex: 0,
      data: toTimePoints(staticValues ?? []),
      symbol: 'none',
      lineStyle: { width: 1 },
      areaStyle: { opacity: 0.8 },
      silent: true,
      emphasis: { disabled: true },
      step: 'middle',
      ...TIMELINE_X_AXIS_ANIMATION,
      z: 1,
    };

    return [zoomControlSeries, staticDisplaySeries];
  }, [timestamps, hasSeriesData, seriesData]);

  const endTimeMillis = startTimeMillis + durationSeconds * 1000;

  const staticXAxisOptions = useMemo(() => {
    const interval = getTimelineXAxisIntervalMs(
      endTimeMillis - startTimeMillis,
      CONTROLLER_X_MIN_LABELS
    );

    return {
      boundaryGap: false,
      type: 'value',
      show: true,
      min: startTimeMillis,
      max: endTimeMillis,
      interval,
      axisTick: { show: true },
      axisLabel: { show: false },
      splitLine: { show: true, lineStyle: { type: 'solid' } },
      axisPointer: {
        show: true,
        type: 'line',
        snap: false,
        label: { show: false },
        handle: { show: false },
      },
    };
  }, [startTimeMillis, endTimeMillis]);

  const zoomXAxisOptions = useMemo(
    () => ({
      boundaryGap: false,
      type: 'value',
      show: false,
      min: startTimeMillis,
      max: endTimeMillis,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    }),
    [startTimeMillis, endTimeMillis]
  );

  const yAxisOptions = useMemo(() => {
    if (hasSeriesData) {
      return {
        type: 'value',
        show: false,
        min: 'dataMin',
        max: (value: { min: number; max: number }) => {
          const range = Math.max(value.max - value.min, 1);
          return value.max + range * CONTROLLER_TOP_HEADROOM_RATIO;
        },
        splitLine: { show: false },
      };
    }
    return {
      type: 'value',
      show: false,
      min: 0,
      max: 'datamax',
      splitLine: { show: false },
    };
  }, [hasSeriesData]);

  const gridOptions = useMemo(
    () => ({
      ...TIMELINE_SPACING,
      borderWidth: 0,
      // Override the registered theme's grid backgroundColor with the controller-specific tint.
      backgroundColor: controllerGridBackgroundColor,
    }),
    [controllerGridBackgroundColor]
  );

  const minZoomSpanPct = useMemo(() => {
    if (durationSeconds <= 0) return 0;
    return Math.min(100, (MIN_ZOOM_WINDOW_S / durationSeconds) * 100);
  }, [durationSeconds]);

  const eChartOptions: EChartsOption = useMemo(() => {
    return {
      tooltip: { show: true, showContent: false, trigger: 'axis' },
      axisPointer: {
        link: [{ xAxisIndex: 'all' }],
      },
      grid: gridOptions,
      dataZoom: [
        {
          type: 'slider',
          show: true,
          z: 10,
          xAxisIndex: [1],
          realtime: true,
          filterMode: 'none',
          minSpan: minZoomSpanPct,
          top: 0,
          height,
          brushSelect: true,
          // Handle labels are rendered as DOM elements (see wrapper div below)
          // to avoid canvas clipping when handles are near the edges.
          textStyle: { opacity: 0 },
        },
        {
          type: 'inside',
          xAxisIndex: [1],
          realtime: true,
          filterMode: 'none',
          zoomLock: true,
          zoomOnMouseWheel: false,
          moveOnMouseMove: false,
        },
        {
          type: 'inside',
          xAxisIndex: [1],
          realtime: true,
          filterMode: 'none',
          zoomOnMouseWheel: true,
          moveOnMouseMove: false,
          moveOnMouseWheel: false,
          minSpan: minZoomSpanPct,
        },
      ],
      xAxis: [staticXAxisOptions, zoomXAxisOptions],
      yAxis: yAxisOptions,
      series: seriesOptions,
    } as EChartsOption;
  }, [
    gridOptions,
    height,
    minZoomSpanPct,
    staticXAxisOptions,
    zoomXAxisOptions,
    yAxisOptions,
    seriesOptions,
    startTimeMillis,
    endTimeMillis,
  ]);

  const handleDataZoom = useMemo(() => {
    if (!onZoomChange) return undefined;
    return {
      dataZoom: (params: {
        start?: number;
        end?: number;
        batch?: Array<{ start?: number; end?: number }>;
      }) => {
        let start: number | undefined;
        let end: number | undefined;
        if (params.start !== undefined && params.end !== undefined) {
          start = params.start;
          end = params.end;
        } else if (params.batch?.[0]) {
          start = params.batch[0].start;
          end = params.batch[0].end;
        }
        if (start !== undefined && end !== undefined) {
          selfTriggeredRef.current = true;
          onZoomChange({
            start: (start / 100) * durationSeconds,
            end: (end / 100) * durationSeconds,
          });
        }
      },
    };
  }, [onZoomChange, durationSeconds]);

  const selfTriggeredRef = useRef(false);
  // Increments on every chart-ready event so the restore effect re-fires when
  // the underlying ECharts instance is recreated (e.g. on theme change, which
  // disposes and re-creates the chart and would otherwise leave the new
  // instance at its default 0–100% zoom).
  const [readyTick, setReadyTick] = useState(0);

  const zoomRange = useZoomRange();

  // Stable refs for zero-latency direct DOM updates.
  const durationSecondsRef = useRef(durationSeconds);
  durationSecondsRef.current = durationSeconds;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const leftLabelRef = useRef<HTMLSpanElement>(null);
  const rightLabelRef = useRef<HTMLSpanElement>(null);

  /** Compute the fixed top position (px) where labels should sit — just below the chart. */
  const getLabelTop = useCallback(() => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    // Labels sit in the margin area: chart bottom + small gap
    return rect ? rect.top + height + 4 : -9999;
  }, [height]);

  /** Reposition both labels horizontally from zoom percentages and vertically from bounding rect. */
  const updateLabelPositions = useCallback(
    (sp: number, ep: number) => {
      const rect = wrapperRef.current?.getBoundingClientRect();
      if (!rect) return;
      const top = `${rect.top + height + 4}px`;
      if (leftLabelRef.current) {
        leftLabelRef.current.style.left = `${rect.left + (sp / 100) * rect.width}px`;
        leftLabelRef.current.style.top = top;
      }
      if (rightLabelRef.current) {
        rightLabelRef.current.style.left = `${rect.left + (ep / 100) * rect.width}px`;
        rightLabelRef.current.style.top = top;
      }
    },
    [height]
  );

  const onChartReady = useCallback(
    (instance: EChartsInstance) => {
      registerAxisPointerSync(instance, 0);
      setReadyTick(t => t + 1);

      // Directly mutate label DOM on every datazoom event, bypassing the React
      // render cycle so labels track the handles with zero perceptible lag.
      instance.on('datazoom', () => {
        const opt = instance.getOption() as { dataZoom?: Array<{ start?: number; end?: number }> };
        const dz = opt.dataZoom?.[0];
        if (dz == null) return;
        const dur = durationSecondsRef.current;
        const sp = dz.start ?? 0;
        const ep = dz.end ?? 100;
        if (leftLabelRef.current) {
          leftLabelRef.current.textContent = formatDuration((sp / 100) * dur * 1000);
        }
        if (rightLabelRef.current) {
          rightLabelRef.current.textContent = formatDuration((ep / 100) * dur * 1000);
        }
        updateLabelPositions(sp, ep);
      });
    },
    [updateLabelPositions]
  );

  // Sync labels when zoom changes externally (toolbar reset, initial mount).
  useEffect(() => {
    if (durationSeconds <= 0) return;
    const sp = (zoomRange.start / durationSeconds) * 100;
    const ep = (zoomRange.end / durationSeconds) * 100;
    if (leftLabelRef.current) {
      leftLabelRef.current.textContent = formatDuration(zoomRange.start * 1000);
    }
    if (rightLabelRef.current) {
      rightLabelRef.current.textContent = formatDuration(zoomRange.end * 1000);
    }
    updateLabelPositions(sp, ep);
  }, [zoomRange, durationSeconds, updateLabelPositions]);

  // Keep label vertical position in sync when the wrapper moves or resizes.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new ResizeObserver(() => {
      if (durationSeconds <= 0) return;
      const sp = (zoomRange.start / durationSeconds) * 100;
      const ep = (zoomRange.end / durationSeconds) * 100;
      updateLabelPositions(sp, ep);
    });
    observer.observe(wrapper);
    return () => observer.disconnect();
    // Intentionally not including zoomRange/durationSeconds — the observer fires
    // on geometry change; the external zoom useEffect above handles value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateLabelPositions]);

  const { handleChartReady, instanceRef } = useChartConnect({
    durationSeconds,
    activateBrushSelect: true,
    onReady: onChartReady,
  });

  // Restore the dataZoom slider position from the persisted atom whenever the
  // zoom range changes or a (re)created chart instance becomes ready. The
  // `readyTick` dependency ensures recreated instances inherit the saved zoom
  // even when the atom value itself is unchanged across the remount.
  useEffect(() => {
    if (readyTick === 0) return;
    if (selfTriggeredRef.current) {
      selfTriggeredRef.current = false;
      return;
    }
    const instance = instanceRef.current;
    if (!instance || durationSeconds === 0) return;

    const startPct = (zoomRange.start / durationSeconds) * 100;
    const endPct = (zoomRange.end / durationSeconds) * 100;

    // Mute the dataZoom event our own dispatch is about to emit, so the
    // recreated chart's initial restore doesn't echo back through onZoomChange
    // and overwrite the atom (which would visibly snap the bounds back).
    selfTriggeredRef.current = true;
    instance.dispatchAction({
      type: 'dataZoom',
      dataZoomIndex: 0,
      start: startPct,
      end: endPct,
    });
  }, [readyTick, zoomRange, durationSeconds, instanceRef]);

  useEffect(() => {
    return () => {
      if (instanceRef.current) {
        unregisterAxisPointerSync(instanceRef.current);
        instanceRef.current = null;
      }
    };
  }, [instanceRef]);

  const portalLabelStyle: React.CSSProperties = {
    position: 'fixed',
    // top/left set imperatively via refs; start off-screen until first position update
    top: getLabelTop(),
    left: -9999,
    transform: 'translateX(-50%)',
    zIndex: 9999,
    pointerEvents: 'none',
    fontSize: 10,
    lineHeight: 1,
    borderRadius: 2,
    padding: '2px 4px',
    fontFamily: TIMELINE_MONO_FONT,
    color: textColor,
    background: labelBackgroundColor,
  };

  return (
    <>
      {/* Extra bottom padding reserves space for the portal labels below the chart. */}
      <div
        ref={wrapperRef}
        style={{ width: '100%', height: `${height + LABEL_MARGIN_PX}px`, paddingBottom: LABEL_MARGIN_PX }}
      >
        <ReactEChartsComponent
          echarts={echarts}
          theme={themeName}
          option={eChartOptions}
          style={{ width: '100%', height: `${height}px` }}
          onChartReady={handleChartReady}
          onEvents={handleDataZoom}
          notMerge={false}
          lazyUpdate
          opts={{ renderer: 'canvas' }}
        />
      </div>
      {createPortal(
        <>
          <span ref={leftLabelRef} style={portalLabelStyle}>
            {formatDuration(zoomRange.start * 1000)}
          </span>
          <span ref={rightLabelRef} style={{ ...portalLabelStyle, left: -9999 }}>
            {formatDuration(zoomRange.end * 1000)}
          </span>
        </>,
        document.body
      )}
    </>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
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
import { Opts } from 'echarts-for-react/lib/types';

const CONTROLLER_HEIGHT = 50;
const CONTROLLER_TOP_HEADROOM_RATIO = 0.2;
const CONTROLLER_X_MIN_LABELS = 8;
/** Grid `bottom` (px from container bottom) — leaves room for the xAxis labels. */
const CONTROLLER_GRID_BOTTOM = 20;
/** Match the registered theme's xAxis axisLabel.fontSize. */
const CONTROLLER_LABEL_FONT_SIZE = 10;
/** Match the registered theme's xAxis axisLabel.margin. */
const CONTROLLER_LABEL_AXIS_MARGIN = 8;
/** 1px padding top+bottom + 1px border top+bottom of the label chip. */
const CONTROLLER_LABEL_CHIP_VERTICAL_EXTRA = 2;

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
  const { themeName, axisLabelColor, solidLabelBackgroundColor, controllerGridBackgroundColor } =
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
      axisLabel: {
        hideOverlap: false,
        formatter: (value: number) => {
          return formatDuration(Number(value) - startTimeMillis);
        },
      },
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
      bottom: CONTROLLER_GRID_BOTTOM,
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
          height: height - 24,
          brushSelect: true,
          // handleStyle, fillerColor, dataBackground, etc. come from the
          // registered timeline theme's dataZoom defaults. The built-in
          // showDetail labels are disabled in favor of custom DOM labels
          // positioned imperatively to match the xAxis label style/location.
          showDetail: false,
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

  // DOM refs for the custom datazoom labels. Positioned imperatively from the
  // ECharts `datazoom` event so fast drags don't pay a React render tick per
  // frame. The label text/transform is updated directly via these refs.
  const startLabelRef = useRef<HTMLDivElement>(null);
  const endLabelRef = useRef<HTMLDivElement>(null);
  // Ref to the outer wrapper div — used as the clamp container for the left
  // label so it bumps against the chart's containing element rather than the
  // viewport edge.
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Live refs for the values the update routine reads so the imperative
  // listener (registered once in onChartReady) never closes over stale values
  // after a re-render.
  const startTimeMillisRef = useRef(startTimeMillis);
  startTimeMillisRef.current = startTimeMillis;
  const endTimeMillisRef = useRef(endTimeMillis);
  endTimeMillisRef.current = endTimeMillis;

  // Reproduce the static xAxis label's vertical position. ECharts places the
  // axis line at `containerBottom - gridBottom`, then drops the label by
  // `axisLabel.margin` and renders one line of `fontSize` text below it. The
  // label's bottom edge is therefore `gridBottom - margin - fontSize` from the
  // container bottom — exactly the offset we need to overlay the datazoom
  // chips on top of the xAxis labels.
  const labelBottomPx = Math.max(
    0,
    CONTROLLER_GRID_BOTTOM - CONTROLLER_LABEL_AXIS_MARGIN - CONTROLLER_LABEL_FONT_SIZE
  );
  const labelBoxHeight = CONTROLLER_LABEL_FONT_SIZE + CONTROLLER_LABEL_CHIP_VERTICAL_EXTRA;

  const updateLabelsFromInstance = useCallback((instance: EChartsInstance) => {
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

    // Use the static xAxis (index 0) — its value→pixel mapping always spans
    // the full duration. xAxisIndex 1 is controlled by the dataZoom so its
    // visible range shrinks to the zoomed window, which would pin both labels
    // to the grid edges regardless of handle position.
    const startX = instance.convertToPixel({ xAxisIndex: 0 }, startVal);
    const endX = instance.convertToPixel({ xAxisIndex: 0 }, endVal);
    if (!Number.isFinite(startX) || !Number.isFinite(endX)) return;

    // Labels use `position: fixed` so they can escape any ancestor's
    // `overflow: hidden` (e.g. an adjacent resource-tree column). Convert the
    // chart-local pixel X into viewport coordinates via the chart DOM's rect.
    const chartDom = instance.getDom() as HTMLElement | null;
    if (!chartDom) return;
    const rect = chartDom.getBoundingClientRect();
    const labelTopVp = rect.bottom - labelBottomPx - labelBoxHeight;

    const sl = startLabelRef.current;
    const el = endLabelRef.current;

    if (sl) {
      sl.textContent = formatDuration(startVal - t0);
      sl.style.top = `${labelTopVp}px`;
      sl.style.left = `${rect.left + startX}px`;
      // Tentatively center on the handle, then clamp against the chart
      // wrapper's left edge — i.e. the containing element, not the page.
      sl.style.transform = 'translateX(-50%)';
      const slRect = sl.getBoundingClientRect();
      const wrapperRect = wrapperRef.current?.getBoundingClientRect();
      const minLeft = (wrapperRect?.left ?? 0);
      if (slRect.left < minLeft) {
        const overflow = minLeft - slRect.left;
        sl.style.transform = `translateX(calc(-50% + ${overflow}px))`;
      }
    }

    if (el) {
      el.textContent = formatDuration(endVal - t0);
      el.style.top = `${labelTopVp}px`;
      el.style.left = `${rect.left + endX}px`;
      // Tentatively center on the handle, then clamp against the viewport
      // right edge so the label never overflows the page. Measuring after the
      // text/position are set picks up the actual rendered width.
      el.style.transform = 'translateX(-50%)';
      const elRect = el.getBoundingClientRect();
      const maxRight = window.innerWidth;
      if (elRect.right > maxRight) {
        const overflow = elRect.right - maxRight;
        el.style.transform = `translateX(calc(-50% - ${overflow}px))`;
      }
    }
  }, [labelBottomPx, labelBoxHeight]);

  // Refs so the chart-ready callback (which only fires when the instance is
  // (re)created) can attach window-level listeners that clean themselves up
  // on the next instance creation or on unmount.
  const windowListenerCleanupRef = useRef<(() => void) | null>(null);

  const onChartReady = useCallback(
    (instance: EChartsInstance) => {
      registerAxisPointerSync(instance, 0);
      const update = () => updateLabelsFromInstance(instance);
      // `datazoom` covers drags, brush-select, programmatic dispatchAction.
      // `finished` covers initial render + resize-driven relayouts. Both are
      // native ECharts events and bypass React's render cycle entirely.
      instance.on('datazoom', update);
      instance.on('finished', update);

      // With `position: fixed` labels we must re-anchor to the chart's new
      // viewport rect on scroll/resize. These run on the browser event tick
      // and never trigger a React render.
      windowListenerCleanupRef.current?.();
      const onWindowChange = () => updateLabelsFromInstance(instance);
      window.addEventListener('scroll', onWindowChange, { passive: true, capture: true });
      window.addEventListener('resize', onWindowChange);
      windowListenerCleanupRef.current = () => {
        window.removeEventListener('scroll', onWindowChange, { capture: true });
        window.removeEventListener('resize', onWindowChange);
      };

      setReadyTick(t => t + 1);
    },
    [updateLabelsFromInstance]
  );

  useEffect(
    () => () => {
      windowListenerCleanupRef.current?.();
      windowListenerCleanupRef.current = null;
    },
    []
  );

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

  const opts = useMemo(() => ({ renderer: 'svg' }) as Opts, []);

  const labelBaseStyle: CSSProperties = {
    // `fixed` so the chip can spill into adjacent columns (and out past the
    // viewport edge — though we clamp the right label) regardless of any
    // ancestor's overflow/stacking context. Coordinates are written
    // imperatively from `updateLabelsFromInstance`.
    position: 'fixed',
    top: 0,
    left: 0,
    transform: 'translate(-9999px, 0)',
    pointerEvents: 'none',
    color: axisLabelColor,
    fontSize: `${CONTROLLER_LABEL_FONT_SIZE}px`,
    fontFamily: TIMELINE_MONO_FONT,
    lineHeight: 1,
    whiteSpace: 'nowrap',
    zIndex: 1000,
    willChange: 'transform, top, left',
    backgroundColor: solidLabelBackgroundColor,
    padding: '1px 4px',
    border: `1px solid ${axisLabelColor}`,
    borderRadius: '2px',
  };

  return (
    <div
      ref={wrapperRef}
      style={{ position: 'relative', width: '100%', height: `${height}px` }}
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
        opts={opts}
      />
      <div ref={startLabelRef} style={labelBaseStyle} aria-hidden />
      <div ref={endLabelRef} style={labelBaseStyle} aria-hidden />
    </div>
  );
}

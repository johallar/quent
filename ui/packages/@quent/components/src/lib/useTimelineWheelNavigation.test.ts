// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import type { EChartsType } from 'echarts';
import { describe, expect, it, vi } from 'vitest';
import { useTimelineWheelNavigation } from './useTimelineWheelNavigation';

function createChart(dataZoom: { start: number; end: number }) {
  const dom = document.createElement('div');
  vi.spyOn(dom, 'getBoundingClientRect').mockReturnValue({
    width: 1010,
    height: 100,
    top: 0,
    right: 1010,
    bottom: 100,
    left: 0,
    x: 0,
    y: 0,
    toJSON: () => undefined,
  });

  let dataZoomListener: (() => void) | undefined;
  const dispatchAction = vi.fn();
  const off = vi.fn();
  const instance = {
    getDom: () => dom,
    getOption: () => ({ dataZoom: [dataZoom] }),
    dispatchAction,
    isDisposed: () => false,
    on: vi.fn((event: string, listener: () => void) => {
      if (event === 'datazoom') dataZoomListener = listener;
    }),
    off,
  } as unknown as EChartsType;

  return { instance, dom, dispatchAction, off, emitDataZoom: () => dataZoomListener?.() };
}

describe('useTimelineWheelNavigation', () => {
  it('pans the visible range on horizontal wheel input', () => {
    const chart = createChart({ start: 25, end: 75 });
    const { result } = renderHook(() => useTimelineWheelNavigation(10));
    act(() => result.current(chart.instance));

    const event = new WheelEvent('wheel', {
      deltaX: 100,
      bubbles: true,
      cancelable: true,
    });
    act(() => chart.dom.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(true);
    expect(chart.dispatchAction).toHaveBeenCalledWith({
      type: 'dataZoom',
      dataZoomIndex: 0,
      start: 30,
      end: 80,
    });
  });

  it('leaves vertical wheel input to native scrolling', () => {
    const chart = createChart({ start: 25, end: 75 });
    const { result } = renderHook(() => useTimelineWheelNavigation(10));
    act(() => result.current(chart.instance));

    const event = new WheelEvent('wheel', {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    act(() => chart.dom.dispatchEvent(event));

    expect(event.defaultPrevented).toBe(false);
    expect(chart.dispatchAction).not.toHaveBeenCalled();
  });

  it('blocks zoom-in panning at the minimum span but allows zoom-out', () => {
    const dataZoom = { start: 20, end: 40 };
    const chart = createChart(dataZoom);
    const parent = document.createElement('div');
    parent.appendChild(chart.dom);
    const parentWheel = vi.fn();
    parent.addEventListener('wheel', parentWheel);

    const { result } = renderHook(() => useTimelineWheelNavigation(10));
    act(() => result.current(chart.instance));
    dataZoom.end = 30;
    act(() => chart.emitDataZoom());

    const zoomIn = new WheelEvent('wheel', {
      deltaY: -1,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => chart.dom.dispatchEvent(zoomIn));

    expect(zoomIn.defaultPrevented).toBe(true);
    expect(parentWheel).not.toHaveBeenCalled();

    const zoomOut = new WheelEvent('wheel', {
      deltaY: 1,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    act(() => chart.dom.dispatchEvent(zoomOut));

    expect(zoomOut.defaultPrevented).toBe(false);
    expect(parentWheel).toHaveBeenCalledOnce();
  });

  it('removes chart and wheel listeners on unmount', () => {
    const chart = createChart({ start: 25, end: 75 });
    const { result, unmount } = renderHook(() => useTimelineWheelNavigation(10));
    act(() => result.current(chart.instance));
    unmount();

    act(() => {
      chart.dom.dispatchEvent(
        new WheelEvent('wheel', { deltaX: 100, bubbles: true, cancelable: true })
      );
    });

    expect(chart.dispatchAction).not.toHaveBeenCalled();
    expect(chart.off).toHaveBeenCalledWith('datazoom', expect.any(Function));
  });
});

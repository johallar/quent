// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { act, renderHook } from '@testing-library/react';
import type { EChartsInstance } from 'echarts-for-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useChartResize } from './useChartResize';

let notifyResize: ResizeObserverCallback;

class ResizeObserverMock {
  constructor(callback: ResizeObserverCallback) {
    notifyResize = callback;
  }

  observe() {}
  unobserve() {}
  disconnect() {}
}

function createChart(domWidth: number, domHeight: number, chartWidth: number, chartHeight: number) {
  const dom = document.createElement('div');
  let containerWidth = domWidth;
  let containerHeight = domHeight;
  let instanceWidth = chartWidth;
  let instanceHeight = chartHeight;

  Object.defineProperties(dom, {
    clientWidth: { get: () => containerWidth },
    clientHeight: { get: () => containerHeight },
  });

  const resize = vi.fn(() => {
    instanceWidth = containerWidth;
    instanceHeight = containerHeight;
  });
  const instance = {
    getDom: () => dom,
    getWidth: () => instanceWidth,
    getHeight: () => instanceHeight,
    resize,
  } as unknown as EChartsInstance;

  return {
    instance,
    resize,
    setContainerSize: (width: number, height: number) => {
      containerWidth = width;
      containerHeight = height;
    },
  };
}

describe('useChartResize', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('corrects fallback chart dimensions as soon as the chart is ready', () => {
    const chart = createChart(900, 50, 300, 50);
    const { result } = renderHook(() => useChartResize());

    act(() => result.current.handleChartReady(chart.instance));

    expect(chart.resize).toHaveBeenCalledWith({ width: 'auto', height: 'auto' });
  });

  it('preserves matching dimensions and resizes on a later layout change', () => {
    const chart = createChart(900, 50, 900, 50);
    const { result } = renderHook(() => useChartResize());

    act(() => result.current.handleChartReady(chart.instance));
    expect(chart.resize).not.toHaveBeenCalled();

    chart.setContainerSize(700, 50);
    act(() => notifyResize([], {} as ResizeObserver));

    expect(chart.resize).toHaveBeenCalledWith({ width: 'auto', height: 'auto' });
  });
});

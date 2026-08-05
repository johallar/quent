// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export { echarts, connect, disconnect, getInstanceByDom } from './echarts';
export type { ECharts, EChartsOption } from './echarts';
export { DEFAULT_CHART_GROUP } from './constants';
export {
  broadcastSyncedPointer,
  connectChart,
  hideSyncedPointer,
  registerAxisPointerSync,
  unregisterAxisPointerSync,
} from './chartSync';
export type { AxisPointerSyncOptions } from './chartSync';
export { useChartConnect } from './useChartConnect';
export type {
  ChartZoomRange,
  UseChartConnectOptions,
  UseChartConnectResult,
} from './useChartConnect';
export { useChartResize } from './useChartResize';
export { useMinZoomSpanPct } from './useMinZoomSpanPct';
export { useTimelineWheelNavigation } from './useTimelineWheelNavigation';
export type { ChartGridInsets } from './useTimelineWheelNavigation';

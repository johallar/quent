// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import type { ChartZoomRange } from '@quent/viz-core';
import { computeVisibleMaxValue } from './timelineMath';
import type { TimelineSeries } from './types';

export function useVisibleMaxValue(
  series: TimelineSeries,
  timestamps: number[],
  zoomRange: ChartZoomRange
): number | null {
  return useMemo(
    () => computeVisibleMaxValue(series, timestamps, zoomRange.start * 1000, zoomRange.end * 1000),
    [series, timestamps, zoomRange]
  );
}

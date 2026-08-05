// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';

/** Converts a caller-owned minimum window into ECharts dataZoom percent. */
export function useMinZoomSpanPct(durationSeconds: number, minWindowSeconds: number): number {
  return useMemo(() => {
    if (durationSeconds <= 0) return 0;
    return Math.min(100, (minWindowSeconds / durationSeconds) * 100);
  }, [durationSeconds, minWindowSeconds]);
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react';
import {
  useHideTasks,
  useSetDebouncedZoomRange,
  useSetHideTasks,
  useSetZoomRange,
} from './useTimelineAtoms';

export function useTimelineToolbarControls(durationSeconds: number) {
  const hideTasks = useHideTasks();
  const setHideTasks = useSetHideTasks();
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();
  const resetZoom = useCallback(() => {
    const full = { start: 0, end: durationSeconds };
    setZoomRange(full);
    setDebouncedZoomRange(full);
  }, [durationSeconds, setDebouncedZoomRange, setZoomRange]);

  return { hideTasks, setHideTasks, resetZoom };
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'jotai';
import type { ZoomRange } from '@quent/utils';
import { debouncedZoomRangeAtom, zoomRangeAtom } from '../atoms/timeline';

const ZOOM_DEBOUNCE_MS = 150;

/** Updates the live viewport immediately and the fetch viewport after a short debounce. */
export function useTimelineZoomHandler() {
  const store = useStore();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    },
    []
  );

  return useCallback(
    (range: ZoomRange) => {
      store.set(zoomRangeAtom, range);

      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        store.set(debouncedZoomRangeAtom, range);
        debounceTimerRef.current = null;
      }, ZOOM_DEBOUNCE_MS);
    },
    [store]
  );
}

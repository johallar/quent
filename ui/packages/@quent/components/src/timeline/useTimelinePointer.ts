// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTimelinePointerPublisher } from '@quent/hooks';
import { TIMELINE_SPACING } from './types';

export type TimelinePointerSpacing = {
  left?: number;
  right?: number;
};

export type TimelinePointerRange = {
  start: number;
  end: number;
};

export function useTimelinePointerHandlers({
  left = TIMELINE_SPACING.left,
  right = TIMELINE_SPACING.right,
  range,
}: TimelinePointerSpacing & { range?: TimelinePointerRange } = {}) {
  const { publish, clear } = useTimelinePointerPublisher();
  const rangeStart = range?.start ?? 0;
  const rangeEnd = range?.end ?? 1;
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const plotWidth = rect.width - left - right;
      const plotX = event.clientX - rect.left - left;
      if (plotWidth <= 0 || plotX < 0 || plotX > plotWidth) {
        clear();
        return;
      }
      const fullRatio = plotX / plotWidth;
      const rangeSpan = rangeEnd - rangeStart;
      if (rangeSpan <= 0 || fullRatio < rangeStart || fullRatio > rangeEnd) {
        clear();
        return;
      }
      publish((fullRatio - rangeStart) / rangeSpan);
    },
    [clear, left, publish, rangeEnd, rangeStart, right]
  );

  return { onPointerMove, onPointerLeave: clear, onPointerCancel: clear };
}

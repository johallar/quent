// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useTimelinePointerRatio } from '@quent/hooks';
import { TIMELINE_SPACING } from './types';
import type { TimelinePointerRange, TimelinePointerSpacing } from './useTimelinePointer';

/** Jotai-driven crosshair shared by every timeline chart. */
export function TimelinePointerLine({
  left = TIMELINE_SPACING.left,
  right = TIMELINE_SPACING.right,
  range,
}: TimelinePointerSpacing & { range?: TimelinePointerRange }) {
  const ratio = useTimelinePointerRatio();
  if (ratio == null) return null;
  const displayRatio = range ? range.start + ratio * (range.end - range.start) : ratio;
  const pixelOffset = left - displayRatio * (left + right);
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute bottom-0 top-0 z-[10] w-0 border-l border-dashed border-muted-foreground/70"
      style={{ left: `calc(${displayRatio * 100}% + ${pixelOffset}px)` }}
    />
  );
}

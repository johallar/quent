// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { resolvePinnedRows } from '@/features/pinned-rows/pinnedRows';
import { usePinnedCollapsed, usePinnedIds } from '@/hooks/usePinnedIds';
import type { PinningControls, TimelineTreeItem } from './TimelineTreeTable';

export interface TimelineTreeFilterSummary {
  isActive: boolean;
  matchCount: number;
  pinnableMatchIds: readonly string[];
}

export interface TimelineTreePinningSource {
  fullRoots: readonly TimelineTreeItem[];
  displayedRoots: readonly TimelineTreeItem[];
}

export function combineTimelineTreeFilters(
  filters: readonly TimelineTreeFilterSummary[]
): TimelineTreeFilterSummary {
  return {
    isActive: filters.some(filter => filter.isActive),
    matchCount: filters.reduce((total, filter) => total + filter.matchCount, 0),
    pinnableMatchIds: filters.flatMap(filter => filter.pinnableMatchIds),
  };
}

export function useCombinedTimelineTreePinning(sources: readonly TimelineTreePinningSource[]) {
  const { pinnedIds, togglePin, pinMany, clearPins, movePin } = usePinnedIds();
  const { isPinnedCollapsed, togglePinnedCollapsed } = usePinnedCollapsed();
  const { shownItems, hiddenCount } = useMemo(
    () =>
      resolvePinnedRows(
        pinnedIds,
        sources.flatMap(source => source.fullRoots),
        sources.flatMap(source => source.displayedRoots)
      ),
    [pinnedIds, sources]
  );
  const pinning = useMemo<PinningControls>(
    () => ({
      items: shownItems,
      hiddenCount,
      ids: pinnedIds,
      onToggle: togglePin,
      isCollapsed: isPinnedCollapsed,
      onToggleCollapsed: togglePinnedCollapsed,
      onClear: clearPins,
      onReorder: movePin,
    }),
    [
      clearPins,
      hiddenCount,
      isPinnedCollapsed,
      movePin,
      pinnedIds,
      shownItems,
      togglePin,
      togglePinnedCollapsed,
    ]
  );

  return { pinning, pinMany } as const;
}

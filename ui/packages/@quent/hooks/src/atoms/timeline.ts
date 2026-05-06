// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom } from 'jotai';
import type { ZoomRange, SingleTimelineResponse, TimelineRequest, TaskFilter } from '@quent/utils';

/**
 * All dimensions that distinguish a cached timeline entry.
 *
 * Extensibility: add an optional field here and include it in the join inside
 * `timelineCacheKey`. Every call site passes a plain object, so the function
 * signature never changes.
 */
export interface TimelineCacheParams {
  resourceId: string;
  resourceTypeName: string;
  operatorId?: string | null;
  fsmTypeName?: string | null;
}

/** Build a composite cache key for per-item timeline data */
export function timelineCacheKey(params: TimelineCacheParams): string {
  return [
    params.resourceId,
    params.resourceTypeName,
    params.operatorId ?? '',
    params.fsmTypeName ?? '',
  ].join('|');
}

/** Per-item timeline data keyed by `timelineCacheKey(...)` — record-based, replaces atomFamily */
export const timelineDataMapAtom = atom<Record<string, SingleTimelineResponse>>({});

/** Immediate zoom range — updated on every zoom gesture */
export const zoomRangeAtom = atom<ZoomRange>({ start: 0, end: 0 });

/** Debounced zoom range — settles after ZOOM_DEBOUNCE_MS, drives the bulk query */
export const debouncedZoomRangeAtom = atom<ZoomRange>({ start: 0, end: 0 });

/** Which timeline row is currently hovered (for tooltip display) */
export const hoveredTimelineIdAtom = atom<string | null>(null);

/**
 * Pointer-level hover state used to drive an app-rendered timeline tooltip.
 *
 * Distinct from `hoveredTimelineIdAtom` (which is set by row-level mouse
 * enter/leave on the table cell wrapper to highlight a tree row): this atom
 * is written by the chart's own pointermove handler and carries enough
 * information to render a tooltip outside ECharts — pointer viewport coords
 * for portal placement, the timestamp under the pointer for series lookup,
 * and the originating Timeline's stable id so only that Timeline renders the
 * tooltip (single-active invariant).
 */
export interface TimelineHoverState {
  /** Timestamp under the pointer, in ms (sub-ms precision). */
  timestampMs: number;
  /** Pointer viewport coords for portal placement. */
  clientX: number;
  clientY: number;
  /** Stable id of the Timeline that owns the hover. */
  sourceId: string;
}

export const timelineHoverAtom = atom<TimelineHoverState | null>(null);

/** Start time in milliseconds — set once per query, never changes */
export const startTimeMsAtom = atom(0);

/** Flips to true after the first bulk fetch completes — gates individual fallback queries */
export const bulkInitializedAtom = atom(false);

/** Visible entries for bulk fetch — set in useEffect, read imperatively via store.get() */
export const visibleEntriesAtom = atom<Record<string, TimelineRequest<TaskFilter>>>({});

/** When true, hides task annotation marks on timeline charts */
export const hideTasksAtom = atom(false);

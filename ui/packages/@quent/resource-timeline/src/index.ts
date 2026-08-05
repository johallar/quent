// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export { ResourceTimeline } from './timeline/components/ResourceTimeline';
export type { ResourceTimelineProps } from './timeline/components/ResourceTimeline';
export { TimelineController } from './timeline/components/TimelineController';
export { TimelineRuler } from './timeline/components/TimelineRuler';
export { TooltipContent } from './timeline/components/TimelineTooltip';
export type { ActiveMark } from './timeline/components/TimelineTooltip';
export { TimelineTooltipPortal } from './timeline/components/TimelineTooltipPortal';
export {
  buildBinnedTimelineSeries,
  buildBulkParamsForItem,
  buildTimelineMarks,
  collectVisibleEntries,
  dimSeries,
  findItemById,
  getAdaptiveNumBins,
  getFsmTypeName,
  getLongEntitiesThreshold,
  getLongFsms,
  getResourceTypeName,
  getTimelineConfig,
  mergeOverlaySeries,
  MIN_BIN_DURATION_NS,
  MIN_ZOOM_WINDOW_S,
  nanosToMs,
  setOperatorOnEntries,
  setOperatorOnEntry,
} from './timeline/timeline.utils';
export type { TimelineTreeItem } from './timeline/timeline.utils';
export { timelineCacheKey } from './timeline/state/timeline';
export type { TimelineCacheParams, TimelineHoverState } from './timeline/state/timeline';
export { bulkEntryId } from './timeline/hooks/timeline.utils';
export { useBulkTimelines } from './timeline/hooks/useBulkTimelines';
export type { TreeNode } from './timeline/hooks/useBulkTimelines';
export {
  applyBulkTimelineResponse,
  buildMergedBulkEntries,
  useBulkTimelineFetch,
} from './timeline/hooks/useBulkTimelineFetch';
export type { BulkTimelineIdMeta, MergedBulkEntries } from './timeline/hooks/useBulkTimelineFetch';
export {
  useBulkInitialized,
  useDebouncedZoomRange,
  useHideTasks,
  useHydrateTimelineAtoms,
  useSetBulkInitialized,
  useSetDebouncedZoomRange,
  useSetHideTasks,
  useSetStartTimeMs,
  useSetTimelineHover,
  useSetVisibleEntries,
  useSetZoomRange,
  useStartTimeMs,
  useTimelineData,
  useTimelineHover,
  useVisibleEntries,
  useZoomRange,
} from './timeline/hooks/useTimelineAtoms';

export {
  broadcastSyncedPointer,
  connectChart,
  hideSyncedPointer,
  registerAxisPointerSync,
  unregisterAxisPointerSync,
} from '@quent/viz-core';
export type { AxisPointerSyncOptions } from '@quent/viz-core';
export { getTimelineXAxisIntervalMs } from '@quent/viz-timeline';

export { useTimelineToolbarControls } from './timeline/hooks/useTimelineToolbarControls';

export { useDeferredReady } from './timeline/hooks/useDeferredReady';

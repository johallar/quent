// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DEFAULT_STALE_TIME, fetchSingleTimeline } from '@quent/client';
import {
  useBulkInitialized,
  useDebouncedZoomRange,
  useZoomRange,
  useHideTasks,
  timelineCacheKey,
  useTimelineData,
  useSelectedNodeIds,
  useSelectedOperatorLabel,
  useDeferredReady,
  useSetTimelineHover,
} from '@quent/hooks';
import { TimelineSkeleton } from './TimelineSkeleton';
import { TimelineTooltipPortal } from './TimelineTooltipPortal';
import type { TimelineHoverPosition } from './Timeline';
import { useCallback, useEffect, useId, useMemo, useRef, lazy, Suspense } from 'react';
import {
  buildBinnedTimelineSeries,
  buildTimelineMarks,
  dimSeries,
  getLongFsms,
  mergeOverlaySeries,
  getAdaptiveNumBins,
  getTimelineConfig,
  getLongEntitiesThreshold,
  nanosToMs,
  sliceToViewport,
} from '../lib/timeline.utils';
import { TimelineSeries, TimelineMark } from './types';
import { EntityTypeKey } from '@quent/utils';
import { WHITE, withOpacity, type PaletteTheme } from '@quent/utils';
import type {
  SingleTimelineResponse,
  SingleTimelineRequest,
  QueryFilter,
  TaskFilter,
  CapacityDecl,
  QuantitySpec,
  FsmTypeDecl,
} from '@quent/utils';
const Timeline = lazy(() => import('./Timeline').then(mod => ({ default: mod.Timeline })));

type ResourceTimelineProps = {
  engineId: string;
  queryId: string;
  resourceId: string;
  resourceType: string;
  startTime: bigint;
  durationSeconds: number;
  fsmTypeName?: string | undefined;
  resourceTypeName?: string;
  instanceName?: string;
  showTooltip?: boolean;
  /** Pre-fetched timeline data from bulk endpoint; skips individual fetch when present */
  preloadedData?: SingleTimelineResponse;
  capacities?: CapacityDecl[];
  quantitySpecs?: { [key in string]?: QuantitySpec };
  fsmTypes?: { [key in string]?: FsmTypeDecl };
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
};

const EMPTY_TIMELINE_SERIES: TimelineSeries = {
  empty: {
    color: withOpacity(WHITE, 0),
    binDuration: 0,
    values: [],
    formatter: (value: number) => `${value}`,
  },
};

/** Fraction of the visible window pre-loaded on each side (0.5 = ±50%, total 2x). */
const SINGLE_PRELOAD_MARGIN_FRACTION = 1;

/** Per-resource timeline with automatic data fetching, zoom sync, and operator overlay. */
export function ResourceTimeline({
  engineId,
  queryId,
  resourceId,
  resourceType,
  startTime,
  durationSeconds,
  fsmTypeName,
  resourceTypeName,
  showTooltip = true,
  capacities,
  quantitySpecs,
  fsmTypes,
  isDark,
}: ResourceTimelineProps) {
  const paletteTheme: PaletteTheme = isDark ? 'dark' : 'light';
  const deferredReady = useDeferredReady();
  // `zoomRange` is the debounced window — drives data fetches.
  // `viewportRange` is the live window — drives the per-frame display slice.
  const zoomRange = useDebouncedZoomRange();
  const viewportRange = useZoomRange();
  const bulkInitialized = useBulkInitialized();
  const operatorLabel = useSelectedOperatorLabel();
  const hideTasks = useHideTasks();

  const selectedNodeIds = useSelectedNodeIds();
  const operatorId = selectedNodeIds.size > 0 ? selectedNodeIds.values().next().value! : null;

  const cacheResourceTypeName =
    resourceType === EntityTypeKey.ResourceGroup ? (resourceTypeName ?? '') : '';
  const baseCacheKey = timelineCacheKey({
    resourceId,
    resourceTypeName: cacheResourceTypeName,
    fsmTypeName,
  });
  const preloadedData = useTimelineData(baseCacheKey);

  const operatorCacheKey = timelineCacheKey({
    resourceId,
    resourceTypeName: cacheResourceTypeName,
    fsmTypeName,
    operatorId,
  });
  const operatorTimelineData = useTimelineData(operatorCacheKey);
  // Preserve the last non-undefined overlay data while an operator is selected.
  // Without this, switching operators causes a one-render undimmed flash because
  // the new operator's atom is empty until the seed effect fires.
  const lastOverlayRef = useRef<typeof operatorTimelineData>(undefined);
  if (operatorTimelineData !== undefined) {
    lastOverlayRef.current = operatorTimelineData;
  } else if (!operatorId) {
    lastOverlayRef.current = undefined;
  }
  const overlayPreloadedData = operatorId
    ? (operatorTimelineData ?? lastOverlayRef.current)
    : undefined;

  const {
    data: fetchedData,
    isLoading,
    error,
  } = useQuery({
    queryKey: [
      'singleTimeline',
      engineId,
      queryId,
      resourceId,
      fsmTypeName,
      resourceTypeName,
      zoomRange,
    ],
    queryFn: () => {
      const isGroup = resourceType === EntityTypeKey.ResourceGroup;
      const visibleStart = zoomRange?.start ?? 0;
      const visibleEnd = zoomRange?.end ?? durationSeconds;
      const windowSeconds = visibleEnd - visibleStart;
      // Pre-load adjacent data for smoother pan/zoom: request a 2x window
      // centered on the current viewport with 2x bins so the visible area
      // keeps the same density. The display layer (sliceToViewport) clips
      // back to the live viewport, so panning within the cushion needs no
      // refetch and uses already-cached data.
      const halfMargin = windowSeconds * SINGLE_PRELOAD_MARGIN_FRACTION;
      const expansion = 1 + 2 * SINGLE_PRELOAD_MARGIN_FRACTION;
      const config = {
        num_bins: Math.round(getAdaptiveNumBins() * expansion),
        start: Math.max(0, visibleStart - halfMargin),
        end: Math.min(durationSeconds, visibleEnd + halfMargin),
      };
      const request: SingleTimelineRequest<QueryFilter, TaskFilter> = {
        entry: isGroup
          ? {
              ResourceGroup: {
                resource_group_id: resourceId,
                resource_type_name: resourceTypeName ?? '',
                long_entities_threshold_s: getLongEntitiesThreshold(windowSeconds),
                entity_filter: { entity_type_name: fsmTypeName ?? null },
                app_params: { operator_id: null },
                config,
              },
            }
          : {
              Resource: {
                resource_id: resourceId,
                long_entities_threshold_s: getLongEntitiesThreshold(windowSeconds),
                entity_filter: { entity_type_name: fsmTypeName ?? null },
                application: { operator_id: null },
                config,
              },
            },
        app_params: { query_id: queryId },
      };
      return fetchSingleTimeline(engineId, request, durationSeconds);
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: deferredReady && !preloadedData && bulkInitialized,
    placeholderData: keepPreviousData,
  });

  // Heavy build step: turn the API response into per-bin series + marks.
  // Re-runs only when the underlying data (or theme/capacities) change — NOT
  // on every pan/zoom event. The viewport-clipping below is done in a separate
  // memo so panning within the cushion only pays the cheap slicing cost.
  const built = useMemo(() => {
    const data = preloadedData ?? fetchedData;
    if (!data) return null;

    const base = buildBinnedTimelineSeries(
      data.data,
      data.config,
      startTime,
      paletteTheme,
      capacities,
      quantitySpecs,
      fsmTypes
    );
    const longFsms = getLongFsms(data.data);
    const filterSet =
      resourceType === EntityTypeKey.Resource ? new Set([resourceId]) : new Set<string>();

    const baseMarks = buildTimelineMarks(longFsms, startTime, paletteTheme, filterSet, fsmTypes);

    // Geometry needed by sliceToViewport — derived from the base data.config.
    const baseFirstBinMs = nanosToMs(startTime) + data.config.span.start * 1_000;
    const baseBinDurationMs = data.config.bin_duration * 1_000;
    const baseNumBins = Number(data.config.num_bins);

    let overlay: {
      result: { timestamps: number[]; series: TimelineSeries };
      firstBinMs: number;
      binDurationMs: number;
      numBins: number;
      overlayMarks: TimelineMark[] | undefined;
    } | null = null;

    if (operatorId && operatorLabel && overlayPreloadedData) {
      const baseSpan = getTimelineConfig(data).span;
      const opSpan = getTimelineConfig(overlayPreloadedData).span;
      if (baseSpan.start === opSpan.start && baseSpan.end === opSpan.end) {
        const opResult = buildBinnedTimelineSeries(
          overlayPreloadedData.data,
          overlayPreloadedData.config,
          startTime,
          paletteTheme,
          capacities,
          quantitySpecs,
          fsmTypes
        );
        const opLongFsmIds = new Set(getLongFsms(overlayPreloadedData.data).map(f => f.id));
        overlay = {
          result: opResult,
          firstBinMs: nanosToMs(startTime) + overlayPreloadedData.config.span.start * 1_000,
          binDurationMs: overlayPreloadedData.config.bin_duration * 1_000,
          numBins: Number(overlayPreloadedData.config.num_bins),
          overlayMarks: buildTimelineMarks(
            longFsms,
            startTime,
            paletteTheme,
            filterSet,
            fsmTypes,
            opLongFsmIds,
            operatorLabel
          ),
        };
      }
    }

    return {
      base,
      baseFirstBinMs,
      baseBinDurationMs,
      baseNumBins,
      baseMarks,
      overlay,
    };
  }, [
    preloadedData,
    fetchedData,
    operatorId,
    overlayPreloadedData,
    startTime,
    capacities,
    quantitySpecs,
    fsmTypes,
    resourceType,
    resourceId,
    operatorLabel,
    paletteTheme,
  ]);

  // Cheap per-frame step: clip the built series to the live viewport. This
  // re-runs on every pan/zoom event but only does an O(visibleBins) slice.
  const { timestamps, series, marks } = useMemo<{
    timestamps: number[];
    series: TimelineSeries;
    marks?: TimelineMark[];
  }>(() => {
    if (!built) return { timestamps: [], series: EMPTY_TIMELINE_SERIES };
    const hasViewport = viewportRange.end > viewportRange.start;

    const slicedBase = hasViewport
      ? sliceToViewport(
          built.base,
          built.baseFirstBinMs,
          built.baseBinDurationMs,
          built.baseNumBins,
          startTime,
          viewportRange
        )
      : built.base;

    if (operatorId && operatorLabel) {
      if (built.overlay) {
        const slicedOverlay = hasViewport
          ? sliceToViewport(
              built.overlay.result,
              built.overlay.firstBinMs,
              built.overlay.binDurationMs,
              built.overlay.numBins,
              startTime,
              viewportRange
            )
          : built.overlay.result;
        return {
          timestamps: slicedBase.timestamps,
          series: mergeOverlaySeries(slicedBase.series, slicedOverlay.series, operatorLabel),
          marks: built.overlay.overlayMarks,
        };
      }
      // Operator is selected but the overlay can't render this frame
      // (data not yet populated for the new operator, or zoom span mismatch).
      // Dim the base anyway so the chart never flashes back to full color
      // between the click and the new overlay arriving.
      return {
        timestamps: slicedBase.timestamps,
        series: dimSeries(slicedBase.series),
        marks: built.baseMarks,
      };
    }

    return { ...slicedBase, marks: built.baseMarks };
  }, [built, viewportRange, startTime, operatorId, operatorLabel]);

  // Bridge the chart's atom-unaware `onHoverChange` callback into the shared
  // `timelineHoverAtom` that the global tooltip portal subscribes to. The
  // stable per-row `ownerId` (from React's `useId`) tags writes so cleanups
  // (pointerleave, drag start, unmount) only clear the atom when *this* row
  // is the current owner — preventing a stale leave from clobbering a fresh
  // enter on a neighbouring row during fast pointer transitions.
  //
  // Declared before any conditional `return` so hook order stays stable
  // across the loading / error / data render branches.
  const ownerId = useId();
  const setTimelineHover = useSetTimelineHover();
  const handleHoverChange = useCallback(
    (position: TimelineHoverPosition | null) => {
      if (position == null) {
        setTimelineHover(prev => (prev?.sourceId === ownerId ? null : prev));
      } else {
        setTimelineHover({ ...position, sourceId: ownerId });
      }
    },
    [ownerId, setTimelineHover]
  );
  useEffect(() => {
    return () => {
      setTimelineHover(prev => (prev?.sourceId === ownerId ? null : prev));
    };
  }, [ownerId, setTimelineHover]);

  if (!preloadedData && (!deferredReady || isLoading)) {
    return <TimelineSkeleton />;
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8 text-red-400">
        Failed to load timeline
      </div>
    );
  }

  const effectiveMarks = hideTasks ? undefined : marks;

  return (
    <Suspense fallback={<TimelineSkeleton />}>
      <Timeline
        series={series}
        timestamps={timestamps ?? []}
        startTime={startTime}
        durationSeconds={durationSeconds}
        showTooltip={showTooltip}
        marks={effectiveMarks}
        isDark={isDark}
        onHoverChange={handleHoverChange}
      />
      {showTooltip && (
        <TimelineTooltipPortal
          ownerId={ownerId}
          series={series}
          timestamps={timestamps ?? []}
          marks={effectiveMarks}
          startTime={startTime}
        />
      )}
    </Suspense>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { DEFAULT_STALE_TIME, fetchSingleTimeline } from '@quent/client';
import {
  COLOR_REGISTRY_KEYS,
  timelineCacheKey,
  useBulkInitialized,
  useColorResolver,
  useDebouncedZoomRange,
  useDeferredReady,
  useOperatorSelection,
  useSelectedOperatorIds,
  useSetTimelineHover,
  useTimelineData,
  useTimelinePointerPublisher,
  useTimelinePointerRatio,
  useZoomRange,
} from '@quent/hooks';
import { EntityTypeKey, WHITE, withOpacity } from '@quent/utils';
import type {
  QuantitySpec,
  ResourceTypeDecl,
  SingleTimelineResponse,
} from '@quent/utils/query-engine';
import type { EChartsInstance } from 'echarts-for-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { TimelineTooltipPortal } from '../../timeline/TimelineTooltipPortal';
import { PlayheadLine } from '../../timeline/PlayheadLine';
import { useChartConnect } from '../../lib/useChartConnect';
import { MIN_ZOOM_WINDOW_S } from '../../lib/timeline.utils';
import { CHART_GROUP } from '../../timeline/types';
import type { TimelineHoverPosition } from '../../ui/charts/TimelineChart';
import { dimTimelineSeries, mergeTimelineOverlaySeries } from '../../ui/charts/timelineSeries';
import {
  ALL_FSMS_COLORS,
  buildResourceTimelineViewData,
} from '../../quent-views/resource-timeline/resourceTimelineViewModel';
import {
  ResourceTimelineView,
  type ResourceTimelineViewStatus,
} from '../../quent-views/resource-timeline/ResourceTimelineView';
import {
  adaptResourceTimelineResponse,
  buildSingleTimelineRequest,
  getTimelineConfig,
  resolveOverlayData,
  type RetainedOverlayData,
} from './resourceTimelineAdapter';

export interface ResourceTimelineProps {
  engineId: string;
  queryId: string;
  resourceId: string;
  resourceType: string;
  durationSeconds: number;
  fsmTypeName: string | null;
  resourceTypeName?: string;
  instanceName?: string;
  showTooltip?: boolean;
  preloadedData?: SingleTimelineResponse;
  resourceTypeDecl?: ResourceTypeDecl;
  quantitySpecs?: { [key in string]?: QuantitySpec };
  isDark: boolean;
  showPlayheadIndicator?: boolean;
}

/** Query-engine integration controller for a single resource timeline. */
export function ResourceTimeline({
  engineId,
  queryId,
  resourceId,
  resourceType,
  durationSeconds,
  fsmTypeName,
  resourceTypeName,
  showTooltip = true,
  preloadedData: suppliedPreloadedData,
  resourceTypeDecl,
  quantitySpecs,
  isDark,
  showPlayheadIndicator = false,
}: ResourceTimelineProps) {
  const allFsmsColor = ALL_FSMS_COLORS[isDark ? 'dark' : 'light'];
  const emptySeriesColor = withOpacity(WHITE, 0);
  const colorFsmState = useColorResolver(COLOR_REGISTRY_KEYS.FSM_STATES);
  const deferredReady = useDeferredReady();
  const requestZoomRange = useDebouncedZoomRange();
  const zoomRange = useZoomRange();
  const bulkInitialized = useBulkInitialized();
  const operatorSelection = useOperatorSelection();
  const selectedOperatorIds = useSelectedOperatorIds();
  const operatorIds = useMemo(() => [...selectedOperatorIds].sort(), [selectedOperatorIds]);
  const hasOperatorFilter = operatorIds.length > 0;
  const operatorLabel = useMemo(() => {
    const selections = [...operatorSelection.selections.values()];
    return selections.length === 1
      ? (selections[0]?.label ?? null)
      : selections.length > 1
        ? 'Selected operators'
        : null;
  }, [operatorSelection.selections]);

  const cacheResourceTypeName =
    resourceType === EntityTypeKey.ResourceGroup ? (resourceTypeName ?? '') : '';
  const baseCacheKey = timelineCacheKey({
    resourceId,
    resourceTypeName: cacheResourceTypeName,
    fsmTypeName,
  });
  const atomPreloadedData = useTimelineData(baseCacheKey);
  const preloadedData = suppliedPreloadedData ?? atomPreloadedData;

  const operatorCacheKey = timelineCacheKey({
    resourceId,
    resourceTypeName: cacheResourceTypeName,
    fsmTypeName,
    operatorIds,
  });
  const operatorTimelineData = useTimelineData(operatorCacheKey);
  /* eslint-disable react-hooks/refs */
  const lastOverlayRef = useRef<RetainedOverlayData | null>(null);
  if (operatorTimelineData !== undefined) {
    lastOverlayRef.current = { cacheKey: operatorCacheKey, data: operatorTimelineData };
  } else if (!hasOperatorFilter) {
    lastOverlayRef.current = null;
  }
  const overlayPreloadedData = resolveOverlayData(
    operatorTimelineData,
    lastOverlayRef.current,
    operatorCacheKey,
    hasOperatorFilter
  );
  /* eslint-enable react-hooks/refs */

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
      requestZoomRange,
    ],
    queryFn: () => {
      const startSeconds = requestZoomRange?.start ?? 0;
      const endSeconds = requestZoomRange?.end ?? durationSeconds;
      const request = buildSingleTimelineRequest({
        queryId,
        resourceId,
        resourceType,
        resourceTypeName,
        fsmTypeName,
        startSeconds,
        endSeconds,
      });
      return fetchSingleTimeline(engineId, request, durationSeconds);
    },
    staleTime: DEFAULT_STALE_TIME,
    enabled: deferredReady && !preloadedData && bulkInitialized,
    placeholderData: keepPreviousData,
  });

  const viewData = useMemo(() => {
    const data = preloadedData ?? fetchedData;
    if (!data) {
      return buildResourceTimelineViewData({
        spanStartSeconds: 0,
        binDurationSeconds: 0,
        numBins: 0,
        entries: [],
        emptySeriesColor,
      });
    }

    const base = buildResourceTimelineViewData(
      adaptResourceTimelineResponse(data.data, data.config, {
        colorFsmState,
        allFsmsColor,
        emptySeriesColor,
        resourceTypeDecl,
        quantitySpecs,
      })
    );

    if (!hasOperatorFilter || !operatorLabel) {
      return base;
    }
    if (overlayPreloadedData) {
      const baseSpan = getTimelineConfig(data).span;
      const overlaySpan = getTimelineConfig(overlayPreloadedData).span;
      if (baseSpan.start === overlaySpan.start && baseSpan.end === overlaySpan.end) {
        const overlay = buildResourceTimelineViewData(
          adaptResourceTimelineResponse(overlayPreloadedData.data, overlayPreloadedData.config, {
            colorFsmState,
            allFsmsColor,
            emptySeriesColor,
            resourceTypeDecl,
            quantitySpecs,
          })
        );
        return {
          ...base,
          series: mergeTimelineOverlaySeries(base.series, overlay.series, operatorLabel),
        };
      }
    }
    return { ...base, series: dimTimelineSeries(base.series) };
  }, [
    allFsmsColor,
    colorFsmState,
    emptySeriesColor,
    fetchedData,
    hasOperatorFilter,
    operatorLabel,
    overlayPreloadedData,
    preloadedData,
    quantitySpecs,
    resourceTypeDecl,
  ]);

  const ownerId = useId();
  const setTimelineHover = useSetTimelineHover();
  const [chartInstance, setChartInstance] = useState<EChartsInstance | null>(null);
  const { handleChartReady } = useChartConnect({ durationSeconds, chartGroup: CHART_GROUP });
  const handleReady = useCallback((instance: EChartsInstance) => {
    setChartInstance(instance);
  }, []);
  const handleHoverChange = useCallback(
    (position: TimelineHoverPosition | null) => {
      if (position == null) {
        setTimelineHover(previous => (previous?.sourceId === ownerId ? null : previous));
      } else {
        setTimelineHover({ ...position, sourceId: ownerId });
      }
    },
    [ownerId, setTimelineHover]
  );
  useEffect(
    () => () => {
      setTimelineHover(previous => (previous?.sourceId === ownerId ? null : previous));
    },
    [ownerId, setTimelineHover]
  );

  const pointerRatio = useTimelinePointerRatio();
  const { publish, clear } = useTimelinePointerPublisher();
  const handlePointerRatioChange = useCallback(
    (ratio: number | null) => {
      if (ratio == null) {
        clear();
      } else {
        publish(ratio);
      }
    },
    [clear, publish]
  );

  const status: ResourceTimelineViewStatus = error
    ? { state: 'error' }
    : !preloadedData && (!deferredReady || isLoading)
      ? { state: 'loading' }
      : {
          state: 'ready',
          data: { ...viewData, yAxisLabel: viewData.yAxisLabel ?? fsmTypeName ?? undefined },
        };

  const overlay =
    status.state === 'ready' ? (
      <>
        {showTooltip && (
          <TimelineTooltipPortal
            ownerId={ownerId}
            series={status.data.series}
            timestamps={status.data.timestamps}
          />
        )}
        <PlayheadLine instance={chartInstance} draggable showIndicator={showPlayheadIndicator} />
      </>
    ) : null;

  return (
    <ResourceTimelineView
      status={status}
      durationSeconds={durationSeconds}
      isDark={isDark}
      showTooltip={showTooltip}
      visibleStartMs={zoomRange.start * 1_000}
      visibleEndMs={zoomRange.end * 1_000}
      minZoomWindowSeconds={MIN_ZOOM_WINDOW_S}
      pointerRatio={pointerRatio}
      onPointerRatioChange={handlePointerRatioChange}
      onHoverChange={handleHoverChange}
      onChartReady={handleChartReady}
      onReady={handleReady}
      overlay={overlay}
    />
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  EntityTypeKey,
  MAX_TIMELINE_BINS,
  WHITE,
  formatQuantity,
  withOpacity,
  type ColorResolver,
} from '@quent/utils';
import type {
  BinnedSpanSec,
  OperatorFilter,
  QuantitySpec,
  QueryFilter,
  ResourceTimeline,
  ResourceTypeDecl,
  SingleTimelineRequest,
  SingleTimelineResponse,
} from '@quent/utils/query-engine';
import {
  buildResourceTimelineViewData,
  type ResourceTimelineSeriesInput,
} from '../../quent-views/resource-timeline/resourceTimelineViewModel';

export interface ResourceTimelineRequestOptions {
  queryId: string;
  resourceId: string;
  resourceType: string;
  resourceTypeName?: string;
  fsmTypeName: string | null;
  startSeconds: number;
  endSeconds: number;
}

/** Builds the query-engine request for one resource timeline. */
export function buildSingleTimelineRequest({
  queryId,
  resourceId,
  resourceType,
  resourceTypeName,
  fsmTypeName,
  startSeconds,
  endSeconds,
}: ResourceTimelineRequestOptions): SingleTimelineRequest<QueryFilter, OperatorFilter> {
  const config = {
    num_bins: MAX_TIMELINE_BINS,
    start: startSeconds,
    end: endSeconds,
  };
  const entry =
    resourceType === EntityTypeKey.ResourceGroup
      ? {
          ResourceGroup: {
            resource_group_id: resourceId,
            resource_type_name: resourceTypeName ?? '',
            long_entities_threshold_s: null,
            entity_filter: { entity_type_name: fsmTypeName },
            app_params: { operator_ids: [] },
            config,
          },
        }
      : {
          Resource: {
            resource_id: resourceId,
            long_entities_threshold_s: null,
            entity_filter: { entity_type_name: fsmTypeName },
            application: { operator_ids: [] },
            config,
          },
        };

  return { entry, app_params: { query_id: queryId } };
}

/** Overlay data retained for one canonical operator cache key. */
export interface RetainedOverlayData {
  cacheKey: string;
  data: SingleTimelineResponse;
}

/** Selects fresh or same-key retained overlay data. */
export function resolveOverlayData(
  currentData: SingleTimelineResponse | undefined,
  retainedData: RetainedOverlayData | null,
  currentCacheKey: string,
  hasOperatorFilter: boolean
): SingleTimelineResponse | undefined {
  if (!hasOperatorFilter) {
    return undefined;
  }
  return (
    currentData ?? (retainedData?.cacheKey === currentCacheKey ? retainedData.data : undefined)
  );
}

/** Derives a compact capacity label from query-bundle declarations. */
export function deriveCapacityLabel(
  resourceTypeDecl: ResourceTypeDecl | undefined,
  quantitySpecs: { [key in string]?: QuantitySpec } | undefined
): string | undefined {
  const meaningful =
    resourceTypeDecl?.capacities.filter(capacity => capacity.name !== 'unit') ?? [];
  if (meaningful.length === 0) {
    return undefined;
  }
  if (meaningful.length === 1) {
    const capacity = meaningful[0]!;
    const symbol = quantitySpecs?.[capacity.quantity]?.symbol;
    return symbol ? `${capacity.name} (${symbol})` : capacity.name;
  }
  const symbols = new Set(meaningful.map(capacity => quantitySpecs?.[capacity.quantity]?.symbol));
  const names = meaningful.map(capacity => capacity.name).join(' + ');
  const commonSymbol = symbols.size === 1 ? [...symbols][0] : undefined;
  return commonSymbol ? `${names} (${commonSymbol})` : names;
}

export interface AdaptResourceTimelineOptions {
  colorFsmState: ColorResolver;
  allFsmsColor: string;
  emptySeriesColor: string;
  resourceTypeDecl?: ResourceTypeDecl;
  quantitySpecs?: { [key in string]?: QuantitySpec };
}

/** Adapts query-engine timeline wire data into feature-scoped view input. */
export function adaptResourceTimelineResponse(
  data: ResourceTimeline,
  config: BinnedSpanSec,
  {
    colorFsmState,
    allFsmsColor,
    emptySeriesColor,
    resourceTypeDecl,
    quantitySpecs,
  }: AdaptResourceTimelineOptions
): ResourceTimelineSeriesInput {
  const formatterFor = (capacityName: string) => {
    const capacity = resourceTypeDecl?.capacities.find(
      candidate => candidate.name === capacityName
    );
    const quantitySpec = capacity ? quantitySpecs?.[capacity.quantity] : undefined;
    return quantitySpec && capacity
      ? (value: number, decimals: number = 2) =>
          formatQuantity(value, quantitySpec, capacity.kind, decimals)
      : (value: number) => String(value);
  };
  const entries: ResourceTimelineSeriesInput['entries'] = [];

  if ('Binned' in data) {
    for (const [capacity, values] of Object.entries(data.Binned.capacities_values)) {
      entries.push({
        name: capacity,
        color: allFsmsColor,
        values: values ?? [],
        formatter: formatterFor(capacity),
      });
    }
  } else {
    for (const [capacity, stateValues] of Object.entries(
      data.BinnedByState.capacities_states_values
    )) {
      for (const [state, values] of Object.entries(stateValues ?? {})) {
        if (values) {
          entries.push({
            name: state,
            color: colorFsmState(state),
            values,
            formatter: formatterFor(capacity),
          });
        }
      }
    }
  }

  return {
    spanStartSeconds: config.span.start,
    binDurationSeconds: config.bin_duration,
    numBins: Number(config.num_bins),
    entries,
    emptySeriesColor,
    yAxisLabel: deriveCapacityLabel(resourceTypeDecl, quantitySpecs),
  };
}

/** Compatibility transform retained for existing timeline consumers. */
export function buildBinnedTimelineSeries(
  data: ResourceTimeline,
  config: BinnedSpanSec,
  colorFsmState: ColorResolver,
  allFsmsColor: string,
  resourceTypeDecl?: ResourceTypeDecl,
  quantitySpecs?: { [key in string]?: QuantitySpec }
) {
  return buildResourceTimelineViewData(
    adaptResourceTimelineResponse(data, config, {
      colorFsmState,
      allFsmsColor,
      emptySeriesColor: withOpacity(WHITE, 0),
      resourceTypeDecl,
      quantitySpecs,
    })
  );
}

/** Extracts the binned span returned by the query engine. */
export function getTimelineConfig(response: SingleTimelineResponse): BinnedSpanSec {
  return response.config;
}

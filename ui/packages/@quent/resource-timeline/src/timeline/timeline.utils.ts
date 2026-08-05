// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFsmTypeColorFn } from '@quent/protocol';
import type { TimelineMark, TimelineSeries } from '@quent/viz-timeline';
import { formatAttributeValue, formatQuantity } from '@quent/protocol';
import { type PaletteTheme, WHITE, withOpacity, createCapacitiesColorFn } from '@quent/utils';
import type {
  ResourceTimeline,
  QuantitySpec,
  CapacityDecl,
  BinnedSpanSec,
  SingleTimelineResponse,
  FiniteStateMachine,
  FsmTypeDecl,
  TimelineRequest,
  OperatorFilter,
} from '@quent/protocol';
import type { TimelineConfig } from '@quent/protocol';
import type { QueryEntities } from '@quent/protocol';
import { EntityTypeKey } from '@quent/protocol';
import { MAX_TIMELINE_BINS } from '@quent/utils';

export interface TimelineTreeItem {
  id: string;
  type: string;
  entity?: object | null;
  children?: TimelineTreeItem[];
  availableResourceTypes?: string[];
}

const LONG_ENTITIES_BIN_MULTIPLIER = 30;

/** Minimum bin duration in nanoseconds — the backend cannot produce sub-1ns bins. */
export const MIN_BIN_DURATION_NS = 10;

/**
 * Minimum visible zoom window in seconds: the smallest window the backend can
 * bin at 1 ns/bin. 1 ns/bin × MAX_TIMELINE_BINS bins.
 */
export const MIN_ZOOM_WINDOW_S = (MIN_BIN_DURATION_NS * MAX_TIMELINE_BINS) / 1_000_000_000;

/** Convert a nanosecond-precision timestamp to milliseconds, preserving sub-ms precision. */
export function nanosToMs(ns: bigint | number): number {
  const bigNs = typeof ns === 'bigint' ? ns : BigInt(ns);
  return Number(bigNs / 1_000_000n) + Number(bigNs % 1_000_000n) / 1_000_000;
}

/**
 * Currently static but may be used in the future to prevent sub
 * nanosecond bin sizes
 */
export function getAdaptiveNumBins(): number {
  return MAX_TIMELINE_BINS;
}

/** Threshold for "long" entities: 10x the current bin duration in seconds. */
export function getLongEntitiesThreshold(windowSeconds: number): number {
  const numBins = getAdaptiveNumBins();
  return LONG_ENTITIES_BIN_MULTIPLIER * (windowSeconds / numBins);
}

export function buildBinnedTimelineSeries(
  data: ResourceTimeline,
  config: BinnedSpanSec,
  theme: PaletteTheme,
  capacities?: CapacityDecl[],
  quantitySpecs?: { [key in string]?: QuantitySpec },
  fsmTypes?: { [key in string]?: FsmTypeDecl }
): {
  timestamps: number[];
  series: TimelineSeries;
} {
  const { bin_duration, num_bins, span } = config;

  const numBinsNumber = Number(num_bins);
  // x-domain is relative to query start (ms); span.start is already relative
  // seconds, so no absolute epoch base is added — keeps values float64-exact.
  const firstBinMs = span.start * 1_000;
  const binDurationMs = bin_duration * 1_000;

  const timestamps = new Array<number>(numBinsNumber);
  for (let i = 0; i < numBinsNumber; i++) {
    timestamps[i] = firstBinMs + i * binDurationMs;
  }

  const getFormatter = (capacityName: string): ((value: number) => string) => {
    const capDecl = capacities?.find(c => c.name === capacityName);
    const spec = capDecl ? quantitySpecs?.[capDecl.quantity] : undefined;
    if (spec && capDecl) {
      return (value: number, decimals: number = 2) =>
        formatQuantity(value, spec, capDecl.kind, decimals);
    }
    return (value: number) => String(value);
  };

  // Build series based on data type
  const series: TimelineSeries = {};

  if ('Binned' in data) {
    // ResourceTimelineBinned: capacities_values (flat: capacity → values)
    const { capacities_values } = data.Binned;
    const capacityKeys = Object.keys(capacities_values).sort();
    const colorCapacity = createCapacitiesColorFn(capacityKeys, theme);
    for (const [capacity, values] of Object.entries(capacities_values)) {
      const formatter = getFormatter(capacity);
      series[capacity] = {
        color: colorCapacity(capacity),
        formatter,
        values: values ?? [],
        binDuration: bin_duration,
      };
    }
  } else if ('BinnedByState' in data) {
    const { capacities_states_values } = data.BinnedByState;
    const colorFsm = createFsmTypeColorFn(fsmTypes ?? {}, theme);
    for (const capacityType of Object.keys(capacities_states_values)) {
      const capacityStateValues = capacities_states_values[capacityType] ?? {};
      for (const [state, values] of Object.entries(capacityStateValues)) {
        const formatter = getFormatter(capacityType);
        if (values) {
          series[state] = {
            color: colorFsm(state),
            binDuration: bin_duration,
            formatter,
            values,
          };
        }
      }
    }
  }

  // Ensures the timeline is cleared when new "all 0" or "no series" data is received
  if (Object.keys(series).length === 0) {
    series['empty'] = {
      color: withOpacity(WHITE, 0),
      binDuration: bin_duration,
      formatter: (value: number) => String(value),
      values: [],
    };
  }
  return { timestamps, series };
}

/** Extract the config from a SingleTimelineResponse */
export function getTimelineConfig(response: SingleTimelineResponse): BinnedSpanSec {
  return response.config;
}

/** Extract long_fsms from a ResourceTimeline response. */
export function getLongFsms(data: ResourceTimeline): FiniteStateMachine[] {
  if ('Binned' in data) return data.Binned.long_fsms;
  if ('BinnedByState' in data) return data.BinnedByState.long_fsms;
  return [];
}

/**
 * Convert long_fsms into a flat array of timeline marks.
 * Each pair of consecutive transitions defines a time range for the state
 * entered by the first transition.
 * When resourceIdsForFilter is provided, only states that have at least one
 * usage on one of those resources are included (e.g. hide "queueing" on a resource lane).
 */
export function buildTimelineMarks(
  longFsms: FiniteStateMachine[],
  theme: PaletteTheme,
  resourceIdsForFilter?: Set<string> | null,
  fsmTypes?: { [key in string]?: FsmTypeDecl },
  /** When provided, marks whose FSM is in this set are highlighted; others are dimmed. */
  overlayFsmIds?: Set<string>,
  overlayLabel?: string
): TimelineMark[] | undefined {
  if (longFsms.length === 0) return undefined;

  const colorFsm = createFsmTypeColorFn(fsmTypes ?? {}, theme);

  const marks = longFsms.flatMap(fsm => {
    const label = fsm.instance_name || fsm.id;
    const inOverlay = overlayFsmIds ? overlayFsmIds.has(fsm.id) : undefined;
    return fsm.transitions
      .slice(0, -1)
      .map((transition, i) => {
        if (
          resourceIdsForFilter != null &&
          !transition.usages?.some(u => resourceIdsForFilter.has(u.resource))
        ) {
          return null;
        }
        const next = fsm.transitions[i + 1];
        const xStart = transition.timestamp * 1000;
        const xEnd = next.timestamp * 1000;
        const color = colorFsm(transition.name);
        return {
          label,
          stateName: transition.name,
          color,
          xStart,
          xEnd,
          // Tolerate responses from servers predating attributes.
          ...((transition.attributes?.length ?? 0) > 0 && {
            attributes: transition.attributes.map(attribute => ({
              key: attribute.key,
              value: formatAttributeValue(attribute.key, attribute.value),
            })),
          }),
          ...((transition.derived_attributes?.length ?? 0) > 0 && {
            derivedAttributes: transition.derived_attributes.map(attribute => ({
              key: attribute.key,
              value: formatAttributeValue(attribute.key, attribute.value),
            })),
          }),
          ...(inOverlay !== undefined && {
            isDimmed: !inOverlay,
            operatorName: inOverlay ? overlayLabel : undefined,
          }),
        };
      })
      .filter((m): m is TimelineMark => m != null && m.xEnd > m.xStart);
  });

  return marks.length > 0 ? marks : undefined;
}

/**
 * Mark every entry in a TimelineSeries as dimmed. Used both as the background
 * layer when an operator overlay is rendered and as a placeholder while the
 * overlay data for a freshly selected operator is still in flight (so the
 * chart doesn't flash to full color in the gap).
 */
export function dimSeries(series: TimelineSeries): TimelineSeries {
  const dimmed: TimelineSeries = {};
  for (const [state, entry] of Object.entries(series)) {
    dimmed[state] = { ...entry, isDimmed: true };
  }
  return dimmed;
}

/**
 * Merge overlay series into base series for overlay rendering.
 * Base series are dimmed; overlay series keep original colors so the
 * selected operator stands out clearly against the background.
 */
export function mergeOverlaySeries(
  baseSeries: TimelineSeries,
  overlaySeries: TimelineSeries,
  overlayLabel: string
): TimelineSeries {
  // Dim all base series to push them into the background.
  const merged: TimelineSeries = dimSeries(baseSeries);
  // Add overlay series at full intensity with original colors.
  for (const [state, overlayEntry] of Object.entries(overlaySeries)) {
    const baseEntry = baseSeries[state];
    const overlayName = `${state} (${overlayLabel})`;
    merged[overlayName] = {
      ...overlayEntry,
      color: baseEntry?.color ?? overlayEntry.color,
      isOverlay: true,
    };
  }
  return merged;
}

/** Extract the resource_type_name from a TimelineRequest (empty string for Resource requests) */
export function getResourceTypeName(params: TimelineRequest<OperatorFilter> | undefined): string {
  if (!params) return '';
  if ('ResourceGroup' in params) return params.ResourceGroup.resource_type_name;
  return '';
}

/** Extract the entity_type_name (FSM filter) from a TimelineRequest */
export function getFsmTypeName(params: TimelineRequest<OperatorFilter>): string | null {
  if ('ResourceGroup' in params) return params.ResourceGroup.entity_filter.entity_type_name;
  return params.Resource.entity_filter.entity_type_name;
}

/** Clone entries and set operator_id on each TimelineRequest */
export function setOperatorOnEntry(
  entry: TimelineRequest<OperatorFilter>,
  operatorId: string
): TimelineRequest<OperatorFilter> {
  if ('ResourceGroup' in entry) {
    return {
      ResourceGroup: {
        ...entry.ResourceGroup,
        app_params: { ...entry.ResourceGroup.app_params, operator_id: operatorId },
      },
    };
  }
  return {
    Resource: {
      ...entry.Resource,
      application: { ...entry.Resource.application, operator_id: operatorId },
    },
  };
}

export function setOperatorOnEntries(
  baseEntries: Record<string, TimelineRequest<OperatorFilter>>,
  operatorId: string
): Record<string, TimelineRequest<OperatorFilter>> {
  return Object.fromEntries(
    Object.entries(baseEntries).map(([id, entry]) => [id, setOperatorOnEntry(entry, operatorId)])
  );
}

/** Recursively find a TimelineTreeItem by id */
export function findItemById(root: TimelineTreeItem, id: string): TimelineTreeItem | undefined {
  if (root.id === id) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findItemById(child, id);
      if (found) return found;
    }
  }
  return undefined;
}

/** Look up the FSM type name for a leaf resource from the query entities.
 *  If exactly 1 FSM uses this resource type, return that FSM name.
 *  If >1 FSM types use it, return null (all FSMs). */
function lookupFsmTypeName(item: TimelineTreeItem, entities: QueryEntities): string | null {
  const typeName =
    item.entity && 'type_name' in item.entity ? (item.entity.type_name as string) : undefined;
  const usedBy = typeName ? entities.resource_types[typeName]?.used_by : undefined;
  if (usedBy && usedBy.length === 1) return usedBy[0]!;
  return null;
}

/** Build TimelineRequest params for a single tree item.
 *  @param groupFsmFilters — per-item FSM filter for resource groups.
 *    Map value: null = aggregate all FSMs, string = filter to that FSM type.
 *    Missing key = fall back to first `used_by` entry (single-FSM) or null (multi-FSM).
 */
export function buildBulkParamsForItem(
  item: TimelineTreeItem,
  selectedTypes: Map<string, string>,
  entities: QueryEntities,
  config: TimelineConfig,
  groupFsmFilters?: Map<string, string | null>,
  operatorId: string | null = null
): TimelineRequest<OperatorFilter> {
  const isGroup = item.type !== EntityTypeKey.Resource;
  const resourceTypeName = isGroup
    ? selectedTypes.get(item.id) || item.availableResourceTypes?.[0] || ''
    : undefined;
  const usedBy = resourceTypeName ? entities.resource_types[resourceTypeName]?.used_by : undefined;
  let fsmTypeName: string | null;
  if (usedBy?.length === 1) {
    fsmTypeName = usedBy[0]!;
  } else if (isGroup) {
    fsmTypeName = groupFsmFilters?.has(item.id) ? (groupFsmFilters.get(item.id) ?? null) : null;
  } else {
    fsmTypeName = lookupFsmTypeName(item, entities);
  }
  const threshold = getLongEntitiesThreshold(config.end - config.start);

  if (isGroup) {
    return {
      ResourceGroup: {
        resource_group_id: item.id,
        resource_type_name: resourceTypeName || '',
        long_entities_threshold_s: null,
        entity_filter: { entity_type_name: fsmTypeName },
        app_params: { operator_id: operatorId },
        config,
      },
    };
  }

  return {
    Resource: {
      resource_id: item.id,
      long_entities_threshold_s: threshold,
      entity_filter: { entity_type_name: fsmTypeName },
      application: { operator_id: operatorId },
      config,
    },
  };
}

/**
 * Collect all visible rows and their bulk request params.
 * A row is visible if it's the root or all of its ancestors are expanded.
 */
export function collectVisibleEntries(
  items: TimelineTreeItem[],
  expandedIds: Set<string>,
  selectedTypes: Map<string, string>,
  entities: QueryEntities,
  config: TimelineConfig,
  groupFsmFilters?: Map<string, string | null>,
  operatorId: string | null = null
): Record<string, TimelineRequest<OperatorFilter>> {
  const result: Record<string, TimelineRequest<OperatorFilter>> = {};

  function walk(item: TimelineTreeItem) {
    result[item.id] = buildBulkParamsForItem(
      item,
      selectedTypes,
      entities,
      config,
      groupFsmFilters,
      operatorId
    );

    if (item.children && expandedIds.has(item.id)) {
      for (const child of item.children) {
        walk(child);
      }
    }
  }

  for (const item of items) {
    walk(item);
  }
  return result;
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { TimelineMark } from '../timeline/types';
import { TreeTableItem } from '../resource-tree/types';
import { unpackEntityRef, resolveResourceFsmType, type ColorResolver } from '@quent/utils';
import type {
  ResourceTimeline,
  EntityRef,
  FiniteStateMachine,
  TimelineRequest,
  OperatorFilter,
  TimelineConfig,
} from '@quent/utils';
import { QueryEntities, ResourceTree } from '@quent/utils';
import { entityRefToEntitiesKey } from './queryBundle.utils';
import { collectResourceTypesFromTree, getIconForType } from './resource.utils';
import { EntityTypeValue, EntityRefKey, EntityTypeKey } from '@quent/utils';
import { LONG_ENTITY_DENSITIES, type LongEntityDensity } from '@quent/hooks';
import { MAX_TIMELINE_BINS } from '@quent/utils';

const LONG_ENTITY_DENSITY_MULTIPLIERS = [100, 10, 1, 0.1, 0.01] as const;

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

/** Threshold for "long" entities using the bin count returned by the timeline response. */
export function getLongEntitiesThreshold(
  windowSeconds: number,
  numBins: number,
  density: LongEntityDensity = 3
): number {
  return (
    LONG_ENTITY_DENSITY_MULTIPLIERS[density - LONG_ENTITY_DENSITIES[0]] * (windowSeconds / numBins)
  );
}

export { ALL_FSMS_COLORS } from '../quent-views/resource-timeline/resourceTimelineViewModel';
export {
  buildBinnedTimelineSeries,
  deriveCapacityLabel,
  getTimelineConfig,
} from '../query-engine/resource-timeline/resourceTimelineAdapter';

/** Extract long_fsms from a ResourceTimeline response. */
export function getLongFsms(data: ResourceTimeline): FiniteStateMachine[] {
  if ('Binned' in data) {
    return data.Binned.long_fsms;
  }
  if ('BinnedByState' in data) {
    return data.BinnedByState.long_fsms;
  }
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
  colorFsmState: ColorResolver,
  resourceIdsForFilter?: Set<string> | null,
  /** When provided, marks whose FSM is in this set are highlighted; others are dimmed. */
  overlayFsmIds?: Set<string>,
  overlayLabel?: string
): TimelineMark[] | undefined {
  if (longFsms.length === 0) {
    return undefined;
  }

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
        const color = colorFsmState(transition.name);
        return {
          label,
          stateName: transition.name,
          color,
          xStart,
          xEnd,
          // Tolerate responses from servers predating attributes.
          ...((transition.attributes?.length ?? 0) > 0 && { attributes: transition.attributes }),
          ...((transition.derived_attributes?.length ?? 0) > 0 && {
            derivedAttributes: transition.derived_attributes,
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

export {
  dimTimelineSeries as dimSeries,
  mergeTimelineOverlaySeries as mergeOverlaySeries,
} from '../ui/charts/timelineSeries';

/** Extract the resource_type_name from a TimelineRequest (empty string for Resource requests) */
export function getResourceTypeName(params: TimelineRequest<OperatorFilter> | undefined): string {
  if (!params) {
    return '';
  }
  if ('ResourceGroup' in params) {
    return params.ResourceGroup.resource_type_name;
  }
  return '';
}

/** Extract the entity_type_name (FSM filter) from a TimelineRequest */
export function getFsmTypeName(params: TimelineRequest<OperatorFilter>): string | null {
  if ('ResourceGroup' in params) {
    return params.ResourceGroup.entity_filter.entity_type_name;
  }
  return params.Resource.entity_filter.entity_type_name;
}

/** Clone an entry and set its operator filter. */
export function setOperatorOnEntry(
  entry: TimelineRequest<OperatorFilter>,
  operatorIds: readonly string[]
): TimelineRequest<OperatorFilter> {
  if ('ResourceGroup' in entry) {
    return {
      ResourceGroup: {
        ...entry.ResourceGroup,
        app_params: { ...entry.ResourceGroup.app_params, operator_ids: [...operatorIds] },
      },
    };
  }
  return {
    Resource: {
      ...entry.Resource,
      application: { ...entry.Resource.application, operator_ids: [...operatorIds] },
    },
  };
}

export function setOperatorOnEntries(
  baseEntries: Record<string, TimelineRequest<OperatorFilter>>,
  operatorIds: readonly string[]
): Record<string, TimelineRequest<OperatorFilter>> {
  return Object.fromEntries(
    Object.entries(baseEntries).map(([id, entry]) => [id, setOperatorOnEntry(entry, operatorIds)])
  );
}

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const NICE_TIMELINE_INTERVALS_MS = [
  0.001, // 1 µs
  0.002,
  0.005,
  0.01, // 10 µs
  0.02,
  0.05,
  0.1, // 100 µs
  0.2,
  0.5,
  1, // 1 ms
  2,
  5,
  10, // 10 ms
  20,
  50,
  100,
  200,
  500,
  1 * SECOND_MS,
  2 * SECOND_MS,
  5 * SECOND_MS,
  10 * SECOND_MS,
  15 * SECOND_MS,
  30 * SECOND_MS,
  1 * MINUTE_MS,
  2 * MINUTE_MS,
  5 * MINUTE_MS,
  10 * MINUTE_MS,
  15 * MINUTE_MS,
  30 * MINUTE_MS,
  1 * HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
  1 * DAY_MS,
  2 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
  14 * DAY_MS,
  30 * DAY_MS,
] as const;

/**
 * Pick a nice x-axis interval for timeline charts based on visible span.
 * Supports short spans (seconds) through long spans (multi-day).
 * `targetSplits` is treated as the minimum number of displayed splits/labels.
 */
export function getTimelineXAxisIntervalMs(spanMs: number, targetSplits: number = 8): number {
  const safeSpanMs = Math.max(MIN_ZOOM_WINDOW_S * 1000, spanMs);
  const minSplits = Math.max(2, targetSplits);
  // To display at least `minSplits`, interval must be <= span/(minSplits-1).
  const maxAllowedStep = safeSpanMs / (minSplits - 1);

  // Choose the largest "nice" interval that still satisfies the minimum split count.
  for (let i = NICE_TIMELINE_INTERVALS_MS.length - 1; i >= 0; i--) {
    const intervalMs = NICE_TIMELINE_INTERVALS_MS[i]!;
    if (intervalMs <= maxAllowedStep) {
      return intervalMs;
    }
  }

  // Fallback for very small spans where even the smallest nice interval is too coarse.
  return maxAllowedStep;
}

/**
 * Join `instance` to the named connect group and seed its dataZoom from the
 * caller-supplied zoom percentages. Callers (React components/hooks) are
 * expected to read the live zoom from `zoomRangeAtom` and pass it in here —
 * the atom is the single source of truth, so this utility never touches it
 * directly (per `ui/AGENTS.md` atoms are React-only).
 *
 * Pass `zoomPct = null` to skip seeding (e.g. when no zoom has been
 * established yet, like a 0-duration query).
 */
// Helper function to lookup entity from QueryEntities
const lookupEntity = (
  entities: QueryEntities,
  entityType: EntityRefKey,
  entityId: string
): EntityTypeValue | undefined => {
  const entityKey = entityRefToEntitiesKey(entityType);
  if (!entityKey) {
    return undefined;
  }

  const entityValue = entities[entityKey];

  // SingleEntity (Engine | Query): single object with id
  if ('id' in entityValue && entityValue.id === entityId) {
    return entityValue as EntityTypeValue;
  }

  // Record<string, EntityTypeValue>: lookup by entityId key
  return (entityValue as Record<string, EntityTypeValue>)?.[entityId];
};

export const transformResourceTree = (
  entities: QueryEntities,
  resourceTree: ResourceTree<EntityRef>
): TreeTableItem => {
  if ('ResourceGroup' in resourceTree) {
    const node = resourceTree.ResourceGroup;
    const { variant, typeName, id } = unpackEntityRef(node.id);
    const entity = lookupEntity(entities, variant, id);
    const children = node.children.map(child => transformResourceTree(entities, child));
    const containedResourceTypes = collectResourceTypesFromTree(children);
    const groupTypeName = entity && 'type_name' in entity ? entity.type_name : typeName;
    const declaredResourceTypes = groupTypeName
      ? (entities.resource_group_types[groupTypeName]?.contains_resource_types ?? [])
      : [];
    const availableResourceTypes = [
      ...declaredResourceTypes.filter(type => containedResourceTypes.includes(type)),
      ...containedResourceTypes.filter(type => !declaredResourceTypes.includes(type)),
    ];

    return {
      id,
      type: typeName,
      entity: entity as EntityTypeValue,
      icon: getIconForType(typeName),
      children,
      availableResourceTypes,
    };
  }

  const { variant, typeName, id } = unpackEntityRef(resourceTree.Resource);
  const entity = lookupEntity(entities, variant, id);

  return {
    id,
    type: typeName,
    entity: entity as EntityTypeValue,
    icon: getIconForType(typeName),
    children: [],
    availableResourceTypes: undefined,
  };
};

/** Recursively find a TreeTableItem by id */
export function findItemById(root: TreeTableItem, id: string): TreeTableItem | undefined {
  if (root.id === id) {
    return root;
  }
  if (root.children) {
    for (const child of root.children) {
      const found = findItemById(child, id);
      if (found) {
        return found;
      }
    }
  }
  return undefined;
}

/** Build TimelineRequest params for a single tree item.
 *  @param groupFsmFilters — per-item FSM filter for resource groups.
 *    Map value: null = aggregate all FSMs, string = filter to that FSM type.
 *    Missing key = use the first declared FSM type available for the resource type.
 */
/** The `type_name` of the entity behind a tree row, when it has one. */
function getTreeItemEntityTypeName(item: TreeTableItem): string | undefined {
  return item.entity && 'type_name' in item.entity ? (item.entity.type_name as string) : undefined;
}

export function buildBulkParamsForItem(
  item: TreeTableItem,
  selectedTypes: Map<string, string>,
  entities: QueryEntities,
  config: TimelineConfig,
  groupFsmFilters?: Map<string, string | null>,
  operatorIds: readonly string[] = []
): TimelineRequest<OperatorFilter> {
  const entityTypeName = getTreeItemEntityTypeName(item);

  if (item.type === EntityTypeKey.Resource) {
    const fsmTypeName = resolveResourceFsmType({
      resourceType: entityTypeName ? entities.resource_types[entityTypeName] : undefined,
    });

    return {
      Resource: {
        resource_id: item.id,
        long_entities_threshold_s: null,
        entity_filter: { entity_type_name: fsmTypeName },
        application: { operator_ids: [...operatorIds] },
        config,
      },
    };
  }

  const resourceTypeName = selectedTypes.get(item.id) || item.availableResourceTypes?.[0] || '';
  const fsmTypeName = resolveResourceFsmType({
    resourceType: entities.resource_types[resourceTypeName],
    selectedFsmType: groupFsmFilters?.get(item.id),
    resourceGroupType: entities.resource_group_types[entityTypeName ?? item.type],
  });

  return {
    ResourceGroup: {
      resource_group_id: item.id,
      resource_type_name: resourceTypeName,
      long_entities_threshold_s: null,
      entity_filter: { entity_type_name: fsmTypeName },
      app_params: { operator_ids: [...operatorIds] },
      config,
    },
  };
}

/**
 * Collect all visible rows and their bulk request params.
 * A row is visible if it's the root or all of its ancestors are expanded.
 * Extra items are requested too, even when the walk skips them, such as pinned rows under a
 * collapsed parent. A row the walk already reached keeps its entry.
 */
export function collectVisibleEntries(
  items: TreeTableItem[],
  expandedIds: Set<string>,
  selectedTypes: Map<string, string>,
  entities: QueryEntities,
  config: TimelineConfig,
  groupFsmFilters?: Map<string, string | null>,
  extraItems: readonly TreeTableItem[] = [],
  operatorIds: readonly string[] = []
): Record<string, TimelineRequest<OperatorFilter>> {
  const result: Record<string, TimelineRequest<OperatorFilter>> = {};

  const request = (item: TreeTableItem) =>
    buildBulkParamsForItem(item, selectedTypes, entities, config, groupFsmFilters, operatorIds);

  function walk(item: TreeTableItem) {
    result[item.id] = request(item);

    if (item.children && expandedIds.has(item.id)) {
      for (const child of item.children) {
        walk(child);
      }
    }
  }

  for (const item of items) {
    walk(item);
  }
  for (const item of extraItems) {
    result[item.id] ??= request(item);
  }
  return result;
}

export { computeVisibleMaxValue } from '../ui/charts/timelineVisibleMax';

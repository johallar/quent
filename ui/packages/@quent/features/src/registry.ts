// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { BuiltInContributionSlots, FeatureContribution } from './contributions';

declare const capabilityIdBrand: unique symbol;
declare const featureIdBrand: unique symbol;

export type CapabilityId = string & { readonly [capabilityIdBrand]: never };
export type FeatureId = string & { readonly [featureIdBrand]: never };

export function capabilityId<const TCapabilityId extends string>(
  id: TCapabilityId
): TCapabilityId & CapabilityId {
  return id as TCapabilityId & CapabilityId;
}

export function featureId<const TFeatureId extends string>(id: TFeatureId): TFeatureId & FeatureId {
  return id as TFeatureId & FeatureId;
}

export const CAPABILITY_IDS = {
  schemaFsm: capabilityId('schema.fsm'),
  schemaReferenceTree: capabilityId('schema.reference-tree'),
  schemaResource: capabilityId('schema.resource'),
  schemaQueryPlan: capabilityId('schema.query-plan'),
  serviceQueryEngine: capabilityId('service.query-engine'),
  serviceEntityList: capabilityId('service.entity-list'),
  serviceResourceTimeline: capabilityId('service.resource-timeline'),
  serviceDataFlow: capabilityId('service.data-flow'),
  serviceNvtx: capabilityId('service.nvtx'),
} as const;

export type BuiltInCapabilityId = (typeof CAPABILITY_IDS)[keyof typeof CAPABILITY_IDS];

export const FEATURE_IDS = {
  entities: featureId('entities'),
  entitiesResource: featureId('entities-resource'),
  entitiesQueryPlan: featureId('entities-query-plan'),
  referenceTree: featureId('reference-tree'),
  resource: featureId('resource'),
  queryEngineCore: featureId('query-engine-core'),
  queryPlan: featureId('query-plan'),
  queryEngineResource: featureId('query-engine-resource'),
  queryEngineDataFlow: featureId('query-engine-data-flow'),
  nvtx: featureId('nvtx'),
} as const;

export type BuiltInFeatureId = (typeof FEATURE_IDS)[keyof typeof FEATURE_IDS];

export interface FeatureDefinition<TFeatureId extends FeatureId = FeatureId> {
  readonly id: TFeatureId;
  readonly requiresCapabilities?: readonly CapabilityId[];
  readonly dependsOnFeatures?: readonly FeatureId[];
}

export type FeatureContributions<TSlots> = {
  readonly [TSlot in keyof TSlots]?: readonly (TSlots[TSlot] & FeatureContribution)[];
};

export interface FeatureRegistration<
  TSlots = BuiltInContributionSlots,
  TFeatureId extends FeatureId = FeatureId,
> extends FeatureDefinition<TFeatureId> {
  readonly contributions?: FeatureContributions<TSlots>;
}

export interface FeatureSet<TSlots = BuiltInContributionSlots> {
  readonly features: readonly FeatureRegistration<TSlots>[];
}

export interface CapabilitySet<TCapabilityId extends CapabilityId = CapabilityId> {
  readonly capabilities: readonly TCapabilityId[];
}

export interface CapabilityRegistry {
  readonly capabilityIds: readonly CapabilityId[];
  has(capabilityId: CapabilityId): boolean;
}

export interface UnavailableFeature {
  readonly featureId: FeatureId;
  readonly missingCapabilities: readonly CapabilityId[];
  readonly inactiveDependencies: readonly FeatureId[];
}

export interface RegisteredContribution<TContribution> {
  readonly featureId: FeatureId;
  readonly contribution: TContribution & FeatureContribution;
}

export interface FeatureRegistry<TSlots = BuiltInContributionSlots> {
  readonly featureIds: readonly FeatureId[];
  readonly capabilities: CapabilityRegistry;
  readonly unavailableFeatures: readonly UnavailableFeature[];
  has(featureId: FeatureId): boolean;
  get(featureId: FeatureId): FeatureRegistration<TSlots> | undefined;
  unavailable(featureId: FeatureId): UnavailableFeature | undefined;
  contributions<TSlot extends keyof TSlots>(
    slot: TSlot
  ): readonly RegisteredContribution<TSlots[TSlot]>[];
}

export function defineFeatureSet<TSlots = BuiltInContributionSlots>(
  features: readonly FeatureRegistration<TSlots>[]
): FeatureSet<TSlots> {
  return { features };
}

export function defineCapabilitySet<const TCapabilityId extends CapabilityId>(
  capabilities: readonly TCapabilityId[]
): CapabilitySet<TCapabilityId> {
  return { capabilities };
}

export function createCapabilityRegistry(capabilitySet: CapabilitySet): CapabilityRegistry {
  const ids = new Set<CapabilityId>();
  for (const id of capabilitySet.capabilities) {
    if (ids.has(id)) {
      throw new Error(`Duplicate capability "${id}"`);
    }
    ids.add(id);
  }

  return {
    capabilityIds: [...ids],
    has: id => ids.has(id),
  };
}

function orderFeatures<TSlots>(
  features: readonly FeatureRegistration<TSlots>[]
): readonly FeatureRegistration<TSlots>[] {
  const byId = new Map<FeatureId, FeatureRegistration<TSlots>>();
  for (const feature of features) {
    if (byId.has(feature.id)) {
      throw new Error(`Duplicate feature "${feature.id}"`);
    }
    byId.set(feature.id, feature);
  }

  const ordered: FeatureRegistration<TSlots>[] = [];
  const visiting = new Set<FeatureId>();
  const visited = new Set<FeatureId>();

  function visit(feature: FeatureRegistration<TSlots>): void {
    if (visited.has(feature.id)) {
      return;
    }
    if (visiting.has(feature.id)) {
      throw new Error(`Cyclic feature dependency involving "${feature.id}"`);
    }

    visiting.add(feature.id);
    for (const dependencyId of feature.dependsOnFeatures ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(`Feature "${feature.id}" depends on missing feature "${dependencyId}"`);
      }
      visit(dependency);
    }
    visiting.delete(feature.id);
    visited.add(feature.id);
    ordered.push(feature);
  }

  for (const feature of features) {
    visit(feature);
  }
  return ordered;
}

function validateContributions<TSlots>(features: readonly FeatureRegistration<TSlots>[]): void {
  const idsBySlot = new Map<keyof TSlots, Set<string>>();
  for (const feature of features) {
    for (const slot of Object.keys(feature.contributions ?? {}) as (keyof TSlots)[]) {
      const ids = idsBySlot.get(slot) ?? new Set<string>();
      idsBySlot.set(slot, ids);
      for (const contribution of feature.contributions?.[slot] ?? []) {
        if (ids.has(contribution.id)) {
          throw new Error(`Duplicate contribution "${contribution.id}" in slot "${String(slot)}"`);
        }
        ids.add(contribution.id);
      }
    }
  }
}

export function createFeatureRegistry<TSlots = BuiltInContributionSlots>(
  featureSet: FeatureSet<TSlots>,
  capabilitySet: CapabilitySet
): FeatureRegistry<TSlots> {
  const capabilities = createCapabilityRegistry(capabilitySet);
  const candidates = orderFeatures(featureSet.features);
  const activeFeatures: FeatureRegistration<TSlots>[] = [];
  const activeIds = new Set<FeatureId>();
  const unavailableFeatures: UnavailableFeature[] = [];

  for (const feature of candidates) {
    const missingCapabilities = (feature.requiresCapabilities ?? []).filter(
      capability => !capabilities.has(capability)
    );
    const inactiveDependencies = (feature.dependsOnFeatures ?? []).filter(
      dependency => !activeIds.has(dependency)
    );
    if (missingCapabilities.length > 0 || inactiveDependencies.length > 0) {
      unavailableFeatures.push({
        featureId: feature.id,
        missingCapabilities,
        inactiveDependencies,
      });
      continue;
    }
    activeFeatures.push(feature);
    activeIds.add(feature.id);
  }

  validateContributions(activeFeatures);
  const byId = new Map(activeFeatures.map(feature => [feature.id, feature]));
  const unavailableById = new Map(
    unavailableFeatures.map(unavailableFeature => [
      unavailableFeature.featureId,
      unavailableFeature,
    ])
  );

  return {
    featureIds: activeFeatures.map(feature => feature.id),
    capabilities,
    unavailableFeatures,
    has: featureId => byId.has(featureId),
    get: featureId => byId.get(featureId),
    unavailable: featureId => unavailableById.get(featureId),
    contributions: <TSlot extends keyof TSlots>(
      slot: TSlot
    ): readonly RegisteredContribution<TSlots[TSlot]>[] => {
      const registered = activeFeatures.flatMap(feature =>
        (feature.contributions?.[slot] ?? []).map(contribution => ({
          featureId: feature.id,
          contribution,
        }))
      );
      return registered.sort(
        (left, right) => (left.contribution.order ?? 0) - (right.contribution.order ?? 0)
      );
    },
  };
}

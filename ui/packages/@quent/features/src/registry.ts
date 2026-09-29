// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const FEATURE_IDS = {
  fsm: 'fsm',
  referenceTree: 'reference-tree',
  resource: 'resource',
  queryEngineCore: 'query-engine-core',
  queryPlan: 'query-plan',
  queryEngineResource: 'query-engine-resource',
  queryEngineDataFlow: 'query-engine-data-flow',
  nvtx: 'nvtx',
} as const;

export type BuiltInFeatureId = (typeof FEATURE_IDS)[keyof typeof FEATURE_IDS];
export type FeatureId = string;

export const CONTRIBUTION_SLOTS = {
  navigation: 'navigation',
  sidePanel: 'side-panel',
  timelineRow: 'timeline-row',
  detailSection: 'detail-section',
  stateCodec: 'state-codec',
} as const;

export type ContributionSlot = (typeof CONTRIBUTION_SLOTS)[keyof typeof CONTRIBUTION_SLOTS];

export interface FeatureContribution {
  readonly id: string;
  readonly order?: number;
}

export interface BuiltInContributionSlots {
  readonly navigation: FeatureContribution;
  readonly 'side-panel': FeatureContribution;
  readonly 'timeline-row': FeatureContribution;
  readonly 'detail-section': FeatureContribution;
  readonly 'state-codec': FeatureContribution;
}

export interface FeatureDefinition<TFeatureId extends FeatureId = FeatureId> {
  readonly id: TFeatureId;
  readonly dependencies?: readonly FeatureId[];
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

export interface FeatureSet<
  TSlots = BuiltInContributionSlots,
  TFeatureId extends FeatureId = FeatureId,
> {
  readonly features: readonly FeatureRegistration<TSlots, TFeatureId>[];
}

export interface RegisteredContribution<TContribution> {
  readonly featureId: FeatureId;
  readonly contribution: TContribution & FeatureContribution;
}

export interface FeatureRegistry<TSlots = BuiltInContributionSlots> {
  readonly featureIds: readonly FeatureId[];
  has(featureId: FeatureId): boolean;
  get(featureId: FeatureId): FeatureRegistration<TSlots> | undefined;
  contributions<TSlot extends keyof TSlots>(
    slot: TSlot
  ): readonly RegisteredContribution<TSlots[TSlot]>[];
}

export function defineFeatureSet<
  TSlots = BuiltInContributionSlots,
  const TFeatureId extends FeatureId = FeatureId,
>(features: readonly FeatureRegistration<TSlots, TFeatureId>[]): FeatureSet<TSlots, TFeatureId> {
  return { features };
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
    for (const dependencyId of feature.dependencies ?? []) {
      const dependency = byId.get(dependencyId);
      if (!dependency) {
        throw new Error(`Feature "${feature.id}" requires inactive feature "${dependencyId}"`);
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

export function createFeatureRegistry<TSlots = BuiltInContributionSlots>(
  featureSet: FeatureSet<TSlots>
): FeatureRegistry<TSlots> {
  const features = orderFeatures(featureSet.features);
  const byId = new Map(features.map(feature => [feature.id, feature]));

  return {
    featureIds: features.map(feature => feature.id),
    has: featureId => byId.has(featureId),
    get: featureId => byId.get(featureId),
    contributions: <TSlot extends keyof TSlots>(
      slot: TSlot
    ): readonly RegisteredContribution<TSlots[TSlot]>[] => {
      const registered = features.flatMap(feature =>
        (feature.contributions?.[slot] ?? []).map(contribution => ({
          featureId: feature.id,
          contribution,
        }))
      );
      const ids = new Set<string>();
      for (const { contribution } of registered) {
        if (ids.has(contribution.id)) {
          throw new Error(`Duplicate contribution "${contribution.id}" in slot "${String(slot)}"`);
        }
        ids.add(contribution.id);
      }
      return registered.sort(
        (left, right) => (left.contribution.order ?? 0) - (right.contribution.order ?? 0)
      );
    },
  };
}

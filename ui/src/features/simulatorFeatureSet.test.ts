// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CAPABILITY_IDS,
  createFeatureRegistry,
  defineCapabilitySet,
  FEATURE_IDS,
} from '@quent/features';
import { describe, expect, it } from 'vitest';
import { simulatorCapabilitySet, simulatorFeatureSet } from './simulatorFeatureSet';

describe('simulatorFeatureSet', () => {
  it('activates the full compatibility fixture with valid dependencies', () => {
    const registry = createFeatureRegistry(simulatorFeatureSet, simulatorCapabilitySet);

    expect(new Set(registry.featureIds)).toEqual(new Set(Object.values(FEATURE_IDS)));
    expect(registry.featureIds.indexOf(FEATURE_IDS.queryEngineCore)).toBeLessThan(
      registry.featureIds.indexOf(FEATURE_IDS.queryPlan)
    );
    expect(registry.featureIds.indexOf(FEATURE_IDS.resource)).toBeLessThan(
      registry.featureIds.indexOf(FEATURE_IDS.queryEngineResource)
    );
  });

  it('resolves a partial entity-only capability set', () => {
    const registry = createFeatureRegistry(
      simulatorFeatureSet,
      defineCapabilitySet([CAPABILITY_IDS.schemaFsm, CAPABILITY_IDS.serviceEntityList])
    );

    expect(registry.featureIds).toEqual([FEATURE_IDS.entities]);
  });

  it('rejects a capability-compatible feature with an inactive feature dependency', () => {
    const registry = createFeatureRegistry(
      simulatorFeatureSet,
      defineCapabilitySet([CAPABILITY_IDS.schemaResource, CAPABILITY_IDS.serviceResourceTimeline])
    );

    expect(registry.has(FEATURE_IDS.resource)).toBe(false);
    expect(registry.unavailable(FEATURE_IDS.resource)).toEqual({
      featureId: FEATURE_IDS.resource,
      missingCapabilities: [],
      inactiveDependencies: [FEATURE_IDS.referenceTree],
    });
  });

  it('resolves an empty capability set without activating features', () => {
    const registry = createFeatureRegistry(simulatorFeatureSet, defineCapabilitySet([]));

    expect(registry.featureIds).toEqual([]);
    expect(registry.unavailableFeatures).toHaveLength(Object.values(FEATURE_IDS).length);
  });
});

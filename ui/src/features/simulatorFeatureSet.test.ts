// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFeatureRegistry, FEATURE_IDS } from '@quent/features';
import { describe, expect, it } from 'vitest';
import { simulatorFeatureSet } from './simulatorFeatureSet';

describe('simulatorFeatureSet', () => {
  it('activates the simulator features with valid dependencies', () => {
    const registry = createFeatureRegistry(simulatorFeatureSet);

    expect(new Set(registry.featureIds)).toEqual(new Set(Object.values(FEATURE_IDS)));
    expect(registry.featureIds.indexOf(FEATURE_IDS.queryEngineCore)).toBeLessThan(
      registry.featureIds.indexOf(FEATURE_IDS.queryPlan)
    );
    expect(registry.featureIds.indexOf(FEATURE_IDS.resource)).toBeLessThan(
      registry.featureIds.indexOf(FEATURE_IDS.queryEngineResource)
    );
  });
});

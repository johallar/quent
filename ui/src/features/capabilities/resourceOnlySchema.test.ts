// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, createFeatureRegistry, resolveFeatureSetFromSchema } from '@quent/features';
import { describe, expect, it } from 'vitest';
import { resourceOnlySchema } from './resourceOnlySchema';

describe('resourceOnlySchema', () => {
  it('enables resource analysis without query-plan services', () => {
    const resolution = resolveFeatureSetFromSchema(resourceOnlySchema, {
      hostFeatures: [FEATURE_IDS.queryEngineCore],
    });
    const registry = createFeatureRegistry(resolution.featureSet);

    expect(registry.featureIds).toEqual([
      FEATURE_IDS.queryEngineCore,
      FEATURE_IDS.fsm,
      FEATURE_IDS.referenceTree,
      FEATURE_IDS.resource,
      FEATURE_IDS.queryEngineResource,
    ]);
    expect(registry.has(FEATURE_IDS.queryPlan)).toBe(false);
    expect(registry.has(FEATURE_IDS.queryEngineDataFlow)).toBe(false);
    expect(registry.has(FEATURE_IDS.nvtx)).toBe(false);
    expect(resolution.decisions.find(({ id }) => id === FEATURE_IDS.queryPlan)).toMatchObject({
      enabled: false,
      source: 'unavailable',
      evidence: 'The experimental Plan, Operator, and Port schema shape is absent.',
    });
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, createFeatureRegistry, resolveFeatureSetFromSchema } from '@quent/features';
import { describe, expect, it } from 'vitest';
import {
  queryPlanOnlySchema,
  resourceOnlySchema,
  resourceWithQueryPlanSchema,
} from './resourceOnlySchema';

function resolve(schema: typeof resourceOnlySchema) {
  const resolution = resolveFeatureSetFromSchema(schema, {
    hostFeatures: [FEATURE_IDS.queryEngineCore],
  });
  return {
    resolution,
    registry: createFeatureRegistry(resolution.featureSet),
  };
}

describe('schema capability fixtures', () => {
  it('enables resource analysis without query-plan services', () => {
    const { registry, resolution } = resolve(resourceOnlySchema);

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

  it('enables resource and query-plan analysis when both shapes are present', () => {
    const { registry } = resolve(resourceWithQueryPlanSchema);

    expect(registry.featureIds).toEqual([
      FEATURE_IDS.queryEngineCore,
      FEATURE_IDS.fsm,
      FEATURE_IDS.referenceTree,
      FEATURE_IDS.resource,
      FEATURE_IDS.queryEngineResource,
      FEATURE_IDS.queryPlan,
    ]);
  });

  it('enables only query-plan analysis for schemas without domain entities or resources', () => {
    const { registry, resolution } = resolve(queryPlanOnlySchema);
    const operator = queryPlanOnlySchema.entities.find(([path]) => path.name === 'Operator')?.[1];

    expect(registry.featureIds).toEqual([FEATURE_IDS.queryEngineCore, FEATURE_IDS.queryPlan]);
    expect(operator?.events.statistics?.payload.custom_attributes?.ty).toBe('DynamicRecord');
    expect(resolution.decisions.find(({ id }) => id === FEATURE_IDS.resource)).toMatchObject({
      enabled: false,
      source: 'unavailable',
    });
  });
});

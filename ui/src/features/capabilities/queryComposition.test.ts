// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, createFeatureRegistry, resolveFeatureSetFromSchema } from '@quent/features';
import { describe, expect, it } from 'vitest';
import { simulatorFeatureSet } from '@/features/simulatorFeatureSet';
import {
  queryPlanOnlySchema,
  resourceOnlySchema,
  resourceWithQueryPlanSchema,
} from './resourceOnlySchema';
import { resolveAvailableQueryTab, resolveQueryComposition } from './queryComposition';

function compositionFor(schema: typeof resourceOnlySchema) {
  const resolution = resolveFeatureSetFromSchema(schema, {
    hostFeatures: [FEATURE_IDS.queryEngineCore],
  });
  return resolveQueryComposition(createFeatureRegistry(resolution.featureSet));
}

describe('resolveQueryComposition', () => {
  it('returns resource and entity surfaces for the resource-only schema', () => {
    const composition = compositionFor(resourceOnlySchema);
    expect(composition).toMatchObject({
      showQueryPlan: false,
      showOperatorGantt: false,
      showDataFlow: false,
      showNvtx: false,
      tabs: [
        { id: 'timeline', label: 'Timeline' },
        { id: 'entities', label: 'Entities' },
      ],
    });
    expect(resolveAvailableQueryTab(composition, 'operators')).toBe('timeline');
  });

  it('adds plan surfaces to the resource composition', () => {
    expect(compositionFor(resourceWithQueryPlanSchema)).toMatchObject({
      showQueryPlan: true,
      showOperatorGantt: true,
      showDataFlow: false,
      showNvtx: false,
      tabs: [{ id: 'timeline' }, { id: 'operators' }, { id: 'entities' }],
    });
  });

  it('returns only the operators surface for a query-plan-only schema', () => {
    const composition = compositionFor(queryPlanOnlySchema);

    expect(composition).toMatchObject({
      showQueryPlan: true,
      showOperatorGantt: false,
      showDataFlow: false,
      showNvtx: false,
      tabs: [{ id: 'operators' }],
    });
    expect(resolveAvailableQueryTab(composition, 'timeline')).toBe('operators');
    expect(resolveAvailableQueryTab(composition, 'entities')).toBe('operators');
  });

  it('preserves all current simulator surfaces', () => {
    expect(resolveQueryComposition(createFeatureRegistry(simulatorFeatureSet))).toMatchObject({
      showQueryPlan: true,
      showOperatorGantt: true,
      showDataFlow: true,
      showNvtx: true,
      tabs: [{ id: 'timeline' }, { id: 'operators' }, { id: 'entities' }],
    });
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, createFeatureRegistry, resolveFeatureSetFromSchema } from '@quent/features';
import { describe, expect, it } from 'vitest';
import { simulatorFeatureSet } from '@/features/simulatorFeatureSet';
import {
  entitiesOnlySchema,
  queryPlanOnlySchema,
  queryPlanWithEntitiesSchema,
  resourceDefinitionsOnlySchema,
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

  it('returns only entities for an FSM/reference-tree schema', () => {
    const composition = compositionFor(entitiesOnlySchema);

    expect(composition.tabs).toEqual([
      expect.objectContaining({ id: 'entities', label: 'Entities' }),
    ]);
    expect(resolveAvailableQueryTab(composition, 'timeline')).toBe('entities');
  });

  it('combines query-plan and entity surfaces without a timeline', () => {
    expect(compositionFor(queryPlanWithEntitiesSchema)).toMatchObject({
      showQueryPlan: true,
      showOperatorGantt: false,
      tabs: [{ id: 'operators' }, { id: 'entities' }],
    });
  });

  it('returns no surface for resource definitions without an FSM consumer', () => {
    const composition = compositionFor(resourceDefinitionsOnlySchema);

    expect(composition.tabs).toEqual([]);
    expect(resolveAvailableQueryTab(composition, 'timeline')).toBeNull();
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

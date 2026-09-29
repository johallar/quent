// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, createFeatureRegistry, resolveFeatureSetFromSchema } from '@quent/features';
import { describe, expect, it } from 'vitest';
import { simulatorFeatureSet } from '@/features/simulatorFeatureSet';
import { resourceOnlySchema } from './resourceOnlySchema';
import { resolveAvailableQueryTab, resolveQueryComposition } from './queryComposition';

describe('resolveQueryComposition', () => {
  it('returns resource and entity surfaces for the resource-only schema', () => {
    const resolution = resolveFeatureSetFromSchema(resourceOnlySchema, {
      hostFeatures: [FEATURE_IDS.queryEngineCore],
    });

    const composition = resolveQueryComposition(createFeatureRegistry(resolution.featureSet));
    expect(composition).toMatchObject({
      showQueryPlan: false,
      showOperatorGantt: false,
      showNvtx: false,
      tabs: [
        { id: 'timeline', label: 'Timeline' },
        { id: 'entities', label: 'Entities' },
      ],
    });
    expect(resolveAvailableQueryTab(composition, 'operators')).toBe('timeline');
  });

  it('preserves all current simulator surfaces', () => {
    expect(resolveQueryComposition(createFeatureRegistry(simulatorFeatureSet))).toMatchObject({
      showQueryPlan: true,
      showOperatorGantt: true,
      showNvtx: true,
      tabs: [{ id: 'timeline' }, { id: 'operators' }, { id: 'entities' }],
    });
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  capabilityId,
  createCapabilityRegistry,
  createFeatureRegistry,
  defineCapabilitySet,
  defineFeatureSet,
  featureId,
} from './registry';

interface TestSlots {
  readonly panel: {
    readonly id: string;
    readonly order?: number;
    readonly title: string;
  };
}

describe('createFeatureRegistry', () => {
  const baseId = featureId('base');
  const dependentId = featureId('dependent');
  const inactiveId = featureId('inactive');
  const firstCapability = capabilityId('schema.first');
  const secondCapability = capabilityId('service.second');

  it('orders dependencies before dependents and contributions by order', () => {
    const registry = createFeatureRegistry<TestSlots>(
      defineFeatureSet<TestSlots>([
        {
          id: dependentId,
          dependsOnFeatures: [baseId],
          contributions: {
            panel: [{ id: 'second', order: 20, title: 'Second' }],
          },
        },
        {
          id: baseId,
          contributions: {
            panel: [{ id: 'first', order: 10, title: 'First' }],
          },
        },
      ]),
      defineCapabilitySet([])
    );

    expect(registry.featureIds).toEqual([baseId, dependentId]);
    expect(registry.contributions('panel')).toEqual([
      {
        featureId: baseId,
        contribution: { id: 'first', order: 10, title: 'First' },
      },
      {
        featureId: dependentId,
        contribution: { id: 'second', order: 20, title: 'Second' },
      },
    ]);
  });

  it('activates only features supported by capabilities and active dependencies', () => {
    const registry = createFeatureRegistry(
      defineFeatureSet([
        { id: baseId, requiresCapabilities: [firstCapability] },
        {
          id: dependentId,
          requiresCapabilities: [secondCapability],
          dependsOnFeatures: [baseId],
        },
      ]),
      defineCapabilitySet([secondCapability])
    );

    expect(registry.featureIds).toEqual([]);
    expect(registry.unavailable(baseId)).toEqual({
      featureId: baseId,
      missingCapabilities: [firstCapability],
      inactiveDependencies: [],
    });
    expect(registry.unavailable(dependentId)).toEqual({
      featureId: dependentId,
      missingCapabilities: [],
      inactiveDependencies: [baseId],
    });
  });

  it('rejects missing feature dependencies', () => {
    expect(() =>
      createFeatureRegistry(
        defineFeatureSet([{ id: dependentId, dependsOnFeatures: [inactiveId] }]),
        defineCapabilitySet([])
      )
    ).toThrow('Feature "dependent" depends on missing feature "inactive"');
  });

  it('rejects dependency cycles', () => {
    expect(() =>
      createFeatureRegistry(
        defineFeatureSet([
          { id: baseId, dependsOnFeatures: [dependentId] },
          { id: dependentId, dependsOnFeatures: [baseId] },
        ]),
        defineCapabilitySet([])
      )
    ).toThrow('Cyclic feature dependency');
  });

  it('rejects duplicate contribution IDs within a slot', () => {
    expect(() =>
      createFeatureRegistry<TestSlots>(
        defineFeatureSet<TestSlots>([
          {
            id: baseId,
            contributions: { panel: [{ id: 'duplicate', title: 'First' }] },
          },
          {
            id: dependentId,
            contributions: { panel: [{ id: 'duplicate', title: 'Second' }] },
          },
        ]),
        defineCapabilitySet([])
      )
    ).toThrow('Duplicate contribution "duplicate" in slot "panel"');
  });

  it('keeps capability IDs separate and rejects duplicates', () => {
    const capabilities = createCapabilityRegistry(
      defineCapabilitySet([firstCapability, secondCapability])
    );

    expect(capabilities.capabilityIds).toEqual([firstCapability, secondCapability]);
    expect(capabilities.has(firstCapability)).toBe(true);
    expect(() =>
      createCapabilityRegistry(defineCapabilitySet([firstCapability, firstCapability]))
    ).toThrow('Duplicate capability "schema.first"');
  });
});

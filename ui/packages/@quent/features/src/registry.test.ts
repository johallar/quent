// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { createFeatureRegistry, defineFeatureSet } from './registry';

interface TestSlots {
  readonly panel: {
    readonly id: string;
    readonly order?: number;
    readonly title: string;
  };
}

describe('createFeatureRegistry', () => {
  it('orders dependencies before dependents and contributions by order', () => {
    const registry = createFeatureRegistry<TestSlots>(
      defineFeatureSet<TestSlots>([
        {
          id: 'dependent',
          dependencies: ['base'],
          contributions: {
            panel: [{ id: 'second', order: 20, title: 'Second' }],
          },
        },
        {
          id: 'base',
          contributions: {
            panel: [{ id: 'first', order: 10, title: 'First' }],
          },
        },
      ])
    );

    expect(registry.featureIds).toEqual(['base', 'dependent']);
    expect(registry.contributions('panel')).toEqual([
      {
        featureId: 'base',
        contribution: { id: 'first', order: 10, title: 'First' },
      },
      {
        featureId: 'dependent',
        contribution: { id: 'second', order: 20, title: 'Second' },
      },
    ]);
  });

  it('rejects inactive dependencies', () => {
    expect(() =>
      createFeatureRegistry(defineFeatureSet([{ id: 'dependent', dependencies: ['inactive'] }]))
    ).toThrow('Feature "dependent" requires inactive feature "inactive"');
  });

  it('rejects dependency cycles', () => {
    expect(() =>
      createFeatureRegistry(
        defineFeatureSet([
          { id: 'first', dependencies: ['second'] },
          { id: 'second', dependencies: ['first'] },
        ])
      )
    ).toThrow('Cyclic feature dependency');
  });

  it('rejects duplicate contribution IDs within a slot', () => {
    const registry = createFeatureRegistry<TestSlots>(
      defineFeatureSet<TestSlots>([
        {
          id: 'first',
          contributions: { panel: [{ id: 'duplicate', title: 'First' }] },
        },
        {
          id: 'second',
          contributions: { panel: [{ id: 'duplicate', title: 'Second' }] },
        },
      ])
    );

    expect(() => registry.contributions('panel')).toThrow(
      'Duplicate contribution "duplicate" in slot "panel"'
    );
  });
});

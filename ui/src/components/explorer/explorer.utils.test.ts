// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TreeTableItem } from '@quent/components';
import { EntityTypeKey } from '@quent/utils';
import {
  filterLeafResources,
  flattenLeafResources,
  resolveFocusedResourceId,
} from './explorer.utils';

function resource(id: string, typeName: string, instanceName: string): TreeTableItem {
  return {
    id,
    type: EntityTypeKey.Resource,
    entity: { id, type_name: typeName, instance_name: instanceName },
  } as TreeTableItem;
}

const gpu = resource('gpu-1', 'GPU', 'Worker GPU');
const cpu = resource('cpu-1', 'CPU', 'Coordinator CPU');
const tree = {
  id: 'root',
  type: EntityTypeKey.ResourceGroup,
  entity: { id: 'root' },
  children: [
    gpu,
    {
      id: 'nested',
      type: EntityTypeKey.ResourceGroup,
      entity: { id: 'nested' },
      children: [cpu],
    },
  ],
} as TreeTableItem;

describe('explorer resource helpers', () => {
  it('flattens only leaf resources in tree order', () => {
    expect(flattenLeafResources(tree).map(item => item.id)).toEqual(['gpu-1', 'cpu-1']);
  });

  it('filters by type and case-insensitive identity search', () => {
    const leaves = flattenLeafResources(tree);
    expect(filterLeafResources(leaves, 'worker', 'GPU')).toEqual([gpu]);
    expect(filterLeafResources(leaves, 'CPU-1', null)).toEqual([cpu]);
  });

  it('keeps a visible focus and otherwise selects the first result', () => {
    expect(resolveFocusedResourceId('cpu-1', [gpu, cpu])).toBe('cpu-1');
    expect(resolveFocusedResourceId('cpu-1', [gpu])).toBe('gpu-1');
    expect(resolveFocusedResourceId('cpu-1', [])).toBeNull();
  });
});

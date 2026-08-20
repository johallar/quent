// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { TreeTableItem } from '@quent/components';
import { EntityTypeKey, type QueryEntities } from '@quent/utils';
import { filterResourceTree, parseResourceFilter } from './resourceFilter';

function resource(id: string, name: string, typeName: string): TreeTableItem {
  return {
    id,
    type: EntityTypeKey.Resource,
    entity: { id, instance_name: name, type_name: typeName, parent_group_id: 'workers' },
    children: [],
  };
}

function group(
  id: string,
  name: string,
  children: TreeTableItem[],
  typeName = 'ResourceGroup'
): TreeTableItem {
  return {
    id,
    type: EntityTypeKey.ResourceGroup,
    entity: { id, instance_name: name, type_name: typeName, parent_group_id: null },
    children,
  };
}

const gpu0 = resource('gpu-0', 'GPU 0', 'gpu');
const gpu1 = resource('gpu-1', 'GPU 1', 'gpu');
const cpu0 = resource('cpu-0', 'CPU 0', 'cpu');
const worker = group('worker-a', 'Worker A', [gpu0, gpu1]);
const root = group('query', 'Query resources', [worker, cpu0]);
const entities = {
  resource_types: {
    gpu: { used_by: ['task', 'transfer'], capacities: [] },
    cpu: { used_by: ['task'], capacities: [] },
  },
} as unknown as QueryEntities;

describe('parseResourceFilter', () => {
  it('parses free text, quoted values, and whitespace after a qualifier', () => {
    const parsed = parseResourceFilter('GPU name:"worker one" id: gpu-0 type:gpu');

    expect(parsed.nameTerms).toEqual(['gpu']);
    expect(parsed.filters.name).toEqual(['worker one']);
    expect(parsed.filters.id).toEqual(['gpu-0']);
    expect(parsed.filters.type).toEqual(['gpu']);
    expect(parsed.errors).toEqual([]);
    expect(parsed.canonicalQuery).toBe('gpu name:"worker one" id:gpu-0 type:gpu');
  });

  it('combines repeated and comma-separated qualifier values as alternatives', () => {
    const parsed = parseResourceFilter('id:gpu-0,gpu-1 id:cpu-0 fsm:task fsm:transfer');

    expect(parsed.filters.id).toEqual(['gpu-0', 'gpu-1', 'cpu-0']);
    expect(parsed.filters.fsm).toEqual(['task', 'transfer']);
  });

  it('reports unknown qualifiers, missing values, and unclosed quotes', () => {
    const parsed = parseResourceFilter('wat:value id: name:"unfinished');

    expect(parsed.errors).toEqual([
      'Unclosed quote',
      'Unknown qualifier "wat"',
      'Missing value for "id:"',
    ]);
  });
});

describe('filterResourceTree', () => {
  it('matches free-text names and preserves their ancestor path', () => {
    const result = filterResourceTree(root, entities, 'GPU 1');

    expect(result.filteredRoot?.children).toHaveLength(1);
    expect(result.filteredRoot?.children?.[0]?.children?.map(item => item.id)).toEqual(['gpu-1']);
    expect(result.directMatchIds).toEqual(new Set(['gpu-1']));
    expect(result.autoExpandedIds).toEqual(new Set(['worker-a', 'query']));
  });

  it('matches exact IDs and treats multiple ID values as alternatives', () => {
    const result = filterResourceTree(root, entities, 'id:gpu-0,cpu-0');

    expect(result.directMatchIds).toEqual(new Set(['gpu-0', 'cpu-0']));
    expect(result.matchCount).toBe(2);
    expect(result.filteredRoot?.children?.map(item => item.id)).toEqual(['worker-a', 'cpu-0']);
  });

  it('matches resource types and FSM declarations on leaf resources', () => {
    const result = filterResourceTree(root, entities, 'type:gpu fsm:transfer');

    expect(result.directMatchIds).toEqual(new Set(['gpu-0', 'gpu-1']));
    expect(result.filteredRoot?.children?.[0]?.children?.map(item => item.id)).toEqual([
      'gpu-0',
      'gpu-1',
    ]);
  });

  it('ANDs different qualifiers', () => {
    const result = filterResourceTree(root, entities, 'name:"GPU 0" fsm:task');

    expect(result.directMatchIds).toEqual(new Set(['gpu-0']));
  });

  it('retains a directly matched group subtree and expands the group', () => {
    const result = filterResourceTree(root, entities, 'id:worker-a');

    expect(result.filteredRoot?.children?.[0]).toBe(worker);
    expect(result.autoExpandedIds).toEqual(new Set(['worker-a', 'query']));
  });

  it('returns no tree when nothing matches', () => {
    const result = filterResourceTree(root, entities, 'id:missing');

    expect(result.filteredRoot).toBeNull();
    expect(result.matchCount).toBe(0);
  });

  it('returns the original tree for an empty or invalid-only query', () => {
    expect(filterResourceTree(root, entities, '').filteredRoot).toBe(root);
    expect(filterResourceTree(root, entities, 'unknown:value').filteredRoot).toBe(root);
  });
});

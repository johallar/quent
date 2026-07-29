// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TreeTableItem } from '@quent/components';
import { EntityTypeKey } from '@quent/utils';

export function flattenLeafResources(root: TreeTableItem): TreeTableItem[] {
  const resources: TreeTableItem[] = [];
  const stack = [root];

  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item.type === EntityTypeKey.Resource) {
      resources.push(item);
      continue;
    }
    if (item.children) stack.push(...item.children);
  }

  return resources.reverse();
}

export function getLeafResourceType(item: TreeTableItem): string {
  return 'type_name' in item.entity ? item.entity.type_name : '';
}

export function getLeafResourceLabel(item: TreeTableItem): string {
  if ('instance_name' in item.entity && item.entity.instance_name) {
    return item.entity.instance_name;
  }
  return item.id;
}

export function filterLeafResources(
  resources: TreeTableItem[],
  search: string,
  resourceType: string | null
): TreeTableItem[] {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return resources.filter(item => {
    const itemType = getLeafResourceType(item);
    if (resourceType && itemType !== resourceType) return false;
    if (!normalizedSearch) return true;

    return [item.id, getLeafResourceLabel(item), itemType].some(value =>
      value.toLocaleLowerCase().includes(normalizedSearch)
    );
  });
}

export function resolveFocusedResourceId(
  currentId: string | null,
  visibleResources: TreeTableItem[]
): string | null {
  if (currentId && visibleResources.some(resource => resource.id === currentId)) {
    return currentId;
  }
  return visibleResources[0]?.id ?? null;
}

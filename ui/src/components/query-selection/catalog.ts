// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DynamicAttribute } from '@quent/utils';
import { formatAttributeValue } from '@quent/utils';

export interface CatalogEntity {
  id: string;
  instance_name: string | null;
  custom_attributes: DynamicAttribute[];
}

export interface CatalogGroup<T> {
  id: string;
  label: string;
  items: T[];
}

export function attributeLabel(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export function attributeValue(
  attributes: DynamicAttribute[],
  key: string
): DynamicAttribute['value'] | undefined {
  return attributes.find(attribute => attribute.key === key)?.value;
}

export function catalogAttributeKeys(items: CatalogEntity[]): string[] {
  const keys = new Set<string>();
  for (const item of items) {
    for (const attribute of item.custom_attributes) {
      keys.add(attribute.key);
    }
  }
  return [...keys];
}

export function filterCatalogItems<T extends CatalogEntity>(items: T[], search: string): T[] {
  const needle = search.trim().toLocaleLowerCase();
  if (!needle) {
    return items;
  }

  return items.filter(item => {
    const searchable = [
      item.instance_name ?? '',
      item.id,
      ...item.custom_attributes.flatMap(attribute => [
        attribute.key,
        formatAttributeValue(attribute.key, attribute.value),
      ]),
    ];
    return searchable.some(value => value.toLocaleLowerCase().includes(needle));
  });
}

export function groupCatalogItems<T extends CatalogEntity>(
  items: T[],
  groupBy: string
): CatalogGroup<T>[] {
  if (!groupBy) {
    return [{ id: '', label: '', items }];
  }

  const groups = new Map<string, CatalogGroup<T>>();
  for (const item of items) {
    const value = attributeValue(item.custom_attributes, groupBy);
    const label = value == null ? 'Other' : formatAttributeValue(groupBy, value);
    const id = value == null ? '__other__' : label;
    const group = groups.get(id);
    if (group) {
      group.items.push(item);
    } else {
      groups.set(id, { id, label, items: [item] });
    }
  }
  return [...groups.values()];
}

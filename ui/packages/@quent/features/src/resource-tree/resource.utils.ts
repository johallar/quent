// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  EntityTypeKey,
  type EntityRefKey,
  type EntityRef,
  type EntityTypeValue,
  type QueryEntities,
  type ResourceTree,
} from '@quent/protocol';
import { TreeTableItem } from './types';
import { entityRefToEntitiesKey } from '../query-plan/queryBundle.utils';
import { Database, Folder, LineChart, LucideIcon, Network, Rocket, Star } from 'lucide-react';

/**
 * Recursively collect all unique resource type names from a tree of TreeTableItems.
 */
export function collectResourceTypesFromTree(items: TreeTableItem[]): string[] {
  const types = new Set<string>();

  const collect = (items: TreeTableItem[]) => {
    items.forEach(item => {
      if ('type_name' in item.entity && !item.children?.length) {
        const typeName = item.entity.type_name;
        if (typeName) types.add(typeName);
      }
      if (item.children?.length) collect(item.children);
    });
  };

  collect(items);
  return Array.from(types);
}

export function getIconForType(typeOrInstanceName: string): LucideIcon {
  switch (typeOrInstanceName) {
    // Entity types
    case EntityTypeKey.Resource:
      return LineChart;
    case EntityTypeKey.ResourceGroup:
      return Folder;
    // ResourceGroup type_names (for more specific icons)
    case 'Engine':
      return Database;
    case 'Network':
      return Network;
    case 'Worker':
      return Rocket;
    default:
      return Star;
  }
}

const lookupEntity = (
  entities: QueryEntities,
  entityType: EntityRefKey,
  entityId: string
): EntityTypeValue | undefined => {
  const entityKey = entityRefToEntitiesKey(entityType);
  if (!entityKey) return undefined;
  const entityValue = entities[entityKey];
  if ('id' in entityValue && entityValue.id === entityId) return entityValue as EntityTypeValue;
  return (entityValue as Record<string, EntityTypeValue>)?.[entityId];
};

export function transformResourceTree(
  entities: QueryEntities,
  resourceTree: ResourceTree<EntityRef>
): TreeTableItem {
  if ('ResourceGroup' in resourceTree) {
    const node = resourceTree.ResourceGroup;
    const [entityType, entityId] = Object.entries(node.id)[0] as [EntityRefKey, string];
    const entity = lookupEntity(entities, entityType, entityId);
    const children = node.children.map(child => transformResourceTree(entities, child));
    return {
      id: entityId,
      type: entityType,
      entity: entity as EntityTypeValue,
      icon: getIconForType(entityType),
      children,
      availableResourceTypes: collectResourceTypesFromTree(children),
    };
  }

  const [entityType, entityId] = Object.entries(resourceTree.Resource)[0] as [EntityRefKey, string];
  return {
    id: entityId,
    type: entityType,
    entity: lookupEntity(entities, entityType, entityId) as EntityTypeValue,
    icon: getIconForType(entityType),
    children: [],
    availableResourceTypes: undefined,
  };
}

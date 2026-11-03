// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { EntityTypeKey, resolveResourceFsmType } from '@quent/utils';
import type { EntityRef, QueryBundle } from '@quent/utils/query-engine';
import { UsageColumnView } from '../../quent-views/resource-timeline/UsageColumnView';
import type { TreeTableItem } from '../../resource-tree/types';
import { ResourceTimeline } from './ResourceTimeline';

export interface UsageColumnProps {
  item: TreeTableItem;
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
  selectedTypes: Map<string, string>;
  selectedFsmTypes?: Map<string, string | null>;
  durationSeconds: number;
  isDark: boolean;
  showPlayheadIndicator?: boolean;
}

/** Resolves query-bundle declarations before rendering a resource usage cell. */
export function UsageColumn({
  item,
  engineId,
  queryBundle,
  selectedTypes,
  selectedFsmTypes,
  durationSeconds,
  isDark,
  showPlayheadIndicator = false,
}: UsageColumnProps): React.ReactNode {
  const entity = item?.entity ?? {};
  const entityTypeName = 'type_name' in entity ? (entity.type_name as string) : undefined;
  const selectedType = selectedTypes.get(item.id) || item.availableResourceTypes?.[0] || '';
  const resourceType =
    item.type === EntityTypeKey.Resource ? EntityTypeKey.Resource : EntityTypeKey.ResourceGroup;
  const resourceTypeName =
    resourceType === EntityTypeKey.ResourceGroup ? selectedType : entityTypeName;
  const resourceTypeDecl = resourceTypeName
    ? queryBundle.entities.resource_types[resourceTypeName]
    : undefined;
  const isGroup = resourceType === EntityTypeKey.ResourceGroup;
  const fsmTypeName = resolveResourceFsmType({
    resourceType: resourceTypeDecl,
    selectedFsmType: isGroup ? selectedFsmTypes?.get(item.id) : undefined,
    resourceGroupType: isGroup
      ? queryBundle.entities.resource_group_types[entityTypeName ?? item.type]
      : undefined,
  });

  return (
    <UsageColumnView
      timeline={
        <ResourceTimeline
          engineId={engineId}
          queryId={queryBundle.query_id}
          resourceId={item.id}
          resourceType={resourceType}
          durationSeconds={durationSeconds}
          fsmTypeName={fsmTypeName}
          resourceTypeName={selectedType}
          resourceTypeDecl={resourceTypeDecl}
          quantitySpecs={queryBundle.quantity_specs}
          isDark={isDark}
          showPlayheadIndicator={showPlayheadIndicator}
        />
      }
    />
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { ResourceGroup, Resource, cn } from '@quent/utils';
import { TreeTableItem } from './types';
import { ResourceGroupRow } from './ResourceGroupRow';
import { ResourceRow } from './ResourceRow';

type ResourceColumnProps = {
  item: TreeTableItem;
  selectedType: string;
  onTypeChange: (itemId: string, type: string) => void;
  availableFsmTypes?: string[];
  selectedFsmType?: string | null;
  onFsmChange?: (itemId: string, fsmType: string | null) => void;
  trailingActions?: React.ReactNode;
  className?: string;
  verbose?: boolean;
};

/** Tree table column cell showing either a ResourceGroupRow or ResourceRow. */
export function ResourceColumn({
  item,
  selectedType,
  onTypeChange,
  availableFsmTypes,
  selectedFsmType,
  onFsmChange,
  trailingActions,
  className,
}: ResourceColumnProps): React.ReactNode {
  return (
    <div className={cn('text-foreground flex w-full min-w-0 items-center truncate', className)}>
      <div>{item.icon && <item.icon className="h-4 w-4 shrink-0 mr-4" />}</div>
      <div className="min-w-0 flex-1">
        {item.children?.length ? (
          <ResourceGroupRow
            group={item.entity as ResourceGroup}
            id={item.id}
            availableResourceTypes={item.availableResourceTypes}
            selectedType={selectedType}
            onTypeChange={onTypeChange}
            availableFsmTypes={availableFsmTypes}
            selectedFsmType={selectedFsmType}
            onFsmChange={onFsmChange}
          />
        ) : (
          <ResourceRow resource={item.entity as Resource} availableFsmTypes={availableFsmTypes} />
        )}
      </div>
      {trailingActions}
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Resource } from '@quent/utils';
import { DataText } from '../ui/data-text';

interface ResourceRowProps {
  resource: Resource;
  availableFsmTypes?: string[];
  trailingActions?: React.ReactNode;
}

/** Leaf row displaying a single resource's instance name, type, and FSM. */
export const ResourceRow = ({
  resource,
  availableFsmTypes,
  trailingActions,
}: ResourceRowProps): React.ReactNode => {
  const fsmType = availableFsmTypes?.length === 1 ? availableFsmTypes[0] : undefined;

  return (
    <div className="my-0.5 flex min-w-0 items-center gap-2">
      <div className="min-w-0 flex-1 truncate">
        <span className="text-xs font-bold leading-none">{resource.instance_name}</span>
        {resource.type_name !== resource.instance_name && resource.type_name && (
          <p className="mt-0.5 truncate text-[11px] font-normal leading-none text-muted-foreground">
            Type: <DataText className="text-foreground">{resource.type_name}</DataText>
          </p>
        )}
        {fsmType && (
          <p className="mt-0.5 truncate text-[11px] font-normal leading-none text-muted-foreground">
            FSM: <DataText className="text-foreground">{fsmType}</DataText>
          </p>
        )}
      </div>
      {trailingActions}
    </div>
  );
};

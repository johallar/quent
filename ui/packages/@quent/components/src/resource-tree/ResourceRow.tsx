// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Resource } from '@quent/utils';
import { DataText } from '../ui/data-text';

interface ResourceRowProps {
  resource: Resource;
}

/** Leaf row displaying a single resource's instance name and type. */
export const ResourceRow = ({ resource }: ResourceRowProps): React.ReactNode => {
  return (
    <div>
      <div>
        <span className="text-xs font-bold">
          <p>
          {resource.instance_name}
          </p>
          {resource.type_name !== resource.instance_name && resource.type_name && 
          <p className="text-xs text-muted-foreground font-normal">
            Type: <DataText className="text-foreground">{resource.type_name}</DataText>
          </p>
          }
        </span>
      </div>
    </div>
  );
};

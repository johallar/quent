// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Collapsible, CollapsibleContent } from '@quent/components';

interface AnimatedResourceChartRowProps {
  expanded: boolean;
  children: React.ReactNode;
}

export function AnimatedResourceChartRow({ expanded, children }: AnimatedResourceChartRowProps) {
  return (
    <Collapsible open={expanded}>
      <CollapsibleContent
        forceMount
        className="overflow-hidden data-[state=closed]:animate-chart-row-up data-[state=open]:animate-chart-row-down motion-reduce:animate-none"
        aria-hidden={!expanded}
      >
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

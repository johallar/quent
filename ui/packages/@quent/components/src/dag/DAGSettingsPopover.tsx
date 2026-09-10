// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Settings } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { DAGControls } from './DAGControls';

interface DAGSettingsPopoverProps {
  operatorStatFields: string[];
  portStatFields: string[];
  isDark: boolean;
}

export function DAGSettingsPopover({
  operatorStatFields,
  portStatFields,
  isDark,
}: DAGSettingsPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="DAG settings"
          className="mr-1 inline-flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          title="DAG settings"
        >
          <Settings className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="max-h-[min(70vh,36rem)] w-[min(36rem,calc(100vw-2rem))] overflow-y-auto p-0">
        <div className="border-b px-3 py-2 text-sm font-semibold">DAG settings</div>
        <DAGControls
          operatorStatFields={operatorStatFields}
          portStatFields={portStatFields}
          isDark={isDark}
        />
      </PopoverContent>
    </Popover>
  );
}

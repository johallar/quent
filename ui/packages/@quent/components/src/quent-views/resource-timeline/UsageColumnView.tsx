// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { DEFAULT_TIMELINE_HEIGHT } from '../../ui/charts/timelineTypes';

export interface UsageColumnViewProps {
  timeline: ReactNode;
}

/** Resource-table cell shell for an already adapted timeline. */
export function UsageColumnView({ timeline }: UsageColumnViewProps) {
  return (
    <div
      onClick={event => event.stopPropagation()}
      className="h-full w-full"
      style={{ minHeight: DEFAULT_TIMELINE_HEIGHT }}
    >
      {timeline}
    </div>
  );
}

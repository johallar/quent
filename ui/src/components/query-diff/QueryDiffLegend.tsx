// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { DataText } from '@quent/components';
import { cn } from '@quent/utils';

export interface QueryDiffLegendItem {
  id: string;
  label: ReactNode;
  color: string;
  roleLabel?: ReactNode;
}

interface QueryDiffLegendProps {
  items: readonly QueryDiffLegendItem[];
  title?: ReactNode;
  ariaLabel?: string;
  compact?: boolean;
  className?: string;
}

export function QueryDiffLegend({
  items,
  title = '',
  ariaLabel = 'Query diff legend',
  compact = false,
  className,
}: QueryDiffLegendProps) {
  if (items.length === 0) return null;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        'flex max-w-full min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground',
        !compact && 'rounded-sm border border-border bg-background/80 px-2 py-1',
        compact && 'justify-center',
        className
      )}
    >
      {title != null && (
        <span className="shrink-0 font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
      )}
      {items.map(item => (
        <span key={item.id} className="inline-flex min-w-0 items-center gap-1.5">
          <span
            className="h-2 w-2 shrink-0 rounded-[1px]"
            style={{ backgroundColor: item.color }}
            aria-hidden="true"
          />
          {item.roleLabel != null && (
            <span className="shrink-0 font-medium text-muted-foreground">{item.roleLabel}</span>
          )}
          <DataText
            className={cn('min-w-0 truncate text-foreground', compact ? 'max-w-28' : 'max-w-40')}
          >
            {item.label}
          </DataText>
        </span>
      ))}
    </div>
  );
}

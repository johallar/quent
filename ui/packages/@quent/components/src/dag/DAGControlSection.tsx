// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ElementType, ReactNode } from 'react';
import { cn } from '@quent/utils';

interface DAGControlSectionProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}

interface DAGControlFieldProps {
  label: string;
  icon: ElementType;
  trailingAdornment?: ReactNode;
  className?: string;
  align?: 'center' | 'start';
  children: ReactNode;
}

/** Reusable visual section for related DAG settings. */
export function DAGControlSection({
  title,
  description,
  action,
  children,
}: DAGControlSectionProps) {
  return (
    <section className="rounded-sm border border-border/70 bg-background/30">
      <header className="flex min-h-9 items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </h3>
          {description && (
            <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{description}</p>
          )}
        </div>
        {action}
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}

/** Responsive two-column grid for section controls. */
export function DAGControlGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-6 gap-y-2 lg:grid-cols-2">{children}</div>;
}

/** Aligns labels, controls, and optional adornments across a settings grid. */
export function DAGControlField({
  label,
  icon: Icon,
  trailingAdornment,
  className,
  align = 'center',
  children,
}: DAGControlFieldProps) {
  return (
    <div
      className={cn(
        'grid min-w-0 grid-cols-[7rem_minmax(0,1fr)_1.5rem] gap-2',
        align === 'center' ? 'items-center' : 'items-start',
        className
      )}
    >
      <div className={cn('flex min-w-0 items-center gap-1.5', align === 'start' && 'pt-1')}>
        <Icon className="size-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-xs text-muted-foreground">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
      <div className="flex size-6 items-center justify-center">{trailingAdornment}</div>
    </div>
  );
}

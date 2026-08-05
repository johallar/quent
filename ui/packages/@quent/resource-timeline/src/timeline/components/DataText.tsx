// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ComponentPropsWithoutRef, ElementType } from 'react';
import { cn } from '@quent/utils';

type DataTextProps<T extends ElementType = 'span'> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export function DataText<T extends ElementType = 'span'>({
  as,
  className,
  children,
  ...props
}: DataTextProps<T>) {
  const Tag = (as ?? 'span') as ElementType;
  return (
    <Tag className={cn('font-mono tracking-tight', className)} {...props}>
      {children}
    </Tag>
  );
}

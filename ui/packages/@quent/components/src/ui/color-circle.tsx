// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { cn } from '@quent/utils';

export function ColorCircle({ color, className }: { color: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-2 w-2 rounded-full shrink-0', className)}
      style={{ backgroundColor: color }}
    />
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useRef, useState } from 'react';
import { DataText, HoverCard, HoverCardContent, HoverCardTrigger } from '@quent/components';
import { cn } from '@quent/utils';

export function OverflowHoverCardContent({
  label,
  side = 'right',
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <HoverCardContent
      side={side}
      align="start"
      className="pointer-events-none w-auto max-w-sm bg-background p-2 text-foreground"
    >
      <DataText className="break-all text-xs">{label}</DataText>
    </HoverCardContent>
  );
}

export function OverflowingItemLabel({ label, className }: { label: string; className?: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    const trigger = triggerRef.current;
    setOpen(
      nextOpen &&
        !!trigger &&
        trigger.matches(':hover') &&
        trigger.scrollWidth > trigger.clientWidth
    );
  };

  return (
    <HoverCard open={open} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <span
          ref={triggerRef}
          className={cn('min-w-0 flex-1 truncate', className)}
          onPointerLeave={() => setOpen(false)}
          onBlur={() => setOpen(false)}
        >
          <DataText>{label}</DataText>
        </span>
      </HoverCardTrigger>
      <OverflowHoverCardContent label={label} />
    </HoverCard>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { ColorCircle } from './color-circle';
import { DataText } from './data-text';
import type { GanttHover } from './gantt-hover';

const POINTER_OFFSET = 12;
const VIEWPORT_MARGIN = 4;

export interface GanttTooltipItem {
  id: string;
  color: string;
  name: string;
  detail?: string;
}

export function GanttTooltipPortal({
  hover,
  items,
}: {
  hover: GanttHover | null;
  items: GanttTooltipItem[];
}) {
  if (!hover || items.length === 0) return null;
  return (
    <PointerTooltipPortal hover={hover}>
      <div className="max-h-[50vh] min-w-40 overflow-y-auto rounded bg-popover px-2 py-1.5 text-[11px] leading-tight text-foreground shadow-md">
        <ul className="space-y-1">
          {items.map(item => (
            <li key={item.id} className="flex min-w-0 items-center gap-1.5">
              <ColorCircle color={item.color} />
              <DataText className="min-w-0 truncate">{item.name}</DataText>
              {item.detail && (
                <DataText className="ml-auto shrink-0 text-muted-foreground">
                  {item.detail}
                </DataText>
              )}
            </li>
          ))}
        </ul>
      </div>
    </PointerTooltipPortal>
  );
}

export function PointerTooltipPortal({
  hover,
  children,
}: {
  hover: GanttHover | null;
  children: ReactNode;
}) {
  if (!hover) return null;
  return <PositionedPointerTooltip hover={hover}>{children}</PositionedPointerTooltip>;
}

function PositionedPointerTooltip({ hover, children }: { hover: GanttHover; children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState({
    left: hover.clientX + POINTER_OFFSET,
    top: hover.clientY + POINTER_OFFSET,
  });

  useLayoutEffect(() => {
    const element = hostRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    let left = hover.clientX + POINTER_OFFSET;
    let top = hover.clientY + POINTER_OFFSET;
    if (left + rect.width + VIEWPORT_MARGIN > window.innerWidth) {
      left = Math.max(VIEWPORT_MARGIN, hover.clientX - rect.width - POINTER_OFFSET);
    }
    if (top + rect.height + VIEWPORT_MARGIN > window.innerHeight) {
      top = Math.max(VIEWPORT_MARGIN, hover.clientY - rect.height - POINTER_OFFSET);
    }
    setPosition({ left, top });
  }, [hover.clientX, hover.clientY, children]);

  return createPortal(
    <div
      ref={hostRef}
      className="fixed z-[1000] pointer-events-none"
      style={{ left: position.left, top: position.top }}
    >
      {children}
    </div>,
    document.body
  );
}

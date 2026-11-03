// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { memo, useState, type CSSProperties } from 'react';
import { Handle, Position } from '@xyflow/react';
import { DataText } from '../../ui/data-text';
import type { QueryPlanNodeViewData } from './types';

const OPACITY_CLASSES = {
  full: 'opacity-100',
  dimmed: 'opacity-35',
  faded: 'opacity-20',
} as const;

function handlePosition(position: 'top' | 'bottom'): Position {
  return position === 'top' ? Position.Top : Position.Bottom;
}

/** Provider-free query-plan node with controlled presentation and interactions. */
export const QueryPlanNodeView = memo(({ data }: { data: QueryPlanNodeViewData }) => {
  const [hovered, setHovered] = useState(false);
  const { presentation } = data;
  const active = presentation.isSelected || presentation.isActiveHighlight;
  const handleHover = (next: boolean) => {
    setHovered(next);
    data.onHoverChange?.(next);
  };

  return (
    <div className={`${OPACITY_CLASSES[presentation.opacity]} z-10`}>
      <div
        className={`nodrag nopan z-10 w-full cursor-pointer rounded-md border px-4 py-2 text-foreground transition ${
          presentation.isSelected ? 'scale-110 border-2' : 'border'
        } ${active ? 'shadow-glow' : 'shadow-node'}`}
        onMouseEnter={() => handleHover(true)}
        onMouseLeave={() => handleHover(false)}
        style={
          {
            borderColor: presentation.borderColor,
            backgroundColor: hovered
              ? presentation.hoverBackgroundColor
              : presentation.backgroundColor,
            color: presentation.textColor,
            '--glow-color': 'hsl(var(--primary))',
          } as CSSProperties
        }
      >
        {data.hasIncoming && (
          <Handle
            type="target"
            position={handlePosition(data.incomingHandlePosition)}
            className="h-2 w-2 opacity-0"
          />
        )}

        <DataText
          as="div"
          className={`break-words text-center text-sm font-normal ${
            data.operationType === 'stage' || presentation.isSelected ? 'font-bold' : ''
          }`}
        >
          {data.label}
        </DataText>
        {data.formattedColorFieldValue != null && (
          <div
            className="mt-0.5 text-center text-xs"
            style={{ color: presentation.colorFieldTextColor }}
          >
            {data.formattedColorFieldValue}
          </div>
        )}

        {data.flowBar}

        {data.hasOutgoing && (
          <Handle
            type="source"
            position={handlePosition(data.outgoingHandlePosition)}
            className="h-2 w-2 opacity-0"
          />
        )}
      </div>
    </div>
  );
});

QueryPlanNodeView.displayName = 'QueryPlanNodeView';

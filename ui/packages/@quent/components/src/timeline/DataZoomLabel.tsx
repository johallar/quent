// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { forwardRef } from 'react';
import { TIMELINE_MONO_FONT } from './timelineEchartsTheme';
import { DATA_ZOOM_LABEL_FONT_SIZE } from './useDataZoomLabels';

interface DataZoomLabelProps {
  color: string;
  background: string;
}

/** Fixed-position chip label for a datazoom handle. Positioned imperatively via ref. */
export const DataZoomLabel = forwardRef<HTMLDivElement, DataZoomLabelProps>(
  ({ color, background }, ref) => (
    <div
      ref={ref}
      aria-hidden
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        // Off-screen until first positioned by the hook.
        transform: 'translate(-9999px, 0)',
        pointerEvents: 'none',
        color,
        fontSize: `${DATA_ZOOM_LABEL_FONT_SIZE}px`,
        fontFamily: TIMELINE_MONO_FONT,
        lineHeight: 1,
        whiteSpace: 'nowrap',
        zIndex: 1000,
        willChange: 'transform, top, left',
        backgroundColor: background,
        padding: '1px 4px',
        border: `1px solid ${color}`,
        borderRadius: '2px',
      }}
    />
  )
);

DataZoomLabel.displayName = 'DataZoomLabel';

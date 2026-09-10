<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Color assignment audit

Application-owned categorical colors now use the deterministic color core, either through a
query-scoped registry resolver or a locally precomputed deterministic map.

The following colors are assigned outside that mechanism:

## Backend-owned NVTX colors

- NVTX domain labels use the domain color returned by the NVTX API.
- NVTX marks and ranges use their API-provided colors.
- An NVTX item without a supplied color falls back to a fixed blue.

These assignments are preserved because the source trace owns their color semantics. See
`packages/@quent/components/src/nvtx-timeline/utils.ts` and
`packages/@quent/components/src/nvtx-timeline/NvtxGantt.tsx`.

## Continuous value scales

- Numeric DAG node and edge fields use the selected continuous palette.
- Operator Gantt bars reuse those continuous DAG colors when numeric coloring is active.
- Pivot-table numeric cells use continuous heatmap colors.

These are deterministic functions of a numeric value, observed range, selected palette, and theme;
they are not categorical identity assignments. See
`packages/@quent/hooks/src/dag/useNodeColoring.ts`,
`packages/@quent/components/src/operator-timeline/OperatorGanttChart.tsx`, and
`packages/@quent/components/src/pivot-table/utils.ts`.

## Fixed semantic and theme colors

- Timeline axes, markup, rollups, labels, grid, zoom controls, and empty-series placeholders use
  fixed theme colors.
- Selection, hover, error, text-contrast, borders, and surface colors use CSS theme tokens or fixed
  semantic constants.

These colors communicate UI state or provide chart chrome rather than identify domain values. See
`packages/@quent/components/src/timeline/timelineEchartsTheme.ts`, component style declarations,
and `src/index.css`.

## Result

No remaining application-owned categorical domain value is assigned by encounter order or mutable
module state. NVTX trace colors are the only externally assigned categorical colors.

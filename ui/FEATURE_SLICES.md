<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Hybrid feature slices and ports/adapters

Quent keeps product behavior grouped in `@quent/features`, while reusable timeline rendering is
separated by dependency direction. The package boundary is architectural: generic visualization
code cannot import backend contracts, API clients, Jotai state, or feature slices.

## Package graph

```text
@quent/utils ───────────────┐
                            v
@quent/viz-core <- @quent/viz-timeline <- @quent/resource-timeline <- @quent/features <- app
                                                ^
@quent/protocol <- @quent/client ───────────────┘
```

- `@quent/viz-core` owns ECharts registration, resize, connect groups, crosshair synchronization,
  and generic zoom/wheel mechanics.
- `@quent/viz-timeline` owns the backend-agnostic `Timeline` rendering port, view models, theme,
  visible-range calculations, and timeline spacing. It receives zoom and minimum-window policy.
- `@quent/resource-timeline` is the Quent adapter. It owns protocol-to-view-model transforms, API
  and cache hooks, Jotai timeline state, backend bin limits, resource tooltips, controller, and ruler.
- `@quent/features` owns product slices, shared UI composition, DAG selection, resource-tree rows,
  operator timelines, and transitional re-exports.
- `ui/src` owns route and application orchestration.

## Timeline port contract

`Timeline` consumes `TimelineSeries`, `TimelineMark`, `zoomRange`, and `minZoomSpanPct`. Its local
`TimelineAttribute` contains only display-ready values. `ResourceTimeline` maps generated protocol
attributes and quantity declarations into those view models before rendering.

DAG selection is injected into `ResourceTimeline` through props. Hovered-worker and selected-node
state therefore remain feature concerns and never invert the resource-to-feature dependency.

## Enforcement

ESLint blocks `@quent/protocol`, `@quent/client`, `@quent/resource-timeline`, `@quent/features`,
generated bindings, and Jotai imports throughout `viz-core` and `viz-timeline`. Cross-package imports
use package roots and every dependency is declared with `workspace:*`.

<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# UI dependency boundaries

Quent UI code follows a one-way dependency graph:

```text
applications → domain integrations → reusable Quent views → generic UI
       │              │                    │                  │
       └──────────────┴────────────────────┴──────────────────┴──→ utilities
                      └──→ clients / hooks / domain contracts
```

Dependencies point toward lower layers. Domain integrations may import reusable
views, but reusable views and generic UI cannot import upward.

## Generic UI

Generic UI has no Quent types, generated bindings, API calls, atoms, or domain
concepts in its public API. The currently enforced generic zone is:

```text
packages/@quent/components/src/ui/**
```

`cn` and `clamp` are temporarily imported from `@quent/utils`; ESLint permits
only those two names. `sliderField.utils.ts` is also temporarily allowed until
the generic zone becomes a physical package.

`SegmentedBar`, generic legends, `GroupedDataTable`, domain-free ECharts helpers,
and the controlled Timeline/Gantt rendering cores now live in this zone.
`ResourceTimeline`, `TimelineController`, `TimelineRuler`, `TimelineToolbar`,
`LongEntitiesGantt`, `OperatorGanttChart`, and `NvtxGantt` remain above generic;
their adapters own pointer, zoom, playhead, and chart-connect hook wiring.

## Reusable Quent views

The enforced reusable-view zone is:

```text
packages/@quent/components/src/quent-views/**
```

These views receive feature-scoped data, controlled state, and actions through
props. They may use stable Quent concepts, but cannot import domain contracts,
generated wire bindings, clients, hooks, or domain integration source.
The currently enforced restrictions name the query-engine contract and
integration explicitly. `quent-views/fsm-chart/**` and
`quent-views/resource-timeline/**`, `quent-views/query-plan/**`, and
`quent-views/pivot-table/**` are migrated slices. These views consume only
feature-scoped rendering data, status, presentation, and controlled interaction
props; they do not require Quent providers or global stores.

## Query-engine integration adapters

The currently enforced domain integration zone is:

```text
packages/@quent/components/src/query-engine/**
```

These adapters own QueryBundle interpretation, query-engine API and hook
integration, and conversion into feature-scoped view models. They may import
`quent-views/**` and generic UI. `query-engine/query-plan/**` and
`query-engine/resource-timeline/**`, and `query-engine/pivot-table/**` are
migrated slices. Query-plan controllers own QueryBundle adaptation, React Flow
state, global selection, coloring, palettes, data-flow synchronization, and
compatibility widgets. The resource timeline widget owns fetching, cache
identities, operator overlays, shared timeline state, request construction, and
QueryBundle declaration adaptation.

Generated QueryBundle and wire contracts have the explicit import surface
`@quent/utils/query-engine`. Existing `@quent/utils` root exports remain for
compatibility, but new query-engine integration code should use the dedicated
surface.

Future domains may define different analyzer projections and UI APIs. Each
should have a parallel integration adapter rather than extending
`query-engine/**` with unrelated domain concepts.

The package dependency direction remains:

```text
@quent/utils → @quent/client → @quent/hooks → @quent/components
```

An arrow means “may be imported by.” Reverse imports are forbidden.

## Applications

`src/**` and `simulator/**` own routing, URL policy, navigation, application
providers, app-specific composition, and simulator setup. Packages must never
import application code or use the `@/` alias.

Application code imports package roots only. It must not import generated
bindings or `@quent/*/src/**` paths directly.

## Transitional mixed directories

New code belongs in `ui/**`, `quent-views/**`, or `query-engine/**` according to
its contract. The legacy `dag/**`, `query-plan/**`, `timeline/**`,
`resource-tree/**`, `operator-timeline/**`,
`long-entities/**`, `gantt-chart/**`, and `nvtx-timeline/**` directories remain
mixed while later phases split their rendering and integration responsibilities.
The Phase 4a `ResourceTimeline` and `UsageColumn` exports and Phase 4b DAG and
query-plan exports are compatibility facades over migrated zones; the remaining
timeline and resource-tree products are still mixed.

## Phase 4a status

Phase 4a is complete for the Resource Timeline vertical slice.
`ResourceTimelineView` and `UsageColumnView` are provider-free, prop-driven
views. Their query-engine counterparts own API requests, React Query options,
cache keys, Jotai-backed synchronization, operator overlays, and QueryBundle
resolution. Existing `@quent/components` exports remain available through
facades, and no DAG, table, or application composition was moved in this phase.

## Phase 4b status

Phase 4b is complete for the DAG/query-plan vertical slice. Provider-free
`QueryPlanNodeView`, `DAGGraphView`, and `DAGLegendView` components live under
`quent-views/query-plan/**`. The query-engine integration retains QueryBundle
transforms, React Flow and Jotai controllers, data-flow metadata, selection,
coloring, and palette state. `useQueryPlanVisualization` is now a public
query-engine integration adapter, while application `QueryPlan.tsx` remains in
place for Phase 5. Existing public component exports continue through
compatibility facades; no table or other application product code moved in this
phase.

## Phase 4c status

Phase 4c is complete for the pivot-table vertical slice. Provider-free
`PivotedStatTableView` and `PivotTableToolbarView` components, pivot contracts,
and pivot utilities live under `quent-views/pivot-table/**`. They receive
display, palette, scale, drag/drop, hover, selection, and action state through
props. Query-engine adapters own `@quent/hooks` and Jotai-backed palette, scale,
and drag/drop integration while preserving the existing `PivotedStatTable` and
`PivotTableToolbar` APIs through compatibility facades. `GroupedDataTable`
remains generic UI. `EntityResults` remains in `src/**` because it still depends on
application-local row types, controls, and product policy; the broader entities
move remains Phase 5 scope.

## Enforcement

- `pnpm boundaries:check` validates source and package-to-package dependency
  edges.
- ESLint provides immediate errors for forbidden imports.
- Package typechecks compile each package independently.
- CI runs all three checks before the aggregate build.
- Dependency Cruiser and ESLint reject query-engine integration, client, hook,
  generated-binding, and domain-contract imports from `quent-views/**`.

When adding a dependency exception, update this document and the graph rule in
the same change. Exceptions must name a concrete migration boundary; broad
directory exemptions are not allowed.

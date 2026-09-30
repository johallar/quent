<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Quent UI architecture

Quent UI is moving toward capability-driven composition. Cohesive user-facing
features are selected from facts about the active analysis target rather than
from package presence or a one-to-one mapping to schema modules.

The contracts for this architecture exist today. Production routes, state,
data fetching, and visualizations are still being migrated from the app shell
and shared packages into feature packages.

## The three layers

### Capabilities

Capabilities are facts about an analysis target:

- `schema.*` capabilities come from canonical Quent schema metadata.
- `service.*` capabilities come from explicit runtime service metadata.

Examples include `schema.fsm`, `schema.resource`, `service.entity-list`, and
`service.resource-timeline`. Capability IDs and UI feature IDs are separate
types. A capability says that the target can support behavior; it does not
activate a UI package by itself.

### UI features

A UI feature owns cohesive user-facing behavior, such as the entity browser,
resource explorer, or query-plan viewer. Its registration declares:

- `requiresCapabilities`: schema and service facts required by the behavior.
- `dependsOnFeatures`: other UI behaviors that must already be active.
- Typed contributions to global or feature-local extension points.
- Eventually, the state, data access, and deep-link fields it owns.

Package names follow user-facing ownership rather than schema module names.
Cross-feature behavior belongs in a directional integration feature. For
example, `entities-query-plan` means query-plan-aware filters and details
contributed to the Entities UI; neither base feature imports the integration.

### Contributions

Contributions are typed extension points used to compose enabled features.
Global slots cover navigation, side panels, timeline rows, detail sections,
providers, data loaders, and state codecs. Feature-local slots let integrations
extend a base feature without creating reverse dependencies. The initial
entity slots cover filters, request decorators, and detail sections.

Disabled features must not fetch data, hydrate state, or serialize deep-link
fields.

## Composition flow

The intended startup flow is:

```text
schema metadata + service metadata
  -> capability set
  -> eligible built-in feature registrations
  -> dependency ordering
  -> ordered contributions
  -> providers, routes, navigation, panels, timelines, details, and codecs
```

The registry rejects duplicate feature or contribution IDs, missing feature
dependencies, and dependency cycles. It records why a feature is unavailable,
including missing capabilities and inactive feature dependencies.

## Who defines what

Instrumentation and query-engine authors provide:

- A Quent schema containing the semantics their instrumentation emits.
- Runtime service metadata describing the APIs available for that target.
- Service implementations that satisfy those advertised contracts.

They do not create a TypeScript feature-set file for each instrumented engine.

Quent UI feature authors provide:

- Feature registrations and capability requirements.
- Feature-owned UI, data adapters, state, and deep-link codecs.
- Integration features where behavior combines multiple base features.
- Tests for full, partial, incompatible, and unavailable compositions.

The application shell obtains target capabilities, resolves the registered
features, and renders their contributions. Route files remain thin adapters.

## Simulator fixture

`ui/src/features/simulatorFeatureSet.ts` currently contains two compatibility
fixtures:

- `simulatorFeatureSet` is the current catalog of built-in feature definitions.
- `simulatorCapabilitySet` models the simulator as supporting every known
  capability.

The file is currently consumed by tests, not by production app composition. It
is not a template for instrumentation authors. As feature extraction proceeds,
the built-in registrations should move to their owning packages and be
aggregated by the shell; the simulator capability set should remain a
full-capability development and compatibility fixture.

## Package boundaries

- Generic foundations (`@quent/client`, `@quent/components`,
  `@quent/features`, `@quent/hooks`, and `@quent/utils`) never import UI feature
  packages.
- Base features import only foundations, neutral visualization ports, and
  public capability contracts.
- Integration features may import the public APIs of every feature they
  combine.
- Base features define extension contracts but never import their integrations.
- Feature packages never import `ui/src`.
- Cross-package dependencies use `workspace:*`, and consumers import package
  roots rather than private source paths.

Dependency policy, manifest validation, ESLint restrictions, and
dependency-cruiser enforce these rules.

## Current migration boundary

The capability and feature contracts, contribution types, package policy, and
simulator resolution fixtures are in place. Most production behavior still
lives in `ui/src` or the existing generic packages. Do not describe package
scaffolding as a completed feature extraction until its UI, data access, state,
deep links, tests, and shell integration have moved together.

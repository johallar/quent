<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Question-driven CLI plan

## Scope

Build a Quent-native `ask` CLI that answers narrowly defined questions from
the existing query-engine APIs and opens the supporting evidence in the UI.
The first vertical slice is `longest-resource-users`, scoped to one resource
and a query-relative time window.

The implementation uses the existing Quent model:

- Resources and resource groups organize the resource tree. The first command
  accepts a leaf resource or presents query-bundle resources for selection;
  resource-group scope remains an API-supported next step.
- Resource capacities retain their analyzer-declared occupancy or rate
  semantics. The first command does not inspect capacity values.
- Channel resources remain ordinary typed Quent resources. The CLI does not
  infer channel endpoints or introduce a separate telemetry vocabulary.
- FSM entities, including analyzer-declared task types, own usages. The entity
  list ranks them by their longest matching usage span.
- Operators and plans remain query-engine entities. Operator IDs are optional
  filters and are validated against the query bundle.
- Binned timelines are the source for later aggregate questions. The first
  command intentionally uses exact entity-list spans and reports that bins do
  not apply.
- Deep links use the existing v3 schema and codec.

Out of scope for this slice are UI annotations, channel topology, capacity
bounds, saved analyses, cross-query comparison, and inferred causal claims.

## API prerequisites

`longest-resource-users` requires:

1. `GET /engines`, query-group listing, and query listing when engine or query
   IDs are omitted.
2. `GET /engines/{engine}/query/{query}` to obtain the query bundle.
3. A resource ID present in `entities.resources`, selected interactively when
   omitted.
4. At least one FSM type declared as a user of the resource type, unless an
   explicit entity type is supplied.
5. `POST /engines/{engine}/entities` with resource, entity-type, operator,
   window, descending usage-duration, and page filters.

The CLI resolves a missing engine first, then presents query groups and queries
as separate searchable Ink selections. After fetching the chosen query bundle,
it resolves a missing resource from `entities.resources`. Explicit IDs skip
their corresponding list requests, which preserves non-interactive automation.

## Architecture

The question registry owns stable metadata and execution:

- `id` and `version`
- user-facing title and explanation
- explicit API prerequisites and limitations
- an input resolver that validates against the query bundle
- an API request and analysis function
- a v3 deep-link state builder
- human-readable formatting

Shared result fields cover evidence, scope, resolution, findings, limitations,
and a deep link. JSON output serializes the same result directly. The registry
is deliberately small: future questions can add their own typed input and
result without a generic workflow language or capability framework.

The CLI entry point is transport orchestration only. It parses arguments,
configures the existing API client, fetches the bundle, selects a registered
question, and chooses human or JSON output. Versioned JSON is the primary agent
contract: it never invokes Ink, requires explicit IDs, keeps stdout
machine-readable, and reports structured errors on stderr.

## Commands

`pnpm ask` is the stable entry point. It dispatches the first argument to a
registered question command, so future questions can be added without creating
new package scripts. `engines`, `query-groups`, and `queries` provide
machine-readable ID discovery without requiring agents to call the API
directly.

Initial resource question:

```sh
pixi run pnpm --dir ui ask longest-resource-users \
  [--engine ENGINE] \
  [--query QUERY] \
  [--resource RESOURCE] \
  [--entity-type FSM_TYPE] \
  [--operator OPERATOR_ID[,OPERATOR_ID...]] \
  [--start SECONDS] \
  [--end SECONDS] \
  [--limit COUNT] \
  [--api-base http://localhost:8080/api] \
  [--base http://localhost:5173] \
  [--json]
```

Defaults are the whole query window, the resource type's sole `used_by` FSM
type when unambiguous, no operator filter, ten results, and
`http://localhost:8080/api`. Missing engine, query, and required resource IDs
open searchable Ink selections backed by the Quent API. A non-interactive
caller must pass all required IDs.

The query comparison command is `pnpm ask query-diff`; see
[Query diff CLI](./query-diff-cli.md).

## Evidence classification

- **Observed:** a value or exact span returned by an API. The first question
  uses this class because `usage_duration_s` is returned by the entity list.
- **Derived:** a deterministic calculation over observed values, such as a
  peak, mean, integral, overlap, or ranking computed by the CLI.
- **Inferred:** a plausible relationship requiring an explicit confidence and
  supporting observations.
- **Unavailable:** required model metadata or telemetry is absent. The result
  must name the missing prerequisite and make no substitute claim.

The first question reports the longest single matching resource-usage span,
clipped to the requested window. It does not call this entity lifetime,
aggregate usage, occupancy, utilization, transferred bytes, or saturation.

## Deep-link evidence

The command builds an entities-tab v3 state containing:

- engine and query route
- resource and optional FSM/operator filters
- selected time window
- descending sort and page size
- the top FSM entity selection, when present

It calls `buildDeepLinkUrl` from the existing deep-link codec. Compression,
versioning, validation, and URL limits are not reimplemented.

## Tests and validation

Focused tests cover:

- query-bundle validation and default FSM resolution
- exact entity-list request shape
- observed result and no-bin resolution language
- empty results and unsupported inputs
- human and JSON-stable result fields
- generated deep-link decode and restored evidence filters
- registry lookup and unknown question handling
- API-backed engine, query-group, query, and resource discovery
- Ink filtering, keyboard navigation, and bounded scrolling behavior
- explicit-ID bypass and non-interactive failure behavior

Validation uses Pixi for focused Vitest, TypeScript, ESLint, and Prettier
checks. Browser automation is not used.

Completed validation:

- full Vitest: 937 tests passed, including common-metric and multiselect tests
- UI TypeScript typecheck: passed
- CLI TypeScript typecheck: passed
- full ESLint: passed with existing warnings only
- focused Prettier check: passed
- CLI entry-point smoke test: passed

## Known gaps

- Entity-list deep-link state currently represents only a leaf resource ID.
  The API supports a resource-group scope plus resource type, but the entities
  UI and v3 state do not preserve that pair.
- The entity-list response returns the winning duration and complete FSM, but
  not an explicit reference to the particular usage/state that produced the
  metric. The selected resource narrows the evidence, but a future response
  should identify the winning usage.
- Operator filtering is accepted, but the returned FSM does not identify the
  matching operator relationship.
- No stable analyzer capability declaration exists. Missing declarations are
  detected from the query bundle and API response.
- Resource records do not expose channel source/target metadata.
- Binned resource timelines do not provide all-operator breakdowns in one
  response, and capacity bounds are not exposed.
- Deep-link state has no shareable analysis annotation.

## Integration notes

- This branch is stacked on the entities-v3 deep-link commits `a3f4b79ff` and
  `f28a97211`; land those first or include the complete stack so generated
  entity links restore correctly.
- Discovery calls the existing engine, query-group, query, and query-bundle
  endpoints. It adds no API schema and explicit IDs retain automation behavior.
- Merge the timeline-annotations work before adding annotated CLI answers. The
  current command intentionally emits a valid v3 entities link; a future
  question can target v4 and attach its point/range finding without replacing
  the shared codec.
- Channel endpoint metadata can enable channel-direction questions after the
  channel-flow branch lands. The CLI must use typed `channel_endpoints`, not
  resource names, to classify channels.
- Resource-hotspot questions should reuse the heatmap's exact capacity tuple
  and the selected-window summary calculations instead of implementing a
  second interpretation of occupancy, observed rate, or integrated work.
- Expected merge overlap is limited to `ui/package.json` and future deep-link
  imports. Preserve all added scripts and keep versioned legacy link decoding.

## Next iterations

1. Add resource-group scope to entities state and the entities UI, then allow
   `--resource-group` plus `--resource-type`.
2. Extend the entity-list response with the winning usage's resource, state,
   start, and end so the CLI can cite the exact interval.
3. Add `resource-hotspots` over bulk binned timelines, reporting requested and
   returned bin resolution and preserving focused resource rows.
4. Add shareable point/range annotations to versioned deep-link state.
5. Introduce analyzer capability metadata before channel-direction,
   saturation, or inferred flow questions.

## Progress

- [x] Inspected the query bundle, resource timeline, bulk timeline, data-flow,
      entity-list, and server contracts.
- [x] Inspected the v3 deep-link schema, codec, CLI, and tests.
- [x] Chosen the exact entity-list vertical slice.
- [x] Implemented the registry and `longest-resource-users`.
- [x] Added API-backed selection for omitted engine, query, and resource IDs.
- [x] Added focused request, result, validation, registry, and deep-link tests.
- [x] Ran validation and recorded final gaps.

<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Question-driven CLI plan

## Scope

Build a Quent-native `ask` CLI that answers narrowly defined questions from
the existing query-engine APIs and opens the supporting evidence in the UI.
Agents can now discover and inspect the same raw query-engine facts through the
Quent MCP server; `quent-cli` remains the deterministic summary, ranking,
comparison, and deep-link layer above those facts. The first vertical slice is
`longest-resource-users`, scoped to one resource and a query-relative time
window.

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
- The implemented command emits an entities-tab v3 deep link. Newer schema
  work is tracked below and must be integrated through the shared codec rather
  than by adding another command-local encoder.

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

## MCP and CLI boundary

`experimental/vibe/quent-mcp` now provides a query-engine MCP bridge over the
existing REST API. Its raw-fact tools are:

- `list_engines`, `get_engine`, and `list_engine_contexts`
- `list_queries` and `get_query`
- `single_timeline`, `bulk_timelines`, and `data_flow_timeline`
- `list_entities`

`list_queries` returns every query for an engine and includes the analyzer's
preferred `initial_group_by_attribute` when one is declared. There is no
separate query-group tool in the current server.

The MCP server deliberately does not implement rankings, joins, summaries, or
interpretation. An agent should use MCP to discover IDs, inspect a query
bundle, or retrieve raw evidence, then call `quent-cli` when a registered
building block can perform the deterministic reduction. The CLI continues to
call REST directly; making it an MCP client would add transport and session
complexity without changing the analyzer contract. Its discovery commands
remain useful for shell automation and clients without MCP.

Two MCP transports are available:

- Stateless streamable HTTP is mounted at `/mcp` on the analyzer's existing
  listener. It shares the analyzer's CORS configuration, adds no
  authentication, and retains the MCP transport's loopback Host allowlist
  unless `QUENT_MCP_ALLOWED_HOSTS` is configured.
- The `quent-mcp` executable provides stdio for MCP clients that need to spawn
  a local process. It proxies a running REST API selected with `--api-base`.

The simulator server and its Docker Compose setup mount `/mcp` by default.
The stacked `quent-open` integration mounts it only when the artifact's pinned
Quent revision contains `quent-mcp` and the MCP routes. Older artifacts still
open without MCP, and there is no fallback to a package from the host checkout.

## Architecture

The question registry owns stable metadata and execution:

- `id` and `version`
- user-facing title and explanation
- explicit API prerequisites and limitations
- an input resolver that validates against the query bundle
- an API request and analysis function
- a deep-link adapter, currently producing v3 entity state and migrating to
  the shared versioned codec as described below
- human-readable formatting

Shared result fields cover evidence, scope, resolution, findings, limitations,
and a deep link. JSON output serializes the same result directly. The registry
is deliberately small: future questions can add their own typed input and
result without a generic workflow language or capability framework.

## P0 query-model building blocks

The first query-bundle batch contains:

1. `query-lifecycle`
2. `query-structure`
3. `operator-facts`
4. `operator-statistics-summary`
5. `resource-inventory`

`operator-statistics-summary` answers: **How are numeric operator statistics
distributed within this query?** It deterministically flattens numeric scalar
leaves from declared operator statistics and groups them by logical or physical
operator type, statistic path, and quantity. Incompatible quantities and the
overlapping logical/physical views are never combined.

Each aggregate reports operator count, numeric-value count, missing-value
count, sum, minimum, maximum, arithmetic mean, median, population variance and
standard deviation, and the 25th and 75th percentiles. Minimum and maximum
results also identify the operator instance IDs and names that produced the
extreme value, including ties, together with plan and worker identity.
Non-numeric values, lists, absent statistics, and unsupported quantities are
reported as limitations rather than coerced.

The result is derived entirely from one query bundle and requires no new
analyzer contract. Tests must fix the percentile interpolation and population
standard-deviation formulas, cover one-value and empty groups, preserve nested
statistic identity and units, and verify stable ordering and extrema ties.

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
directly. MCP-capable agents may instead use `list_engines` and `list_queries`;
the CLI commands remain the transport-independent shell fallback.

Initial resource question:

```sh
pixi run pnpm --dir experimental/vibe/quent-cli ask longest-resource-users \
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

## Deep-link evidence and schema evolution

The implemented command builds an entities-tab v3 state containing:

- engine and query route
- resource and optional FSM/operator filters
- selected time window
- descending sort and page size
- the top FSM entity selection, when present

The current CLI has a small local v3 encoder. It should be replaced with the
shared `buildDeepLinkUrl` codec when the CLI branch is rebased onto the final
schema work, so compression, versioning, validation, compatibility decoding,
and URL limits have one implementation.

Two feature branches currently introduce incompatible schemas under the same
`v4` prefix:

- `feat/timeline-annotations` extends v3 with `analysis.annotations`. Each
  annotation is a query-relative point or closed-open range carrying a stable
  question ID and version, label, explanation, evidence classification,
  optional confidence for inferred evidence, and typed resource, channel,
  operator, entity, capacity, and FSM-state references.
- `structured-statistics-flow-cleanup` changes DAG and operator-table statistic
  references from string names to canonical structured field paths.

Those definitions must not ship independently with the same version. This plan
reserves v4 for analysis annotations and assigns the structured-statistic path
change to v5 after rebasing it on v4. The v5 encoder therefore includes both
capabilities, while the decoder retains v1 through v4 compatibility. If merge
order changes, the numbers may swap, but each distinct wire schema must keep a
unique prefix.

Temporal CLI findings can add v4 annotations after that schema lands.
Non-temporal results such as query structure or operator-statistics summaries
should continue linking to the relevant filtered view without inventing a
point or range.

## Tests and validation

Focused tests cover:

- query-bundle validation and default FSM resolution
- exact entity-list request shape
- observed result and no-bin resolution language
- empty results and unsupported inputs
- human and JSON-stable result fields
- generated deep-link decode and restored evidence filters
- v4 annotation generation for temporal findings after the reconciled schema
  lands, plus legacy v3 decoding
- registry lookup and unknown question handling
- API-backed engine, query-group, query, and resource discovery
- Ink filtering, keyboard navigation, and bounded scrolling behavior
- explicit-ID bypass and non-interactive failure behavior

Validation uses Pixi for focused Vitest, TypeScript, ESLint, and Prettier
checks. Browser automation is not used. CLI unit tests mock the REST contract,
not MCP transport; MCP and CLI integration tests use the same generated dataset
and compare identifiers and raw evidence before checking the CLI's reduction.

For analysis benchmarks, retain three acquisition modes: raw REST, raw MCP,
and MCP discovery followed by `quent-cli`. Record model and parameters, input
and output tokens, MCP tool calls, CLI invocations, raw bytes returned, elapsed
time, retries, manual transformations, answer correctness, and evidence-link
validity. This separates transport convenience from the token and reasoning
savings supplied by a building block.

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
- The current branch emits v3 and cannot yet attach shareable analysis
  annotations. Annotation v4 and structured-statistic v4 currently collide and
  must be reconciled before either becomes the CLI target.
- The CLI still owns a command-local v3 encoder instead of importing the shared
  codec.
- MCP tools expose the query-engine REST contract only; they do not yet declare
  analyzer capabilities or compose tools for future non-query-engine domains.

## Integration notes

- Entities v3 is now present on the current upstream base. Preserve v1-v3
  decoding while moving the CLI to the reconciled annotation/statistics schema.
- MCP phase 1 lives on `feat/mcp-server-phase1`: it supplies the reusable Rust
  library, stdio binary, stateless `/mcp` routes, simulator wiring, and Docker
  startup. MCP phase 2 lives on `feat/mcp-server-phase2`: it conditionally adds
  those routes to generated `quent-open` viewers for supported pinned
  revisions. Land or rebase phase 1 before phase 2.
- Discovery calls the existing engine, query-group, query, and query-bundle
  endpoints. It adds no API schema and explicit IDs retain automation behavior.
- Reconcile the two v4 candidates before adding annotated CLI answers. The
  current command intentionally emits a valid v3 entities link; a future
  temporal question can target the final annotation-bearing schema through the
  shared codec.
- Channel endpoint metadata can enable channel-direction questions after the
  channel-flow branch lands. The CLI must use typed `channel_endpoints`, not
  resource names, to classify channels.
- Resource-hotspot questions should reuse the heatmap's exact capacity tuple
  and the selected-window summary calculations instead of implementing a
  second interpretation of occupancy, observed rate, or integrated work.
- Expected merge overlap is limited to `ui/package.json` and future deep-link
  imports. Preserve all added scripts and keep versioned legacy link decoding.

## Next iterations

1. Implement the five P0 query-model building blocks, including
   `operator-statistics-summary`.
2. Add resource-group scope to entities state and the entities UI, then allow
   `--resource-group` plus `--resource-type`.
3. Extend the entity-list response with the winning usage's resource, state,
   start, and end so the CLI can cite the exact interval.
4. Add `resource-hotspots` over bulk binned timelines, reporting requested and
   returned bin resolution and preserving focused resource rows.
5. Reconcile annotation v4 with structured-statistic paths, migrate the CLI to
   the shared codec, and emit point/range annotations for temporal findings.
6. Add domain-aware MCP tool-module composition and analyzer capability
   metadata before channel-direction, saturation, inferred flow, or
   non-query-engine questions.
7. Evaluate raw REST, raw MCP, and MCP-plus-CLI analysis modes across the
   selected models and model parameters.

## Progress

- [x] Inspected the query bundle, resource timeline, bulk timeline, data-flow,
      entity-list, and server contracts.
- [x] Inspected the v3 schema and both incompatible v4 candidates.
- [x] Added the query-engine MCP server on `feat/mcp-server-phase1`.
- [x] Added optional pinned-revision `quent-open` integration on
      `feat/mcp-server-phase2`.
- [x] Chosen the exact entity-list vertical slice.
- [x] Implemented the registry and `longest-resource-users`.
- [x] Added API-backed selection for omitted engine, query, and resource IDs.
- [x] Added focused request, result, validation, registry, and deep-link tests.
- [x] Ran validation and recorded final gaps.

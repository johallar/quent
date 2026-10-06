<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Crossfilter design

## Status and scope

Quent's crossfilter is currently a shared selection-state mechanism. It lets
multiple views publish and consume the same filter dimension without coupling
those views to one another. Operators are the first dimension backed by this
mechanism.

This is not yet a complete multidimensional crossfilter engine. It stores and
normalizes selections independently by dimension, but it does not automatically:

- combine different dimensions into a query predicate;
- compute filtered counts or facet options;
- distinguish the view that produced a selection;
- exclude a view's own filter when computing that view's available values.

Those policies remain the responsibility of consumers.

## Data model

A crossfilter dimension contains named selection groups:

```ts
interface CrossfilterSelection {
  label: string;
  itemIds: ReadonlySet<string>;
}

interface CrossfilterDimensionState {
  selections: ReadonlyMap<string, CrossfilterSelection>;
}
```

The map key is the `selectionId`. It identifies the user's conceptual
selection, such as a logical operator shown in the DAG. `itemIds` contains the
concrete values affected by that selection, such as the logical operator and
all physical operators represented by it.

The two identities are intentionally separate. A selection group named
`join-group` can filter `join-left` and `join-right` without requiring
`join-group` itself to be a filterable item.

Within one dimension, the effective filter is the union of every group's
`itemIds`. `getCrossfilterItemIds` materializes that flattened set.

## Core operations

The pure crossfilter reducer in `@quent/utils` supports four actions:

- `add` adds a selection group;
- `remove` removes a group by `selectionId`;
- `replace` reconstructs the dimension from a list of groups;
- `clear` restores the empty dimension.

Adding a group also performs containment normalization:

- If an existing group contains every item in the new group, the new group is
  redundant and is ignored.
- If the new group contains every item in an existing group, the contained
  existing group is removed.
- Partially overlapping groups are retained. Their effective filter is still
  the union of their item IDs.

This allows a parent selection to replace already-selected descendants while
retaining the parent as the user-facing selection.

## React state layer

The hooks package stores each dimension in a Jotai atom family keyed by a
string dimension name:

- `useCrossfilter(dimension)` returns the grouped selection state;
- `useCrossfilterItemIds(dimension)` returns the flattened effective IDs;
- `useCrossfilterActions(dimension)` returns the action dispatcher.

Different dimension keys produce independent atoms. Updating `operators` does
not update a future `resources` dimension.

This division also keeps the selection algebra independent of React. The pure
reducer can be tested and reused without a Jotai store.

## Operator integration

The existing operator APIs remain the public, domain-aware interface:

- `useOperatorSelection`;
- `useSelectedOperatorIds`;
- `useOperatorSelectionActions`.

The operator adapter translates between `operatorIds` and the generic
crossfilter `itemIds`. It also ensures that an operator selection includes its
own `selectionId`, preserving the behavior that existed before the generic
crossfilter was introduced.

Operator actions update two kinds of state in one Jotai transaction:

1. the crossfilter selection used to filter data;
2. selected-operator display data used by badges, toolbars, and details.

The DAG, operator table, entity table, operator timelines, resource timelines,
and query toolbar therefore observe the same effective operator IDs while
retaining richer operator-specific presentation data.

Deep links serialize the flattened operator IDs rather than the selection
groups. On hydration, Quent resolves those IDs against the currently loaded
operator hierarchy and reconstructs suitable groups. This keeps links compact
and allows unknown IDs to survive loading, but group identity is not part of
the serialized contract.

## How nested operator data is handled

The generic crossfilter does not understand trees. It only understands named
sets and containment between those sets. Operator-specific utilities convert
the operator graph into those sets before dispatching crossfilter actions.

For an operator hierarchy like:

```text
logical-join
├── physical-build
└── physical-probe
    └── physical-scan
```

selecting `logical-join` produces a group equivalent to:

```ts
{
  selectionId: "logical-join",
  itemIds: new Set([
    "logical-join",
    "physical-build",
    "physical-probe",
    "physical-scan",
  ]),
}
```

`buildRelatedOperatorIdsById` computes transitive descendants from
`parent_operator_ids`. It uses visited sets, so cycles do not cause infinite
traversal. Multiple parent IDs are also supported; in practice the structure
is a directed graph rather than a strict tree.

Operator normalization then prefers the largest complete groups. If all
members of a parent group are selected, the UI can represent them with one
parent selection instead of many child selections.

### Deselecting within a selected parent

Removing a group and deselecting a descendant are different operations.

The generic `remove` action only removes an exact `selectionId`. It does not
know how to subtract one descendant from a parent group.

Operator toggling handles this outside the crossfilter core:

1. flatten the current groups to operator IDs;
2. remove the toggled operator, its descendants, and selected ancestors;
3. run the remaining IDs through the hierarchy resolver;
4. replace the crossfilter groups with a normalized representation.

As a result, "all of parent except this child" is represented by the remaining
sibling or descendant groups. The model remains inclusion-only; it does not
store an explicit exclusion.

## Strengths

### Views are decoupled

A producer only updates the operator selection, and all consumers receive the
same effective IDs. The DAG does not need direct knowledge of the entity table
or timelines.

### Domain logic is separated from state transport

The generic layer handles set selection and containment. Operator hierarchy,
labels, statistics, deep-link reconstruction, and toggle behavior remain in
operator-specific adapters.

### Grouped selections preserve user intent

A logical operator can remain one visible selection while filtering many
physical operators. Containment normalization prevents redundant child badges
when a containing parent is selected.

### Existing behavior remains compatible

The operator hooks and operator-shaped types are retained. Existing consumers
do not need to understand generic crossfilter dimensions.

### Unknown IDs can survive

Deep-link or timeline selections that are not present in the currently loaded
DAG can remain selected as singleton IDs rather than being silently discarded.

### Dimensions are isolated

Atom families avoid unnecessary coupling between unrelated dimensions and give
future dimensions the same add, remove, replace, and clear protocol.

## Weaknesses

### It is a selection store, not a full crossfilter engine

There is no aggregate representation of all active dimensions and no standard
rule such as "OR within a dimension, AND across dimensions." Every data-fetch
or derived-data consumer must opt into each relevant dimension and combine
them correctly.

### Tree semantics are external and operator-specific

The generic reducer cannot answer whether a node's descendants should be
included, whether ancestors should become indeterminate, or how a partial
subtree should be displayed. A new hierarchical dimension must provide its own
closure, toggle, and normalization logic.

### Inclusion sets can become large

Selecting a high-level operator eagerly stores every represented descendant
ID. Flattening selections is linear in the total number of stored IDs, and
containment checks compare sets. This is simple and appropriate for current
operator counts, but large trees could require substantial memory and repeated
work.

### Exclusions can expand into many groups

"Everything below this root except one leaf" is represented by decomposing the
remaining included nodes. Repeated exclusions can turn one compact parent
selection into many sibling and leaf selections.

### Shared descendants are ambiguous

In a DAG, a child may belong to more than one parent. Selecting either parent
includes that child. The flattened filter does not retain provenance, so it
cannot say which parent caused the child to be included. Removing one
overlapping group still works as a union if another group includes the child,
but operator hierarchy reconstruction may choose a different normalized group
representation.

### Equal and partially overlapping groups have limited normalization

Containment is the only generic relationship. Equal item sets keep whichever
selection is encountered first. Partially overlapping sets remain separate.
There is no canonical global minimization of overlapping groups.

### Display metadata is maintained separately

Operator labels and detail data are synchronized by the operator action atom,
not by the generic crossfilter atom. Internal code should use the
operator-specific action API for the operator dimension. Writing directly to
the generic `operators` dimension would bypass that metadata transaction.

### Dimension names are untyped strings

Misspelled or accidentally duplicated dimension names create independent
state rather than producing a type error.

### Lifecycle and scope are implicit

Dimensions live in the surrounding Jotai store. The generic mechanism does not
itself define when state should reset on engine, query, or route changes.

### Serialization loses group identity

Deep links preserve effective IDs, not the original groups. Rehydrating
against a changed hierarchy can produce different badges or grouping while
retaining the same flattened IDs.

## Suitability for other nested data

The current model works well when:

- nodes have stable unique IDs;
- selecting a parent means selecting a transitive set of descendants;
- filtering ultimately accepts a flat set of IDs;
- the hierarchy is small enough to expand eagerly;
- a domain adapter can reconstruct a useful grouped representation.

It is less suitable without further work when:

- the same logical node appears at multiple paths and path identity matters;
- selection means "this node only" rather than "this subtree";
- ordered ranges or sibling order are meaningful;
- the hierarchy changes frequently while a selection is active;
- exclusions must remain compact;
- counts must be computed with the current dimension temporarily removed;
- millions of descendants make explicit ID sets impractical.

For another nested dimension, the adapter should explicitly define:

1. whether selecting a node includes itself, descendants, ancestors, or only
   leaves;
2. how partial selections are represented;
3. how shared descendants in a DAG affect removal;
4. whether unknown or deleted IDs survive;
5. how flattened IDs are serialized and reconstructed;
6. the size at which eager set expansion becomes unacceptable.

## Recommended next steps

1. Define a typed registry of supported dimensions instead of free-form
   strings.
2. Add an aggregate active-filter API with documented composition semantics.
3. Introduce a reusable hierarchy adapter contract for descendant expansion,
   subtraction, and normalization.
4. Decide whether operator display metadata should become part of a typed
   dimension adapter transaction.
5. Add tests for multiple-parent DAGs, cycles, partial overlap, hierarchy
   changes during hydration, and large selections.
6. Add explicit query or route scoping so filter lifetime is part of the
   crossfilter contract.
7. If large trees become common, evaluate compact representations such as
   subtree tokens plus exclusions, indexed bit sets, or server-side hierarchy
   predicates instead of eagerly expanded string sets.

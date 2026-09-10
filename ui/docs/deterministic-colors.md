<!-- SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Deterministic colors and color registries

## Overview

Categorical colors are now assigned by framework-agnostic utilities in `@quent/utils`. React and
Jotai provide a query-scoped wrapper in `@quent/hooks`, but they do not implement the assignment
algorithm.

The implementation has three layers:

1. `colors.ts` normalizes keys, hashes them, assigns palette positions, and creates resolvers.
2. `colorRegistry.ts` groups independent color domains under named keys, each with its own palette.
3. `@quent/hooks` hydrates a registry into a Jotai provider and exposes `useColorResolver`.

This removes mutable module-level assignments and makes a color map reproducible from its input
values and palette.

## Deterministic assignment

Color keys may be strings, numbers, or bigints. Every key is normalized by converting it to a
string, trimming surrounding whitespace, and lowercasing it. For example, `" Scan "`, `"scan"`,
and `"SCAN"` are the same key.

`buildDeterministicColorMap` performs these steps:

1. Normalize and deduplicate all keys.
2. Sort the normalized keys lexicographically.
3. Hash each key with the djb2 string hash.
4. Use `hash % palette.length` as its initial palette position.
5. If that position is already occupied, probe forward until a free position is found.

Sorting makes the result independent of input order. Linear probing gives distinct colors until
the palette is exhausted. Once there are more keys than colors, duplicates are unavoidable and the
bare hash position is used.

An empty palette is rejected. A non-empty map can be wrapped with
`createDeterministicColorResolver`, which normalizes lookup values before resolving them.

### Runtime values

Some complete value sets are unavailable when the query registry is created. Data-flow states can
include analyzer-generated states, and data-flow dimensions arrive with the data-flow response.

`extendDeterministicColorMap` handles these values by:

- preserving every existing assignment;
- sorting and deterministically assigning only new values;
- avoiding palette positions already used by the base map until the palette is exhausted.

`useColorResolver` and `createRegistryColorResolver` accept these additional values. Values that
are neither pre-registered nor supplied as additional values use direct hash fallback. That
fallback is stable, but it cannot guarantee collision avoidance with a precomputed map.

## Palettes

Every registry value contains both its color map and its palette. The palette is therefore part of
the registry namespace rather than global state. It is used for initial assignment, runtime
extension, and unknown-value fallback.

`getColorRegistryPalettes(theme)` defines the current policy:

- `OPERATOR_TYPES`, `RESOURCE_TYPES`, and `FSM_TYPES` use
  `COLOR_PALETTES.deterministic`.
- `CAPACITIES`, `FSM_STATES`, `DATA_FLOW_STATES`, and `DATA_FLOW_DIMENSIONS` use
  `COLOR_PALETTES.timeline.light` or `COLOR_PALETTES.timeline.dark`.

The timeline palettes are the former `extended.light` and `extended.dark` palettes. The
deterministic palette is the 12-color palette introduced for operator-type identity colors.

The `ColorRegistryPalettes` type is a `Record<ColorRegistryKey, ColorPalette>`. Adding a registry
key without assigning it a palette is therefore a type error.

## Using the core outside React

All core APIs are exported from `@quent/utils`.

```ts
import {
  COLOR_PALETTES,
  COLOR_REGISTRY_KEYS,
  createColorRegistry,
  createColorRegistryEntry,
  createRegistryColorResolver,
} from '@quent/utils';

const registry = createColorRegistry([
  createColorRegistryEntry(
    COLOR_REGISTRY_KEYS.OPERATOR_TYPES,
    ['Scan', 'Join', 'Aggregate'],
    COLOR_PALETTES.deterministic
  ),
]);

const operatorColor = createRegistryColorResolver(registry, COLOR_REGISTRY_KEYS.OPERATOR_TYPES);

operatorColor('Scan');
```

Object values require a stable key selector:

```ts
const entry = createColorRegistryEntry(
  COLOR_REGISTRY_KEYS.RESOURCE_TYPES,
  resourceTypes,
  COLOR_PALETTES.deterministic,
  resourceType => resourceType.name
);
```

Runtime values can be supplied when creating a resolver:

```ts
const stateColor = createRegistryColorResolver(
  registry,
  COLOR_REGISTRY_KEYS.DATA_FLOW_STATES,
  resolvedStateNames
);
```

For a category that does not need a registry, use `buildDeterministicColorMap` and
`createDeterministicColorResolver` directly. DAG custom-stat categories use this approach because
their domain depends on the selected field.

## Using the registry in React

The React wrapper is exported from `@quent/hooks`.

At a provider boundary, build and hydrate the complete registry:

```tsx
function QueryColorRegistry({ queryBundle, children }: Props) {
  const registry = useMemo(() => {
    const palettes = getColorRegistryPalettes('light');

    return createColorRegistry([
      createColorRegistryEntry(
        COLOR_REGISTRY_KEYS.OPERATOR_TYPES,
        queryBundle.unique_operator_names,
        palettes[COLOR_REGISTRY_KEYS.OPERATOR_TYPES]
      ),
    ]);
  }, [queryBundle]);

  useHydrateColorRegistry(registry);
  return children;
}
```

Descendants resolve colors by namespace:

```tsx
function OperatorTypeSwatch({ typeName }: { typeName: string }) {
  const resolveColor = useColorResolver(COLOR_REGISTRY_KEYS.OPERATOR_TYPES);
  return <ColorSwatch color={resolveColor(typeName)} />;
}
```

Pass runtime values as the second argument when the provider could not know the complete domain:

```tsx
const resolveStateColor = useColorResolver(
  COLOR_REGISTRY_KEYS.DATA_FLOW_STATES,
  dataFlowMeta.stateNames
);
```

The additional-values iterable participates in the hook memoization. Callers should pass a stable
array or memoize a derived array.

`useHydrateColorRegistry` hydrates before descendants first read the atom. It also updates the atom
when the registry changes, allowing the light/dark timeline palette to change without replacing the
surrounding Jotai provider.

## Creating a new registry entry

To add a new categorical color domain:

1. Add a unique value to `COLOR_REGISTRY_KEYS` in `@quent/utils/colorRegistry.ts`.
2. Add its palette to every branch returned by `getColorRegistryPalettes`.
3. Collect the complete query-scoped value set as high in the tree as practical.
4. Call `createColorRegistryEntry(key, values, palette, keyOf?)`.
5. Include the entry in `createColorRegistry`.
6. Consume it with `createRegistryColorResolver` outside React or `useColorResolver` inside React.
7. Supply stable runtime values to the resolver when the complete set is not known at creation.

Choose a separate registry key when two domains should not affect each other's collision probing,
even if they contain identical strings.

## Query registry contents

The profile query boundary currently creates these entries:

- operator types from `queryBundle.unique_operator_names`;
- resource types from resource-type declarations;
- FSM types from FSM declarations;
- capacities from every resource-type capacity declaration;
- FSM states from every FSM declaration;
- data-flow states seeded from FSM states and extended from data-flow metadata;
- data-flow dimensions initialized empty and extended from data-flow metadata.

The query's Jotai provider scopes these maps so separate queries cannot affect each other.

## Migrated consumers

Operator colors in DAG nodes, query-plan nodes, operator tables, operator Gantt bars, and operator
detail bars use `OPERATOR_TYPES`.

Timeline capacity series and controller timelines use `CAPACITIES`. Resource timelines, entity
details, long-entity Gantt segments, and entity tables use `FSM_STATES`.

Data-flow node bars, matrices, and legends use `DATA_FLOW_STATES` and
`DATA_FLOW_DIMENSIONS`, including their runtime value sets.

Pure timeline and long-entity transformation functions now receive a `ColorResolver` argument.
This keeps Jotai and React out of transformation code and makes those functions usable in tests,
other frameworks, and non-UI consumers.

DAG custom-stat categorical coloring now builds a local deterministic map instead of assigning
colors in first-observed order. Numeric DAG and pivot-table coloring remains a continuous value
scale and is not part of the categorical registry.

## Removed legacy APIs

The following stateful or index-based helpers were removed after their call sites migrated:

- `getColorForKey`
- `assignColors`
- `getColorByIndex`
- `createCapacitiesColorFn`
- `createFsmTypeColorFn`
- `createDataFlowStateColorFn`
- `buildFsmStateIndexMap`
- `resetColorAssignments`
- `setActivePalette`
- `getActivePalette`
- `getPalette`
- `darkenColor`

The unused Wong and ECharts categorical palettes were also removed. Continuous palettes, opacity
helpers, contrast checks, and fixed black/white constants remain.

## Differences from the previous implementation

The palette families are preserved for migrated domains, but individual values can receive
different colors.

### Capacities

Multiple capacities were previously assigned consecutive palette colors in the order supplied by
each timeline. A single capacity used a mutable module-level hash assignment. Capacities are now
assigned from the query-wide, normalized, sorted set with hash and collision probing.

The same capacity is now stable across query views, but it may no longer receive the first palette
color merely because it was first in one timeline.

### FSM states

FSM states were previously colored by their declaration index. Building the old state-index map
could also overwrite a shared state name while iterating multiple FSM declarations.

States are now assigned by normalized state name across the query. Identically named states share a
color, independent of declaration position or object iteration order. Their colors still come from
the former light/dark extended palette.

### Data-flow states and dimensions

Declared data-flow states previously inherited declaration-index colors, while synthetic states
were appended after the declaration block. Dimensions reused capacity list-order assignment.

Both domains now have independent registry keys. Seeded assignments remain fixed, and runtime
states or dimensions are added deterministically with collision probing. Their exact palette
positions can therefore differ from the previous declaration-order positions.

### Operator and dynamic DAG categories

Operator types continue to use the deterministic 12-color palette. Dynamic categorical DAG fields
previously used first-observed order from the active palette; they now use a locally built,
order-independent deterministic map.

### Scope, normalization, and collisions

The old mutable assignment cache was shared across callers, so requesting a color in one feature
could influence later assignments elsewhere. Registries now isolate collision tracking by query
and registry key.

Case and surrounding whitespace now normalize to one identity. This can merge values that were
previously treated separately.

Assignments are deterministic for the same palette and complete value set. Adding or removing a
pre-registered value can change another value only when their hash/probe paths collide. Existing
assignments are preserved when values are added through runtime extension.

Palette exhaustion still produces duplicate colors. Unknown values should be supplied as runtime
values when collision avoidance matters; direct fallback guarantees stability, not uniqueness.

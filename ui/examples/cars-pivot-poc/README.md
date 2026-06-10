<!-- SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved. -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Cars Pivot Table — POC

A minimal proof-of-concept that wires the existing Quent pivot-table primitives
(`PivotedStatTable`, `GroupedDataTable`) and the `OptionMultiSelect` UI
component to a small bundled subset of the Kaggle
[Car Price Dataset](https://www.kaggle.com/datasets/asinow/car-price-dataset)
schema.

The goal is to demonstrate that the pivot table is **not domain-specific** —
it can be pointed at any flat row collection by supplying a schema that maps
each column into a group dimension and/or stat.

## What's in here

| File                     | Purpose                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `src/data.ts`            | Bundled, in-source rows + column metadata                                                  |
| `src/CarsPivotTable.tsx` | Minimal component: toolbar (group-by chips + agg select + multiselect) and the table       |
| `src/App.tsx`            | Providers (`QueryClient`, `Jotai`, `ThemeProvider`)                                        |
| `src/main.tsx`           | Vite entry                                                                                 |
| `src/styles.css`         | Re-imports the main app's Tailwind CSS so all `bg-card`, `--primary`, etc. variables exist |

## How it reuses the main app

`vite.config.ts` aliases `@` to `../../src`, so the example imports the live
implementations directly:

- `@/components/pivot-table/PivotedStatTable`
- `@/components/ui/OptionMultiSelect`
- `@/components/ui/select`
- `@/components/ThemeToggle`
- `@/contexts/ThemeContext`

There is **no** code duplication — modify a primitive in `ui/src/...` and the
POC picks it up on next reload.

## Tailwind: making consumed components self-contained

The `@quent` UI primitives (`OptionMultiSelect`, `popover`, `select`, the
pivot-table internals) use Tailwind classes like `bg-popover`, `bg-background`,
`bg-accent`, `border-input`, etc. Those classes have to be **scanned** by the
Tailwind compiler in whatever app embeds them — otherwise they're missing
from the compiled stylesheet and dropdowns/badges render unstyled (transparent
background, no borders).

Tailwind v4's Vite plugin only auto-discovers files under the Vite root by
default. If you're consuming components from another directory (a workspace
package, a sibling app, etc.) you have two options:

1. **Add an `@source` directive** in your CSS pointing at the consumed source
   tree. This example does exactly that:

   ```css
   /* src/styles.css */
   @import '@/index.css';
   @source "../../../src/**/*.{ts,tsx}";
   ```

2. **Ship the components as a built package** whose CSS is bundled alongside
   the JS, so the consumer doesn't have to scan source at all. This is what
   the `@quent/components` package will do once it's published.

In addition to the `@source` directive, the example needs:

- The CSS variables (`--popover`, `--input`, `--accent`, …) — provided by
  re-importing `@/index.css` (or by copying the `:root` / `.dark` blocks).
- The providers the components rely on at runtime — `ThemeProvider` (for
  `useTheme`), a `Jotai` `Provider` (for `nodeColorPaletteAtom`), and a
  `QueryClientProvider` (for any `@quent/client` hook). See `App.tsx`.

## Running

```bash
cd ui/examples/cars-pivot-poc
pnpm install
pnpm dev
```

Then open <http://localhost:5174>.

## Generic schema

Every column is exposed as both a potential group-by index **and** a potential
value column via the `OptionMultiSelect`. The `PivotedStatTable` cell renderer
already handles both numeric values (with the gradient heatmap) and string
values (rendered as plain labels), so a single schema definition works for the
whole dataset:

```ts
const SCHEMA = {
  groups: Object.fromEntries(
    ALL_COLUMNS.map(c => [c, { id: row => String(row[c]), label: row => String(row[c]) }])
  ),
  itemId: row => row.__id,
  scopeId: row => row.__id,
  stats: row => Object.fromEntries(ALL_COLUMNS.map(c => [c, row[c]])),
};
```

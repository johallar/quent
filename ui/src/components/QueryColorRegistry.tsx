// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, type ReactNode } from 'react';
import { COLOR_REGISTRY_KEYS, useHydrateColorRegistry } from '@quent/hooks';
import {
  createColorRegistry,
  createColorRegistryEntry,
  getColorRegistryPalettes,
  type ColorRegistry,
  type EntityRef,
  type PaletteTheme,
  type QueryBundle,
} from '@quent/utils';

export function QueryColorRegistry({
  queryBundle,
  paletteTheme,
  children,
}: {
  queryBundle: QueryBundle<EntityRef>;
  paletteTheme: PaletteTheme;
  children: ReactNode;
}) {
  const registry = useMemo<ColorRegistry>(() => {
    const resourceTypes = Object.values(queryBundle.entities.resource_types);
    const fsmTypes = Object.values(queryBundle.entities.fsm_types);
    const fsmStates = fsmTypes.flatMap(type => type.states.map(state => state.name));
    const palettes = getColorRegistryPalettes(paletteTheme);

    return createColorRegistry(
      [
        createColorRegistryEntry(
          COLOR_REGISTRY_KEYS.OPERATOR_TYPES,
          queryBundle.unique_operator_names,
          palettes[COLOR_REGISTRY_KEYS.OPERATOR_TYPES]
        ),
        createColorRegistryEntry(
          COLOR_REGISTRY_KEYS.RESOURCE_TYPES,
          resourceTypes,
          palettes[COLOR_REGISTRY_KEYS.RESOURCE_TYPES],
          type => type.name
        ),
        createColorRegistryEntry(
          COLOR_REGISTRY_KEYS.FSM_TYPES,
          fsmTypes,
          palettes[COLOR_REGISTRY_KEYS.FSM_TYPES],
          type => type.name
        ),
        createColorRegistryEntry(
          COLOR_REGISTRY_KEYS.CAPACITIES,
          resourceTypes.flatMap(type => type.capacities.map(capacity => capacity.name)),
          palettes[COLOR_REGISTRY_KEYS.CAPACITIES]
        ),
        createColorRegistryEntry(
          COLOR_REGISTRY_KEYS.FSM_STATES,
          fsmStates,
          palettes[COLOR_REGISTRY_KEYS.FSM_STATES]
        ),
      ],
      paletteTheme
    );
  }, [paletteTheme, queryBundle]);
  useHydrateColorRegistry(registry);
  return children;
}

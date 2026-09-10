// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { atom, useAtomValue, useSetAtom } from 'jotai';
import { useHydrateAtoms } from 'jotai/utils';
import { useEffect, useMemo } from 'react';
import {
  createColorRegistry,
  createRegistryColorResolver,
  type ColorRegistry,
  type ColorRegistryKey,
  type DeterministicColorKey,
  type DeterministicColorResolver,
} from '@quent/utils';

export { COLOR_REGISTRY_KEYS } from '@quent/utils';
export type { ColorRegistry, ColorRegistryKey } from '@quent/utils';

const colorRegistryAtom = atom<ColorRegistry>(createColorRegistry());
const EMPTY_ADDITIONAL_VALUES: readonly DeterministicColorKey[] = [];

export function useColorResolver(
  registryKey: ColorRegistryKey,
  additionalValues: Iterable<DeterministicColorKey> = EMPTY_ADDITIONAL_VALUES
): DeterministicColorResolver {
  const registry = useAtomValue(colorRegistryAtom);
  return useMemo(
    () => createRegistryColorResolver(registry, registryKey, additionalValues),
    [additionalValues, registry, registryKey]
  );
}

/** Hydrates complete color maps before descendants read their resolvers. */
export function useHydrateColorRegistry(registry: ColorRegistry): void {
  useHydrateAtoms([[colorRegistryAtom, registry]]);
  const setColorRegistry = useSetAtom(colorRegistryAtom);
  useEffect(() => {
    setColorRegistry(registry);
  }, [registry, setColorRegistry]);
}

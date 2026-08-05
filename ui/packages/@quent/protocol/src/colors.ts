// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { getColorByIndex, getColorForKey } from '@quent/utils';
import type { ChartColor, PaletteTheme } from '@quent/utils';
import type { FsmTypeDecl } from './generated';

export function createFsmTypeColorFn(
  fsmTypes: { [key in string]?: FsmTypeDecl },
  theme: PaletteTheme
): (stateName: string) => ChartColor {
  const stateIndexMap = buildFsmStateIndexMap(fsmTypes);
  return (stateName: string) => {
    const stateIndex = stateIndexMap.get(stateName);
    return stateIndex != null
      ? getColorByIndex(stateIndex, theme)
      : getColorForKey(stateName, theme);
  };
}

export function createDataFlowStateColorFn(
  fsmType: FsmTypeDecl | null | undefined,
  resolvedStates: readonly string[],
  theme: PaletteTheme
): (stateName: string) => ChartColor {
  const declared = new Map<string, number>();
  fsmType?.states.forEach((state, index) => declared.set(state.name, index));
  const appended = new Map<string, number>();
  for (const state of resolvedStates) {
    if (!declared.has(state) && !appended.has(state)) {
      appended.set(state, declared.size + appended.size);
    }
  }
  return (stateName: string) => {
    const index = declared.get(stateName) ?? appended.get(stateName);
    return index != null ? getColorByIndex(index, theme) : getColorForKey(stateName, theme);
  };
}

function buildFsmStateIndexMap(fsmTypes: { [key in string]?: FsmTypeDecl }): Map<string, number> {
  const stateIndexMap = new Map<string, number>();
  for (const declaration of Object.values(fsmTypes)) {
    if (!declaration) continue;
    for (let index = 0; index < declaration.states.length; index++) {
      stateIndexMap.set(declaration.states[index]!.name, index);
    }
  }
  return stateIndexMap;
}

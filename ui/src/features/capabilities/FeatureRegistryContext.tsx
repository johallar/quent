// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { type FeatureRegistry } from '@quent/features';
import { createContext, useContext, type ReactNode } from 'react';

const FeatureRegistryContext = createContext<FeatureRegistry | null>(null);

export function FeatureRegistryProvider({
  registry,
  children,
}: {
  registry: FeatureRegistry;
  children: ReactNode;
}) {
  return (
    <FeatureRegistryContext.Provider value={registry}>{children}</FeatureRegistryContext.Provider>
  );
}

export function useFeatureRegistry(): FeatureRegistry {
  const registry = useContext(FeatureRegistryContext);
  if (!registry) {
    throw new Error('useFeatureRegistry must be used within FeatureRegistryProvider');
  }
  return registry;
}

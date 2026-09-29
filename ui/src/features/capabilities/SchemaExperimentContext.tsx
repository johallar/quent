// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { SchemaFetcher } from '@quent/client';
import {
  fetchEntitiesOnlySchema,
  fetchQueryPlanOnlySchema,
  fetchQueryPlanWithEntitiesSchema,
  fetchResourceDefinitionsOnlySchema,
  fetchResourceOnlySchema,
  fetchResourceWithQueryPlanSchema,
} from './resourceOnlySchema';

export const SCHEMA_EXPERIMENTS = [
  {
    id: 'entities-only',
    label: 'FSM entities only',
    description: 'Reference-tree entities and lifecycle states without resources or plans.',
    fetcher: fetchEntitiesOnlySchema,
  },
  {
    id: 'resource-only',
    label: 'Resources + entities',
    description: 'Resource timelines and FSM entities without a query plan.',
    fetcher: fetchResourceOnlySchema,
  },
  {
    id: 'resource-query-plan',
    label: 'Resources + query plan',
    description: 'Resource timelines, FSM entities, query plan, and operator statistics.',
    fetcher: fetchResourceWithQueryPlanSchema,
  },
  {
    id: 'query-plan-only',
    label: 'Query plan + operators',
    description: 'Query plan and operator statistics without resources or domain entities.',
    fetcher: fetchQueryPlanOnlySchema,
  },
  {
    id: 'query-plan-entities',
    label: 'Query plan + entities',
    description: 'Query plan, operator statistics, and FSM entities without resources.',
    fetcher: fetchQueryPlanWithEntitiesSchema,
  },
  {
    id: 'resource-definitions-only',
    label: 'Resource definitions only',
    description: 'Resource declarations and hierarchy without an FSM capable of using them.',
    fetcher: fetchResourceDefinitionsOnlySchema,
  },
] as const satisfies readonly SchemaExperiment[];

export type SchemaExperimentId = (typeof SCHEMA_EXPERIMENTS)[number]['id'];

export interface SchemaExperiment {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly fetcher: SchemaFetcher;
}

export const DEFAULT_SCHEMA_EXPERIMENT =
  SCHEMA_EXPERIMENTS.find(experiment => experiment.id === 'query-plan-only') ??
  SCHEMA_EXPERIMENTS[0];

interface SchemaExperimentContextValue {
  readonly experiment: (typeof SCHEMA_EXPERIMENTS)[number];
  readonly selectExperiment: (id: SchemaExperimentId) => void;
}

const SchemaExperimentContext = createContext<SchemaExperimentContextValue | null>(null);

export function SchemaExperimentProvider({ children }: { children: ReactNode }) {
  const [experimentId, setExperimentId] = useState<SchemaExperimentId>(
    DEFAULT_SCHEMA_EXPERIMENT.id
  );
  const experiment =
    SCHEMA_EXPERIMENTS.find(candidate => candidate.id === experimentId) ??
    DEFAULT_SCHEMA_EXPERIMENT;
  const value = useMemo(() => ({ experiment, selectExperiment: setExperimentId }), [experiment]);

  return (
    <SchemaExperimentContext.Provider value={value}>{children}</SchemaExperimentContext.Provider>
  );
}

export function useSchemaExperiment(): SchemaExperimentContextValue {
  const value = useContext(SchemaExperimentContext);
  if (!value) {
    throw new Error('useSchemaExperiment must be used within SchemaExperimentProvider');
  }
  return value;
}

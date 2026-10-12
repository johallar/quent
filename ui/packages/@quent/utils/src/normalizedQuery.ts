// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Statistic, StatisticSet } from './dagTypes';
import type {
  EntityRef,
  Operator,
  OperatorStatistics,
  Port,
  PortStatistics,
  Query,
  QueryBundle,
  QueryEntities,
} from './types';

export type NormalizedQuery = Query & {
  attributes: Statistic[];
};

export type NormalizedOperator = Omit<Operator, 'statistics'> & {
  attributes: Statistic[];
  statistics: OperatorStatistics & StatisticSet;
};

export type NormalizedPort = Omit<Port, 'statistics'> & {
  statistics: PortStatistics & StatisticSet;
};

export type NormalizedQueryEntities = Omit<QueryEntities, 'query' | 'operators' | 'ports'> & {
  query: NormalizedQuery;
  operators: Record<string, NormalizedOperator>;
  ports: Record<string, NormalizedPort>;
};

export type NormalizedQueryBundle<E = EntityRef> = Omit<QueryBundle<E>, 'entities'> & {
  entities: NormalizedQueryEntities;
};

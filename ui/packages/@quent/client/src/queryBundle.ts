// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  projectStatisticScalarFields,
  unwrapTaggedValue,
  type DynamicAttribute,
  type EntityRef,
  type NormalizedOperator,
  type NormalizedPort,
  type NormalizedQueryBundle,
  type OperatorStatistic,
  type QueryBundle,
  type Statistic,
  type StatisticSet,
} from '@quent/utils';
import { fetchQueryBundle } from './api';
import { DEFAULT_STALE_TIME } from './constants';

interface QueryBundleParams {
  engineId: string;
  queryId: string;
}

function normalizeAttributes(attributes: readonly DynamicAttribute[]): Statistic[] {
  return attributes.map(({ key, value }) => ({
    key,
    value: unwrapTaggedValue(value),
  }));
}

function statisticSet(statistics: Statistic[]): StatisticSet {
  return {
    statistics,
    fields: projectStatisticScalarFields(statistics),
  };
}

function normalizeOperatorStatistics(
  statistics: readonly OperatorStatistic[] | null
): StatisticSet {
  return statisticSet(
    (statistics ?? []).map(({ value: { key, value }, quantity }) => ({
      key,
      value: unwrapTaggedValue(value),
      ...(quantity !== null ? { quantity } : {}),
    }))
  );
}

function normalizeOperator(
  operator: QueryBundle['entities']['operators'][string]
): NormalizedOperator {
  const { custom_attributes, statistics } = operator;
  return {
    ...operator,
    attributes: normalizeAttributes(custom_attributes),
    statistics: {
      custom_statistics: statistics?.custom_statistics ?? [],
      ...normalizeOperatorStatistics(statistics?.custom_statistics ?? null),
    },
  };
}

function normalizePort(port: QueryBundle['entities']['ports'][string]): NormalizedPort {
  const { statistics } = port;
  return {
    ...port,
    statistics: {
      custom_statistics: statistics?.custom_statistics ?? [],
      ...statisticSet(normalizeAttributes(statistics?.custom_statistics ?? [])),
    },
  };
}

function normalizeQueryBundle(bundle: QueryBundle<EntityRef>): NormalizedQueryBundle<EntityRef> {
  const { entities, ...bundleRest } = bundle;
  const { query, operators, ports, ...entityRest } = entities;
  return {
    ...bundleRest,
    entities: {
      ...entityRest,
      query: {
        ...query,
        attributes: normalizeAttributes(query.custom_attributes),
      },
      operators: Object.fromEntries(
        Object.entries(operators).map(([id, operator]) => [id, normalizeOperator(operator)])
      ),
      ports: Object.fromEntries(
        Object.entries(ports).map(([id, port]) => [id, normalizePort(port)])
      ),
    },
  };
}

export const queryBundleQueryOptions = ({ engineId, queryId }: QueryBundleParams) =>
  queryOptions({
    queryKey: ['queryBundle', engineId, queryId],
    queryFn: async (): Promise<NormalizedQueryBundle<EntityRef>> =>
      normalizeQueryBundle(await fetchQueryBundle(engineId, queryId)),
    staleTime: DEFAULT_STALE_TIME,
    retry: 2,
  });

export const useQueryBundle = (params: QueryBundleParams, options?: { staleTime?: number }) =>
  useQuery({
    ...queryBundleQueryOptions(params),
    staleTime: options?.staleTime ?? DEFAULT_STALE_TIME,
  });

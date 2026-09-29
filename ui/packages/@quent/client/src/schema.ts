// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryOptions } from '@tanstack/react-query';
import type { Schema } from '@quent/schema';
import { fetchSchema } from './api';
import { DEFAULT_STALE_TIME } from './constants';

export type SchemaFetcher = (engineId: string) => Promise<Schema>;

interface SchemaQueryParams {
  engineId: string;
  fetcher?: SchemaFetcher;
}

export const schemaQueryOptions = ({ engineId, fetcher = fetchSchema }: SchemaQueryParams) =>
  queryOptions({
    queryKey: ['schema', engineId],
    queryFn: (): Promise<Schema> => fetcher(engineId),
    staleTime: DEFAULT_STALE_TIME,
    retry: 2,
  });

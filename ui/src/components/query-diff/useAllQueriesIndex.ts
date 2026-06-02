// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
} from '@quent/client';
import type { Engine } from '@quent/utils';

export interface QueryPickerOption {
  queryId: string;
  engineId: string;
  engineName: string;
  groupId: string;
  groupName: string;
  queryName: string;
  searchText: string;
}

export interface UseAllQueriesIndexResult {
  options: QueryPickerOption[];
  optionsByQueryId: Map<string, QueryPickerOption>;
  engines: Engine[];
  isLoading: boolean;
}

const EMPTY_OPTIONS: QueryPickerOption[] = [];

/** Flat index of every query across every engine/group, for searchable pickers. */
export function useAllQueriesIndex(): UseAllQueriesIndexResult {
  const enginesQuery = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });
  const engines = enginesQuery.data ?? [];
  const engineIdsKey = engines.map(engine => engine.id).join('\0');

  const indexQuery = useQuery({
    queryKey: ['diff_all_queries_index', engineIdsKey],
    queryFn: async (): Promise<QueryPickerOption[]> => {
      const collected: QueryPickerOption[] = [];
      await Promise.all(
        engines.map(async engine => {
          const engineName = engine.instance_name ?? engine.id;
          const groups = await fetchListCoordinators(engine.id);
          await Promise.all(
            groups.map(async group => {
              const groupName = group.instance_name ?? group.id;
              const queries = await fetchListQueries(engine.id, group.id);
              for (const query of queries) {
                const queryName = query.instance_name ?? query.id;
                collected.push({
                  queryId: query.id,
                  engineId: engine.id,
                  engineName,
                  groupId: group.id,
                  groupName,
                  queryName,
                  searchText:
                    `${queryName} ${query.id} ${engineName} ${groupName}`.toLowerCase(),
                });
              }
            })
          );
        })
      );
      return collected;
    },
    enabled: engines.length > 0,
  });

  const options = indexQuery.data ?? EMPTY_OPTIONS;
  const optionsByQueryId = useMemo(() => {
    const map = new Map<string, QueryPickerOption>();
    for (const option of options) {
      // first-write-wins: same queryId across engines is rare; favor first hit
      if (!map.has(option.queryId)) map.set(option.queryId, option);
    }
    return map;
  }, [options]);

  return {
    options,
    optionsByQueryId,
    engines,
    isLoading: enginesQuery.isLoading || indexQuery.isLoading,
  };
}

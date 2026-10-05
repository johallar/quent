// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { fetchListEngines, fetchListQueries } from '@quent/client';
import { Button, DataText } from '@quent/components';
import { formatDuration } from '@quent/utils';
import type { Engine, Query } from '@quent/utils';
import {
  EntityCatalogTable,
  type CatalogMetadataColumn,
} from '@/components/query-selection/EntityCatalogTable';

const engineColumns: CatalogMetadataColumn<Engine>[] = [
  {
    id: 'implementation',
    label: 'Implementation',
    render: engine => (
      <DataText>
        {[engine.implementation?.name, engine.implementation?.version].filter(Boolean).join(' ') ||
          '—'}
      </DataText>
    ),
  },
];

const queryColumns: CatalogMetadataColumn<Query>[] = [
  {
    id: 'started',
    label: 'Started',
    render: query => (
      <DataText className="tabular-nums">
        {query.start_unix_ns == null
          ? '—'
          : new Date(Number(query.start_unix_ns / 1_000_000n)).toLocaleString()}
      </DataText>
    ),
  },
  {
    id: 'planning',
    label: 'Planning',
    render: query => (
      <DataText className="tabular-nums">
        {query.planning_s == null ? '—' : formatDuration(query.planning_s * 1000)}
      </DataText>
    ),
  },
  {
    id: 'duration',
    label: 'Duration',
    render: query => (
      <DataText className="tabular-nums">
        {query.completed_s == null ? '—' : formatDuration(query.completed_s * 1000)}
      </DataText>
    ),
  },
];

export function EngineSelectionPage() {
  const navigate = useNavigate();
  const [engineId, setEngineId] = useState('');
  const enginesList = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });
  const queryList = useQuery({
    queryKey: ['list_queries', engineId],
    queryFn: () => fetchListQueries(engineId),
    enabled: !!engineId,
  });
  const selectedEngine = enginesList.data?.items.find(engine => engine.id === engineId);

  const openQuery = (query: Query) => {
    navigate({
      to: '/profile/engine/$engineId/query/$queryId',
      params: { engineId, queryId: query.id },
      search: {},
    });
  };

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
        {engineId && selectedEngine ? (
          <div className="mb-6 flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Selected engine
              </p>
              <DataText as="p" className="mt-1 text-base font-semibold">
                {selectedEngine.instance_name ?? selectedEngine.id}
              </DataText>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEngineId('')}>
              <ArrowLeft />
              Change engine
            </Button>
          </div>
        ) : null}

        {engineId ? (
          <EntityCatalogTable
            key={engineId}
            title="Select a query"
            description="Search query metadata or use the analyzer’s suggested grouping to find the profile you want to inspect."
            items={queryList.data?.items ?? []}
            initialGroupBy={queryList.data?.initial_group_by_attribute ?? null}
            metadataColumns={queryColumns}
            isLoading={queryList.isLoading}
            error={queryList.error instanceof Error ? queryList.error : null}
            emptyMessage="This engine has no queries."
            actionLabel="Open profile"
            onRetry={() => void queryList.refetch()}
            onSelect={openQuery}
          />
        ) : (
          <EntityCatalogTable
            title="Select an engine"
            description="Search recorded engines and compare their runtime metadata before choosing a query."
            items={enginesList.data?.items ?? []}
            initialGroupBy={enginesList.data?.initial_group_by_attribute ?? null}
            metadataColumns={engineColumns}
            isLoading={enginesList.isLoading}
            error={enginesList.error instanceof Error ? enginesList.error : null}
            emptyMessage="No engines are available."
            actionLabel="View queries"
            onRetry={() => void enginesList.refetch()}
            onSelect={engine => setEngineId(engine.id)}
          />
        )}
      </div>
    </div>
  );
}

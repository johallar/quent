// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { fetchListEngines, fetchListQueries } from '@quent/client';
import { Button, DataText } from '@quent/components';
import { formatDuration } from '@quent/utils';
import type { Query } from '@quent/utils';
import {
  EntityCatalogTable,
  type CatalogMetadataColumn,
} from '@/components/query-selection/EntityCatalogTable';

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

export function QuerySelectionPage({ engineId }: { engineId: string }) {
  const navigate = useNavigate();
  const enginesList = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });
  const queryList = useQuery({
    queryKey: ['list_queries', engineId],
    queryFn: () => fetchListQueries(engineId),
  });
  const selectedEngine = enginesList.data?.items.find(engine => engine.id === engineId);

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex shrink-0 flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected engine
          </p>
          <DataText as="p" className="mt-1 text-base font-semibold">
            {selectedEngine?.instance_name ?? engineId}
          </DataText>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate({ to: '/' })}>
          <ArrowLeft />
          Change engine
        </Button>
      </div>

      <EntityCatalogTable
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
        onSelect={query =>
          navigate({
            to: '/profile/engine/$engineId/query/$queryId',
            params: { engineId, queryId: query.id },
            search: {},
          })
        }
      />
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { queryBundleQueryOptions } from '@quent/client';
import { queryClient } from '@/lib/queryClient';
import { useUrlStateSync } from '@/hooks/useUrlStateSync';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { safeRun } from '@/lib/safeUrlState';
import type { QueryBundle, EntityRef } from '@quent/utils';
import { cn } from '@quent/utils';
import type { QueryIndexSearch } from '@/hooks/useUrlStateSync';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId')({
  validateSearch: (search: Record<string, unknown>): QueryIndexSearch =>
    safeRun<QueryIndexSearch>(
      'validate-search',
      () => ({
        planId: typeof search.planId === 'string' ? search.planId : undefined,
        operatorId: typeof search.operatorId === 'string' ? search.operatorId : undefined,
        operatorLabel: typeof search.operatorLabel === 'string' ? search.operatorLabel : undefined,
        zoomStart: Number.isFinite(Number(search.zoomStart)) ? Number(search.zoomStart) : undefined,
        zoomEnd: Number.isFinite(Number(search.zoomEnd)) ? Number(search.zoomEnd) : undefined,
        hideTasks:
          search.hideTasks === 'true' ? true : search.hideTasks === 'false' ? false : undefined,
        treeState: typeof search.treeState === 'string' ? search.treeState : undefined,
        dagState: typeof search.dagState === 'string' ? search.dagState : undefined,
        operatorsState:
          typeof search.operatorsState === 'string' ? search.operatorsState : undefined,
      }),
      {}
    ),
  component: QueryLayout,
  loader: async ({ params }): Promise<QueryBundle<EntityRef>> => {
    const { engineId, queryId } = params;
    return await queryClient.ensureQueryData(queryBundleQueryOptions({ engineId, queryId }));
  },
});

const tabClass = cn(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1',
  'text-sm font-normal text-muted-foreground transition-all',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
);

const activeTabClass = cn(tabClass, 'text-foreground font-semibold bg-muted shadow');

function UrlStateSync({ search }: { search: QueryIndexSearch }) {
  useUrlStateSync(search);
  return null;
}

function QueryLayout() {
  const { engineId, queryId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <div className="flex flex-col h-full w-full">
      <ErrorBoundary label="useUrlStateSync">
        <UrlStateSync search={search} />
      </ErrorBoundary>
      <div className="shrink-0 border-b">
        <div className="inline-flex h-9 w-full items-center justify-center p-1 text-muted-foreground gap-0">
          <Link
            to="/profile/engine/$engineId/query/$queryId/timeline"
            params={{ engineId, queryId }}
            search={search}
            className={tabClass}
            activeProps={{ className: activeTabClass }}
          >
            Timeline
          </Link>
          <Link
            to="/profile/engine/$engineId/query/$queryId/operators"
            params={{ engineId, queryId }}
            search={search}
            className={tabClass}
            activeProps={{ className: activeTabClass }}
          >
            Operators
          </Link>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}

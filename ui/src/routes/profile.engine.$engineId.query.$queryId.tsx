// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { ArrowLeftRight } from 'lucide-react';
import { queryBundleQueryOptions } from '@quent/client';
import { queryClient } from '@/lib/queryClient';
import type { QueryBundle, EntityRef } from '@quent/utils';
import { cn } from '@quent/utils';
import { RouteError } from '@/components/RouteError';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId')({
  component: QueryLayout,
  errorComponent: RouteError,
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

function QueryLayout() {
  const { engineId, queryId } = Route.useParams();
  return (
    <div className="flex flex-col h-full w-full">
      <div className="shrink-0 border-b">
        <div className="relative flex h-9 w-full items-center p-1 text-muted-foreground">
          <div className="inline-flex flex-1 items-center justify-center gap-0">
            <Link
              to="/profile/engine/$engineId/query/$queryId/timeline"
              params={{ engineId, queryId }}
              className={tabClass}
              activeProps={{ className: activeTabClass }}
            >
              Timeline
            </Link>
            <Link
              to="/profile/engine/$engineId/query/$queryId/operators"
              params={{ engineId, queryId }}
              className={tabClass}
              activeProps={{ className: activeTabClass }}
            >
              Operators
            </Link>
          </div>
          <Link
            to="/diff/query/$baselineQueryId"
            params={{ baselineQueryId: queryId }}
            className={cn(
              'absolute right-2 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1',
              'text-xs font-medium text-muted-foreground transition-colors',
              'hover:bg-muted hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
            )}
            title="Compare this query against others"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            Compare to…
          </Link>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}

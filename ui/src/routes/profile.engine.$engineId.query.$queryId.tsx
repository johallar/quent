// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { queryBundleQueryOptions, schemaQueryOptions } from '@quent/client';
import {
  FEATURE_IDS,
  resolveFeatureSetFromSchema,
  type SchemaFeatureResolution,
} from '@quent/features';
import { queryClient } from '@/lib/queryClient';
import type { QueryBundle, EntityRef } from '@quent/utils';
import { cn } from '@quent/utils';
import { QueryLoading } from '@/components/QueryLoading';
import { RouteError } from '@/components/RouteError';
import { CopyLinkButton, validateDeepLinkSearch } from '@/features/deep-link';
import { resolveQueryComposition, useFeatureRegistry } from '@/features/capabilities';

export interface QueryAnalysisData {
  queryBundle: QueryBundle<EntityRef>;
  featureResolution: SchemaFeatureResolution;
  schemaExperimentId: string;
}

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId')({
  component: QueryLayout,
  errorComponent: RouteError,
  pendingComponent: QueryLoading,
  pendingMs: 200,
  pendingMinMs: 300,
  validateSearch: validateDeepLinkSearch,
  loader: async ({ context, params }): Promise<QueryAnalysisData> => {
    const { engineId, queryId } = params;
    const { schemaExperiment } = context;
    const [queryBundle, schema] = await Promise.all([
      queryClient.ensureQueryData(queryBundleQueryOptions({ engineId, queryId })),
      queryClient.ensureQueryData(
        schemaQueryOptions({
          engineId,
          fetcher: schemaExperiment.fetcher,
          cacheKey: schemaExperiment.id,
        })
      ),
    ]);
    return {
      queryBundle,
      schemaExperimentId: schemaExperiment.id,
      featureResolution: resolveFeatureSetFromSchema(schema, {
        hostFeatures: [FEATURE_IDS.queryEngineCore],
      }),
    };
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
  const features = useFeatureRegistry();
  const composition = resolveQueryComposition(features);
  return (
    <div className="flex min-w-0 flex-col h-full w-full">
      <div className="shrink-0 border-b">
        <div className="inline-flex h-9 w-full items-center justify-center gap-0 p-1 text-muted-foreground">
          {composition.tabs.map(tab => (
            <Link
              key={tab.id}
              to={tab.to}
              params={{ engineId, queryId }}
              className={tabClass}
              activeProps={{ className: activeTabClass }}
            >
              {tab.label}
            </Link>
          ))}
          <CopyLinkButton />
        </div>
      </div>
      <div className="min-w-0 flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}

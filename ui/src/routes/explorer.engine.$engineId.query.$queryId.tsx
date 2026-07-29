// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { queryBundleQueryOptions } from '@quent/client';
import { createFileRoute } from '@tanstack/react-router';
import { Provider } from 'jotai';
import type { EntityRef, QueryBundle } from '@quent/utils';
import { ResourceTimelineExplorer } from '@/components/explorer/ResourceTimelineExplorer';
import { RouteError } from '@/components/RouteError';
import { queryClient } from '@/lib/queryClient';

export const Route = createFileRoute('/explorer/engine/$engineId/query/$queryId')({
  component: ExplorerRoute,
  errorComponent: RouteError,
  loader: async ({ params }): Promise<QueryBundle<EntityRef>> => {
    return await queryClient.ensureQueryData(
      queryBundleQueryOptions({ engineId: params.engineId, queryId: params.queryId })
    );
  },
});

function ExplorerRoute() {
  const { engineId, queryId } = Route.useParams();
  const queryBundle = Route.useLoaderData();

  return (
    <Provider key={queryId}>
      <ResourceTimelineExplorer engineId={engineId} queryBundle={queryBundle} />
    </Provider>
  );
}

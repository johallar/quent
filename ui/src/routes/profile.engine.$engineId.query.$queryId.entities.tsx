// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Navigate } from '@tanstack/react-router';
import { EntitiesTable } from '@/components/entities-table/EntitiesTable';
import { Route as QueryRoute } from './profile.engine.$engineId.query.$queryId';
import {
  NoAvailableQuerySurface,
  queryTabRoute,
  resolveAvailableQueryTab,
  resolveQueryComposition,
  useFeatureRegistry,
} from '@/features/capabilities';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId/entities')({
  component: EntitiesTab,
});

function EntitiesTab() {
  const { engineId, queryId } = Route.useParams();
  const { queryBundle } = QueryRoute.useLoaderData();
  const composition = resolveQueryComposition(useFeatureRegistry());
  const availableTab = resolveAvailableQueryTab(composition, 'entities');
  if (!availableTab) {
    return <NoAvailableQuerySurface />;
  }
  if (availableTab !== 'entities') {
    return (
      <Navigate
        to={queryTabRoute(availableTab)}
        params={{ engineId, queryId }}
        search={{}}
        replace
      />
    );
  }
  return <EntitiesTable engineId={engineId} queryId={queryId} queryBundle={queryBundle} />;
}

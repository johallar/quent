// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Navigate } from '@tanstack/react-router';
import { OperatorTable } from '@/components/operator-table/OperatorTable';
import { Route as QueryRoute } from './profile.engine.$engineId.query.$queryId';
import {
  NoAvailableQuerySurface,
  queryTabRoute,
  resolveAvailableQueryTab,
  resolveQueryComposition,
  useFeatureRegistry,
} from '@/features/capabilities';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId/operators')({
  component: OperatorsTab,
});

function OperatorsTab() {
  const { engineId, queryId } = Route.useParams();
  const features = useFeatureRegistry();
  const { queryBundle } = QueryRoute.useLoaderData();
  const composition = resolveQueryComposition(features);
  const availableTab = resolveAvailableQueryTab(composition, 'operators');
  if (!availableTab) {
    return <NoAvailableQuerySurface />;
  }
  if (availableTab !== 'operators') {
    return (
      <Navigate
        to={queryTabRoute(availableTab)}
        params={{ engineId, queryId }}
        search={{}}
        replace
      />
    );
  }
  return <OperatorTable queryBundle={queryBundle} />;
}

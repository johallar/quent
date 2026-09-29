// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Navigate } from '@tanstack/react-router';
import {
  NoAvailableQuerySurface,
  queryTabRoute,
  resolveAvailableQueryTab,
  resolveQueryComposition,
  useFeatureRegistry,
} from '@/features/capabilities';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId/')({
  component: QueryIndex,
});

function QueryIndex() {
  const params = Route.useParams();
  const search = Route.useSearch();
  const composition = resolveQueryComposition(useFeatureRegistry());
  const defaultTab = resolveAvailableQueryTab(composition, 'timeline');

  if (!defaultTab) {
    return <NoAvailableQuerySurface />;
  }
  return <Navigate to={queryTabRoute(defaultTab)} params={params} search={search} replace />;
}

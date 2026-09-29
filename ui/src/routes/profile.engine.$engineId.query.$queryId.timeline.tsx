// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Navigate } from '@tanstack/react-router';
import { QueryResourceTree } from '@/components/timeline-tree';
import { Route as QueryRoute } from './profile.engine.$engineId.query.$queryId';
import { useDeepLink } from '@/features/deep-link';
import {
  NoAvailableQuerySurface,
  queryTabRoute,
  resolveAvailableQueryTab,
  resolveQueryComposition,
  useFeatureRegistry,
} from '@/features/capabilities';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId/timeline')({
  component: TimelineTab,
});

function TimelineTab() {
  const { engineId, queryId } = Route.useParams();
  const { queryBundle } = QueryRoute.useLoaderData();
  const features = useFeatureRegistry();
  const composition = resolveQueryComposition(features);
  const deepLink = useDeepLink();
  const availableTab = resolveAvailableQueryTab(composition, 'timeline');
  if (!availableTab) {
    return <NoAvailableQuerySurface />;
  }
  if (availableTab !== 'timeline') {
    return (
      <Navigate
        to={queryTabRoute(availableTab)}
        params={{ engineId, queryId }}
        search={{}}
        replace
      />
    );
  }
  return (
    <div className="flex min-w-0 w-full h-full min-h-[200px]">
      <QueryResourceTree
        engineId={engineId}
        queryBundle={queryBundle}
        initialZoomRange={deepLink?.initialZoomRange ?? undefined}
        seedRootExpanded={deepLink?.initialExpandedResourceIds === null}
        showOperatorGantt={composition.showOperatorGantt}
        showNvtx={composition.showNvtx}
      />
    </div>
  );
}

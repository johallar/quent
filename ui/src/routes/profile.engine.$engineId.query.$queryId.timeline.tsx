// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute } from '@tanstack/react-router';
import { QueryResourceTree } from '@/components/QueryResourceTree';
import { decodeTreeState } from '@/lib/treeStateParam';
import { Route as QueryRoute } from './profile.engine.$engineId.query.$queryId';

export const Route = createFileRoute('/profile/engine/$engineId/query/$queryId/timeline')({
  component: TimelineTab,
});

function TimelineTab() {
  const { engineId } = Route.useParams();
  const queryBundle = QueryRoute.useLoaderData();
  const search = QueryRoute.useSearch();
  const initialZoom =
    search.zoomStart !== undefined && search.zoomEnd !== undefined
      ? { start: search.zoomStart, end: search.zoomEnd }
      : undefined;
  const initialTreeState = search.treeState ? decodeTreeState(search.treeState) : null;

  return (
    <div className="flex items-center justify-center w-full h-full min-h-[200px]">
      <QueryResourceTree
        engineId={engineId}
        queryBundle={queryBundle}
        initialZoom={initialZoom}
        initialTreeState={initialTreeState}
      />
    </div>
  );
}

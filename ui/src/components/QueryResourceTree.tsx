// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { EntityRef, QueryBundle } from '@quent/utils';
import { useNvtxTreeModel } from '@/components/NvtxTree';
import { useResourceTimelinesTreeModel } from '@/components/ResourceTimelinesTree';
import { TimelineTreeTable, useTimelineTreeSetup } from '@/components/TimelineTreeTable';

interface QueryResourceTreeProps {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
}

export function QueryResourceTree({ queryBundle, engineId }: QueryResourceTreeProps) {
  const { durationSeconds, isDark } = useTimelineTreeSetup(queryBundle);
  const resourceTree = useResourceTimelinesTreeModel({ engineId, queryBundle, isDark });
  const nvtxTree = useNvtxTreeModel({ engineId, queryBundle, isDark });

  return (
    <TimelineTreeTable
      durationSeconds={durationSeconds}
      isDark={isDark}
      trees={[resourceTree, nvtxTree]}
      controls={resourceTree}
    />
  );
}

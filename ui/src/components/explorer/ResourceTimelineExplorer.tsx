// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  Badge,
  Button,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  nanosToMs,
} from '@quent/components';
import {
  useDebouncedZoomRange,
  useHydrateTimelineAtoms,
  useSelectedNodeIds,
  useSetSelectedNodeIds,
  useSetSelectedOperatorLabel,
  useSetSelectedPlanId,
} from '@quent/hooks';
import type { EntityRef, QueryBundle } from '@quent/utils';
import { ArrowLeft } from 'lucide-react';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';
import { OperatorTable } from '@/components/operator-table/OperatorTable';
import { LeafResourceTimelinePanel } from './LeafResourceTimelinePanel';
import { RelatedEntitiesTable } from './RelatedEntitiesTable';

type ResourceTimelineExplorerProps = {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
};

export function ResourceTimelineExplorer({ engineId, queryBundle }: ResourceTimelineExplorerProps) {
  const [focusedResourceId, setFocusedResourceId] = useState<string | null>(null);
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const selectedNodeIds = useSelectedNodeIds();
  const setSelectedNodeIds = useSetSelectedNodeIds();
  const setSelectedOperatorLabel = useSetSelectedOperatorLabel();
  const setSelectedPlanId = useSetSelectedPlanId();
  const startTimeMs = useMemo(
    () => nanosToMs(queryBundle.start_time_unix_ns),
    [queryBundle.start_time_unix_ns]
  );

  useHydrateTimelineAtoms({
    zoomRange: { start: 0, end: queryBundle.duration_s },
    debouncedZoomRange: { start: 0, end: queryBundle.duration_s },
    startTimeMs,
  });
  const zoomRange = useDebouncedZoomRange();

  useEffect(() => {
    setSelectedPlanId(queryBundle.plan_tree.id);
  }, [queryBundle.plan_tree.id, setSelectedPlanId]);

  const handleOperatorSelect = useCallback(
    (operatorId: string) => {
      const shouldClear = selectedNodeIds.size === 1 && selectedNodeIds.has(operatorId);
      if (shouldClear) {
        setSelectedNodeIds(new Set());
        setSelectedOperatorLabel(null);
        return;
      }

      const operator = queryBundle.entities.operators[operatorId];
      setSelectedNodeIds(new Set([operatorId]));
      setSelectedOperatorLabel(operator?.instance_name ?? operatorId);
    },
    [queryBundle.entities.operators, selectedNodeIds, setSelectedNodeIds, setSelectedOperatorLabel]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-0 min-w-0 flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border bg-card px-4">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link
              to="/profile/engine/$engineId/query/$queryId/timeline"
              params={{ engineId, queryId: queryBundle.query_id }}
            >
              <ArrowLeft className="h-4 w-4" />
              Profile
            </Link>
          </Button>
          <div className="h-6 w-px bg-border" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-semibold">Resource Timeline Explorer</h1>
              <Badge variant="outline">POC</Badge>
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {engineId} / {queryBundle.query_id}
            </p>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>{focusedResourceId ? 'Focused resource' : 'Choose a resource'}</div>
          {focusedResourceId && (
            <div className="max-w-72 truncate font-mono text-data">{focusedResourceId}</div>
          )}
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="60%" minSize="35%" className="min-w-0">
          <LeafResourceTimelinePanel
            engineId={engineId}
            queryBundle={queryBundle}
            focusedResourceId={focusedResourceId}
            onFocusedResourceChange={setFocusedResourceId}
            isDark={isDark}
          />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="40%" minSize="25%" className="min-w-0">
          <Tabs defaultValue="entities" className="h-full bg-card">
            <TabsList>
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="operators">Operators</TabsTrigger>
            </TabsList>
            <TabsContent value="entities" className="mt-0 min-h-0 flex-1">
              <RelatedEntitiesTable
                engineId={engineId}
                queryBundle={queryBundle}
                focusedResourceId={focusedResourceId}
              />
            </TabsContent>
            <TabsContent value="operators" className="mt-0 min-h-0 flex-1">
              <OperatorTable
                queryBundle={queryBundle}
                window={zoomRange}
                onOperatorSelect={handleOperatorSelect}
              />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

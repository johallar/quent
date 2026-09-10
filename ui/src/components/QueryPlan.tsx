// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, lazy, Suspense } from 'react';
import { useQueryBundle, useDataFlow } from '@quent/client';
import { useQueryPlanVisualization } from '@/hooks/useQueryPlanVisualization';
import { Badge, getSelectedOperatorCountsByPlan, TreeView } from '@quent/components';
import { thinScrollbarClass, type QueryPlanDataItem } from '@quent/components';
import {
  useSelectedOperatorIds,
  useSelectedPlanId,
  useSetSelectedPlanId,
  useSetHoveredWorkerId,
} from '@quent/hooks';
import { DAGNodeInfoPanel, DAGSettingsPopover, DagPlayhead } from '@quent/components';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@quent/components';
import {
  useDagNodeColoring,
  useDagEdgeWidthConfig,
  useDagEdgeColoring,
  useOperatorStatFields,
  usePortStatFields,
  useDataFlowSync,
  useDebouncedZoomRange,
  resolveDataFlowWindow,
} from '@quent/hooks';
import { MAX_TIMELINE_BINS } from '@quent/utils';
import {
  computeNodeColoring,
  computeEdgeWidthConfig,
  computeEdgeColoring,
  parseCustomStatistics,
} from '@quent/components';
import { DataText } from '@quent/components';
import { useTheme, THEME_DARK } from '@/contexts/ThemeContext';

// Lazy load DAGChart to split elkjs (~1.6MB) into a separate chunk
const DAGChart = lazy(() => import('@quent/components').then(mod => ({ default: mod.DAGChart })));

const TABS = {
  PLAN: 'plan',
} as const;

export function QueryPlan({ queryId, engineId }: { queryId: string; engineId: string }) {
  const { theme } = useTheme();
  const isDark = theme === THEME_DARK;
  const planId = useSelectedPlanId();
  const setPlanId = useSetSelectedPlanId();
  const setHoveredWorkerId = useSetHoveredWorkerId();
  const selectedOperatorIds = useSelectedOperatorIds();
  const {
    data: queryBundle,
    isLoading: queryBundleLoading,
    error: queryBundleError,
  } = useQueryBundle({ engineId, queryId });
  const selectedOperatorCountsByPlan = useMemo(
    () =>
      queryBundle
        ? getSelectedOperatorCountsByPlan(queryBundle, selectedOperatorIds)
        : new Map<string, number>(),
    [queryBundle, selectedOperatorIds]
  );

  const { dagData, treeData, error: dagError } = useQueryPlanVisualization(queryBundle, planId);
  const operators = useMemo(
    () => Object.values(queryBundle?.entities.operators ?? {}),
    [queryBundle?.entities.operators]
  );

  // Data-flow overlay: fetch the categorical timeline for the current zoom
  // window (fallback: full query duration) and sync it into the data-flow
  // atoms. The first response doubles as the feature probe — `null` (HTTP
  // 501, analyzer without data-flow support) or an empty result hides the
  // playhead, bars, controls, and legend entries.
  const debouncedZoomRange = useDebouncedZoomRange();
  const dataFlowWindow = resolveDataFlowWindow(debouncedZoomRange, queryBundle?.duration_s ?? 0);
  const { data: dataFlowResponse } = useDataFlow(
    {
      engineId,
      queryId,
      config: {
        num_bins: MAX_TIMELINE_BINS,
        start: dataFlowWindow.start,
        end: dataFlowWindow.end,
      },
    },
    { enabled: !!queryBundle && dataFlowWindow.end > dataFlowWindow.start }
  );
  useDataFlowSync({ response: dataFlowResponse, queryBundle });

  useDagNodeColoring(dagData.nodes, computeNodeColoring, isDark);
  useDagEdgeWidthConfig(dagData.edges, computeEdgeWidthConfig);
  useDagEdgeColoring(dagData.edges, computeEdgeColoring, isDark);
  const operatorStatFields = useOperatorStatFields(dagData.nodes, parseCustomStatistics);
  const portStatFields = usePortStatFields(dagData.edges);

  const handlePlanSelect = (item: QueryPlanDataItem | undefined) => {
    if (item) {
      setPlanId(item.id);
    }
  };

  // TODO: Currently fetching root plan when bundle loads - is this correct?
  useEffect(() => {
    if (queryBundle && !planId) {
      setPlanId(queryBundle.plan_tree.id);
    }
  }, [queryBundle, planId, setPlanId]);

  // handle loading and error states
  if (queryBundleLoading) {
    return (
      <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex justify-center items-center h-full text-muted-foreground">
          Loading query plan...
        </div>
      </div>
    );
  }

  const errorMessage = queryBundleError
    ? `Failed to load query plan: ${queryBundleError instanceof Error ? queryBundleError.message : 'Unknown error'}`
    : dagError
      ? `Failed to generate query plan visualization: ${dagError.message}`
      : null;

  if (errorMessage) {
    return (
      <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
        <div className="flex justify-center items-center h-full text-destructive">
          {errorMessage}
        </div>
      </div>
    );
  }

  if (!queryBundle || !planId) {
    return null;
  }

  const singleQueryPlan = treeData.length === 1 && !treeData[0]?.children;

  const renderItem = ({ item, hasChildren }: { item: QueryPlanDataItem; hasChildren: boolean }) => {
    const selectedOperatorCount = selectedOperatorCountsByPlan.get(item.id) ?? 0;
    const selectedOperatorLabel = `${selectedOperatorCount} operator${
      selectedOperatorCount === 1 ? '' : 's'
    } selected`;

    return (
      <div className="flex flex-col items-start py-0.5 pl-1">
        <div className="flex items-center gap-1.5">
          {singleQueryPlan ? (
            <span className="text-xs">
              Query: <DataText>{item.queryId}</DataText>
            </span>
          ) : (
            <span className="text-xs">
              <DataText className="capitalize">{item.planType}</DataText>
              {!hasChildren && (
                <span>
                  : <DataText>{item.id}</DataText>
                </span>
              )}
            </span>
          )}
          {selectedOperatorCount > 0 && (
            <Badge
              variant="secondary"
              className="h-4 min-w-4 rounded-full px-1 py-0 text-[10px] leading-none"
              aria-label={selectedOperatorLabel}
              title={selectedOperatorLabel}
            >
              {selectedOperatorCount}
            </Badge>
          )}
        </div>
        {item.workerId && (
          <span className="text-xs text-muted-foreground">
            <DataText>Worker: {item.workerName ?? item.workerId}</DataText>
          </span>
        )}
        {hasChildren && (
          <span className="text-xs text-muted-foreground capitalize text-left">
            <DataText>{`ID: ${item.id}`}</DataText>
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col h-[calc(100vh-4rem)]">
      <section className="max-h-[300px] shrink-0 overflow-hidden border-b">
        <Tabs defaultValue={TABS.PLAN} className="h-auto flex-none">
          <div className="flex shrink-0 items-center border-b">
            <TabsList className="min-w-0 flex-1 border-b-0">
              <TabsTrigger value={TABS.PLAN}>Query Plan</TabsTrigger>
            </TabsList>
            <DAGSettingsPopover
              operatorStatFields={operatorStatFields}
              portStatFields={portStatFields}
              isDark={isDark}
            />
          </div>
          <TabsContent
            value={TABS.PLAN}
            className={`max-h-[264px] overflow-y-auto ${thinScrollbarClass}`}
          >
            <TreeView<QueryPlanDataItem>
              data={treeData}
              initialSelectedItemId={planId}
              selectedItemId={planId}
              onSelectChange={handlePlanSelect}
              onItemHover={item => setHoveredWorkerId(item?.workerId ?? null)}
              renderItem={renderItem}
            />
          </TabsContent>
        </Tabs>
      </section>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 min-h-0">
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Loading visualization...
              </div>
            }
          >
            <DAGChart data={dagData} height="100%" isDark={isDark} operators={operators} />
          </Suspense>
        </div>
        <DagPlayhead />
        <DAGNodeInfoPanel isDark={isDark} quantitySpecs={queryBundle.quantity_specs} />
      </div>
    </div>
  );
}

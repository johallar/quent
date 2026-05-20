// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronDown } from 'lucide-react';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  queryBundleQueryOptions,
} from '@quent/client';
import type { Engine, Query, QueryGroup } from '@quent/utils';
import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  DataText,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@quent/components';
import { cn } from '@quent/utils';
import { QueryDiffTable } from '@/components/query-diff/QueryDiffTable';
import { QueryDiffStats } from '@/components/query-diff/QueryDiffStats';
import { QueryDiffTimeline } from '@/components/query-diff/QueryDiffTimeline';
import { getQueryDiffQueryColors } from '@/components/query-diff/QueryDiffColors';
import { buildQueryProfileDiffFromBundles } from '@/components/query-diff/queryProfileDiffFromBundles';
import { THEME_DARK, useTheme } from '@/contexts/ThemeContext';

interface DiffSelectionPageProps {
  initialQueryAEngineId?: string;
  initialQueryBEngineId?: string;
  initialQueryAId?: string;
  initialQueryBId?: string;
}

interface QuerySideState {
  engineId: string;
  groupId: string;
  queryId: string;
}

interface QuerySelectorColumnProps {
  label: string;
  side: QuerySideState;
  engines: Engine[];
  queryGroups: QueryGroup[];
  queriesByGroup: Record<string, Query[]>;
  queriesLoading: boolean;
  onEngineChange: (engineId: string) => void;
  onGroupChange: (groupId: string) => void;
  onQueryChange: (queryId: string) => void;
}

const COMPACT_SELECT_TRIGGER_CLASS =
  'h-7 min-w-0 rounded px-2 py-1 text-xs [&_svg]:h-3 [&_svg]:w-3';
const COMPACT_SELECT_ITEM_CLASS = 'py-1 pl-7 pr-2 text-xs';

let pendingSelectionOpenAfterNavigation: boolean | null = null;

function getInitialSelectionOpen(
  queryAEngineId: string,
  queryBEngineId: string,
  queryAId: string,
  queryBId: string
): boolean {
  if (pendingSelectionOpenAfterNavigation !== null) {
    const selectionOpen = pendingSelectionOpenAfterNavigation;
    pendingSelectionOpenAfterNavigation = null;
    return selectionOpen;
  }
  return !(
    queryAEngineId &&
    queryBEngineId &&
    queryAId &&
    queryBId &&
    !(queryAEngineId === queryBEngineId && queryAId === queryBId)
  );
}

function findGroupForQuery(
  queryId: string,
  queriesByGroup: Record<string, Query[]>
): string | undefined {
  if (!queryId) return undefined;
  return Object.entries(queriesByGroup).find(([, queries]) =>
    queries.some(query => query.id === queryId)
  )?.[0];
}

function queryLabel(query: Query): string {
  return query.instance_name ?? query.id;
}

function engineLabel(engine: Engine): string {
  return engine.instance_name ?? engine.id;
}

function engineDisplayLabel(engineId: string, engines: Engine[], emptyLabel: string): string {
  if (!engineId) return emptyLabel;
  const engine = engines.find(item => item.id === engineId);
  return engine ? engineLabel(engine) : engineId;
}

function findQueryById(
  queryId: string,
  queriesByGroup: Record<string, Query[]>
): Query | undefined {
  if (!queryId) return undefined;
  return Object.values(queriesByGroup)
    .flat()
    .find(query => query.id === queryId);
}

function queryDisplayLabel(
  queryId: string,
  queriesByGroup: Record<string, Query[]>,
  emptyLabel: string
): string {
  if (!queryId) return emptyLabel;
  const query = findQueryById(queryId, queriesByGroup);
  return query ? queryLabel(query) : queryId;
}

function useQueryCatalog(engineId: string) {
  const { data: queryGroups = [], isLoading: queryGroupsLoading } = useQuery({
    queryKey: ['list_coordinators', engineId],
    queryFn: () => fetchListCoordinators(engineId),
    enabled: Boolean(engineId),
  });

  const { data: queriesByGroup = {}, isLoading: queriesLoading } = useQuery({
    queryKey: ['diff_queries_by_group', engineId, queryGroups.map(group => group.id).join('\0')],
    queryFn: async () => {
      const entries = await Promise.all(
        queryGroups.map(
          async group => [group.id, await fetchListQueries(engineId, group.id)] as const
        )
      );
      return Object.fromEntries(entries);
    },
    enabled: Boolean(engineId && queryGroups.length > 0),
  });

  return {
    queryGroups,
    queriesByGroup,
    queriesLoading: queryGroupsLoading || queriesLoading,
  };
}

function QuerySelectorColumn({
  label,
  side,
  engines,
  queryGroups,
  queriesByGroup,
  queriesLoading,
  onEngineChange,
  onGroupChange,
  onQueryChange,
}: QuerySelectorColumnProps) {
  const queries = side.groupId ? (queriesByGroup[side.groupId] ?? []) : [];
  return (
    <div className="min-w-0 border border-border bg-card">
      <div className="border-b border-border px-3 py-1.5">
        <h2 className="text-xs font-semibold">{label}</h2>
      </div>
      <div className="grid gap-2 p-2 sm:grid-cols-3">
        <div className="min-w-0">
          <label
            htmlFor={`${label}-engine`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Engine
          </label>
          <Select value={side.engineId} onValueChange={onEngineChange}>
            <SelectTrigger id={`${label}-engine`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Engine" />
            </SelectTrigger>
            <SelectContent>
              {engines.length === 0 ? (
                <SelectItem
                  value={`${label}-no-engines`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No engines
                </SelectItem>
              ) : (
                engines.map(engine => (
                  <SelectItem
                    key={engine.id}
                    value={engine.id}
                    className={COMPACT_SELECT_ITEM_CLASS}
                  >
                    <DataText>{engineLabel(engine)}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${label}-group`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Query Group
          </label>
          <Select
            value={side.groupId}
            onValueChange={onGroupChange}
            disabled={!side.engineId || queriesLoading}
          >
            <SelectTrigger id={`${label}-group`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Query Group" />
            </SelectTrigger>
            <SelectContent>
              {queryGroups.length === 0 ? (
                <SelectItem
                  value={`${label}-no-groups`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No query groups
                </SelectItem>
              ) : (
                queryGroups.map(group => (
                  <SelectItem key={group.id} value={group.id} className={COMPACT_SELECT_ITEM_CLASS}>
                    <DataText>{group.instance_name ?? group.id}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0">
          <label
            htmlFor={`${label}-query`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Query
          </label>
          <Select
            value={side.queryId}
            onValueChange={onQueryChange}
            disabled={queriesLoading || !side.groupId}
          >
            <SelectTrigger id={`${label}-query`} className={COMPACT_SELECT_TRIGGER_CLASS}>
              <SelectValue placeholder="Select Query" />
            </SelectTrigger>
            <SelectContent>
              {queries.length === 0 ? (
                <SelectItem
                  value={`${label}-no-queries`}
                  disabled
                  className={COMPACT_SELECT_ITEM_CLASS}
                >
                  No queries
                </SelectItem>
              ) : (
                queries.map(query => (
                  <SelectItem key={query.id} value={query.id} className={COMPACT_SELECT_ITEM_CLASS}>
                    <DataText>{queryLabel(query)}</DataText>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

export function DiffSelectionPage({
  initialQueryAEngineId = '',
  initialQueryBEngineId = '',
  initialQueryAId = '',
  initialQueryBId = '',
}: DiffSelectionPageProps) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? 'dark' : 'light';
  const [queryA, setQueryA] = useState<QuerySideState>({
    engineId: initialQueryAEngineId,
    groupId: '',
    queryId: initialQueryAId,
  });
  const [queryB, setQueryB] = useState<QuerySideState>({
    engineId: initialQueryBEngineId,
    groupId: '',
    queryId: initialQueryBId,
  });
  const [selectionOpen, setSelectionOpen] = useState(() =>
    getInitialSelectionOpen(
      initialQueryAEngineId,
      initialQueryBEngineId,
      initialQueryAId,
      initialQueryBId
    )
  );

  useEffect(() => {
    setQueryA(prev =>
      prev.engineId === initialQueryAEngineId && prev.queryId === initialQueryAId
        ? prev
        : { engineId: initialQueryAEngineId, groupId: '', queryId: initialQueryAId }
    );
    setQueryB(prev =>
      prev.engineId === initialQueryBEngineId && prev.queryId === initialQueryBId
        ? prev
        : { engineId: initialQueryBEngineId, groupId: '', queryId: initialQueryBId }
    );
  }, [initialQueryAEngineId, initialQueryAId, initialQueryBEngineId, initialQueryBId]);

  const { data: engines = [] } = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });

  const queryACatalog = useQueryCatalog(queryA.engineId);
  const queryBCatalog = useQueryCatalog(queryB.engineId);

  useEffect(() => {
    setQueryA(prev => {
      if (prev.groupId || !prev.queryId) return prev;
      const groupId = findGroupForQuery(prev.queryId, queryACatalog.queriesByGroup);
      return groupId ? { ...prev, groupId } : prev;
    });
  }, [queryACatalog.queriesByGroup, queryA.groupId, queryA.queryId]);

  useEffect(() => {
    setQueryB(prev => {
      if (prev.groupId || !prev.queryId) return prev;
      const groupId = findGroupForQuery(prev.queryId, queryBCatalog.queriesByGroup);
      return groupId ? { ...prev, groupId } : prev;
    });
  }, [queryBCatalog.queriesByGroup, queryB.groupId, queryB.queryId]);

  const queryAEngineSummary = useMemo(
    () => engineDisplayLabel(queryA.engineId, engines, 'Select Engine'),
    [engines, queryA.engineId]
  );
  const queryBEngineSummary = useMemo(
    () => engineDisplayLabel(queryB.engineId, engines, 'Select Engine'),
    [engines, queryB.engineId]
  );
  const queryASummary = useMemo(
    () => queryDisplayLabel(queryA.queryId, queryACatalog.queriesByGroup, 'Select Query A'),
    [queryA.queryId, queryACatalog.queriesByGroup]
  );
  const queryBSummary = useMemo(
    () => queryDisplayLabel(queryB.queryId, queryBCatalog.queriesByGroup, 'Select Query B'),
    [queryB.queryId, queryBCatalog.queriesByGroup]
  );
  const queryColors = useMemo(
    () =>
      getQueryDiffQueryColors({
        queryAId: queryA.queryId,
        queryBId: queryB.queryId,
        theme: paletteTheme,
      }),
    [paletteTheme, queryA.queryId, queryB.queryId]
  );
  const canSwapQueries = Boolean(
    queryA.engineId ||
    queryA.groupId ||
    queryA.queryId ||
    queryB.engineId ||
    queryB.groupId ||
    queryB.queryId
  );
  const sameQuerySelected = Boolean(
    queryA.engineId &&
    queryA.engineId === queryB.engineId &&
    queryA.queryId &&
    queryA.queryId === queryB.queryId
  );
  const canDiff = Boolean(
    queryA.engineId && queryA.queryId && queryB.engineId && queryB.queryId && !sameQuerySelected
  );

  const queryABundle = useQuery({
    ...queryBundleQueryOptions({ engineId: queryA.engineId, queryId: queryA.queryId }),
    enabled: canDiff,
  });
  const queryBBundle = useQuery({
    ...queryBundleQueryOptions({ engineId: queryB.engineId, queryId: queryB.queryId }),
    enabled: canDiff,
  });
  const diff = useMemo(
    () =>
      queryABundle.data && queryBBundle.data
        ? buildQueryProfileDiffFromBundles(queryABundle.data, queryBBundle.data)
        : null,
    [queryABundle.data, queryBBundle.data]
  );
  const diffLoading = canDiff && (queryABundle.isLoading || queryBBundle.isLoading);
  const diffError = queryABundle.error ?? queryBBundle.error;

  const maybeNavigateToDiff = (nextA: QuerySideState, nextB: QuerySideState) => {
    if (
      !nextA.engineId ||
      !nextB.engineId ||
      !nextA.queryId ||
      !nextB.queryId ||
      (nextA.engineId === nextB.engineId && nextA.queryId === nextB.queryId)
    ) {
      return;
    }
    pendingSelectionOpenAfterNavigation = selectionOpen;
    navigate({
      to: '/diff/engine/$queryAEngineId/query/$queryAId/compare/engine/$queryBEngineId/query/$queryBId',
      params: {
        queryAEngineId: nextA.engineId,
        queryAId: nextA.queryId,
        queryBEngineId: nextB.engineId,
        queryBId: nextB.queryId,
      },
    });
  };

  const handleEngineChange = (side: 'a' | 'b', engineId: string) => {
    setSelectionOpen(true);
    if (side === 'a') {
      setQueryA({ engineId, groupId: '', queryId: '' });
    } else {
      setQueryB({ engineId, groupId: '', queryId: '' });
    }
  };

  const handleGroupChange = (side: 'a' | 'b', groupId: string) => {
    setSelectionOpen(true);
    if (side === 'a') {
      setQueryA(prev => ({ ...prev, groupId, queryId: '' }));
    } else {
      setQueryB(prev => ({ ...prev, groupId, queryId: '' }));
    }
  };

  const handleQueryChange = (side: 'a' | 'b', queryId: string) => {
    if (side === 'a') {
      const nextA = { ...queryA, queryId };
      setQueryA(nextA);
      maybeNavigateToDiff(nextA, queryB);
    } else {
      const nextB = { ...queryB, queryId };
      setQueryB(nextB);
      maybeNavigateToDiff(queryA, nextB);
    }
  };

  const handleSwapQueries = () => {
    const nextA = queryB;
    const nextB = queryA;
    setQueryA(nextA);
    setQueryB(nextB);
    maybeNavigateToDiff(nextA, nextB);
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Collapsible
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        className="shrink-0 border-b border-border bg-card"
      >
        <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-2">
          <CollapsibleTrigger className="group flex max-w-full items-center justify-center gap-2 rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent/50">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">Query Diff</span>
            <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
              <DataText
                className="inline-block max-w-[18rem] truncate align-bottom"
                style={{ color: queryA.queryId ? queryColors.queryA : undefined }}
              >
                {queryA.engineId ? `${queryAEngineSummary} / ${queryASummary}` : queryASummary}
              </DataText>
              <span className="text-muted-foreground">vs</span>
              <DataText
                className="inline-block max-w-[18rem] truncate align-bottom"
                style={{ color: queryB.queryId ? queryColors.queryB : undefined }}
              >
                {queryB.engineId ? `${queryBEngineSummary} / ${queryBSummary}` : queryBSummary}
              </DataText>
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-300 ease-out group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent className="overflow-hidden will-change-[height,opacity,transform] data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="mx-auto w-full max-w-5xl px-4 pb-3">
            <div className="mx-auto grid w-full max-w-4xl items-stretch gap-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
              <QuerySelectorColumn
                label="Query A"
                side={queryA}
                engines={engines}
                queryGroups={queryACatalog.queryGroups}
                queriesByGroup={queryACatalog.queriesByGroup}
                queriesLoading={queryACatalog.queriesLoading}
                onEngineChange={engineId => handleEngineChange('a', engineId)}
                onGroupChange={groupId => handleGroupChange('a', groupId)}
                onQueryChange={queryId => handleQueryChange('a', queryId)}
              />
              <div className="flex items-center justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label="Swap Query A and Query B"
                  title="Swap Query A and Query B"
                  disabled={!canSwapQueries}
                  onClick={handleSwapQueries}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </Button>
              </div>
              <QuerySelectorColumn
                label="Query B"
                side={queryB}
                engines={engines}
                queryGroups={queryBCatalog.queryGroups}
                queriesByGroup={queryBCatalog.queriesByGroup}
                queriesLoading={queryBCatalog.queriesLoading}
                onEngineChange={engineId => handleEngineChange('b', engineId)}
                onGroupChange={groupId => handleGroupChange('b', groupId)}
                onQueryChange={queryId => handleQueryChange('b', queryId)}
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="min-h-0 flex-1 px-4 pb-4">
        <div
          className={cn(
            'h-full overflow-hidden border border-border bg-background',
            !canDiff && 'flex items-center justify-center'
          )}
        >
          {!queryA.engineId || !queryB.engineId ? (
            <div className="text-sm text-muted-foreground">
              Select engines for Query A and Query B.
            </div>
          ) : sameQuerySelected ? (
            <div className="text-sm text-destructive">Choose two different queries.</div>
          ) : !canDiff ? (
            <div className="text-sm text-muted-foreground">Select Query A and Query B.</div>
          ) : diffLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : diffError ? (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              Failed to load diff
            </div>
          ) : diff && queryABundle.data && queryBBundle.data ? (
            <div className="flex h-full min-h-0 flex-col">
              <QueryDiffStats
                diff={diff}
                queryABundle={queryABundle.data}
                queryBBundle={queryBBundle.data}
              />
              <QueryDiffTimeline
                queryAEngineId={queryA.engineId}
                queryBEngineId={queryB.engineId}
                diff={diff}
                queryABundle={queryABundle.data}
                queryBBundle={queryBBundle.data}
              />
              <div className="min-h-0 flex-1">
                <QueryDiffTable diff={diff} />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

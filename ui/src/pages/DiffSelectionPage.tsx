// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import {
  fetchListCoordinators,
  fetchListEngines,
  fetchListQueries,
  useQueryProfileDiff,
} from '@quent/client';
import type { Query, QueryGroup } from '@quent/utils';
import {
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

interface DiffSelectionPageProps {
  initialEngineId?: string;
  initialQueryAId?: string;
  initialQueryBId?: string;
}

interface QuerySideState {
  groupId: string;
  queryId: string;
}

interface QuerySelectorColumnProps {
  label: string;
  side: QuerySideState;
  queryGroups: QueryGroup[];
  queriesByGroup: Record<string, Query[]>;
  disabled: boolean;
  onGroupChange: (groupId: string) => void;
  onQueryChange: (queryId: string) => void;
}

const COMPACT_SELECT_TRIGGER_CLASS =
  'h-7 min-w-0 rounded px-2 py-1 text-xs [&_svg]:h-3 [&_svg]:w-3';
const COMPACT_SELECT_ITEM_CLASS = 'py-1 pl-7 pr-2 text-xs';

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

function QuerySelectorColumn({
  label,
  side,
  queryGroups,
  queriesByGroup,
  disabled,
  onGroupChange,
  onQueryChange,
}: QuerySelectorColumnProps) {
  const queries = side.groupId ? (queriesByGroup[side.groupId] ?? []) : [];
  return (
    <div className="min-w-0 border border-border bg-card">
      <div className="border-b border-border px-3 py-1.5">
        <h2 className="text-xs font-semibold">{label}</h2>
      </div>
      <div className="grid gap-2 p-2 sm:grid-cols-2">
        <div className="min-w-0">
          <label
            htmlFor={`${label}-group`}
            className="mb-1 block text-[11px] font-medium leading-none text-muted-foreground"
          >
            Query Group
          </label>
          <Select value={side.groupId} onValueChange={onGroupChange} disabled={disabled}>
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
            disabled={disabled || !side.groupId}
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
  initialEngineId = '',
  initialQueryAId = '',
  initialQueryBId = '',
}: DiffSelectionPageProps) {
  const navigate = useNavigate();
  const [engineId, setEngineId] = useState(initialEngineId);
  const [queryA, setQueryA] = useState<QuerySideState>({ groupId: '', queryId: initialQueryAId });
  const [queryB, setQueryB] = useState<QuerySideState>({ groupId: '', queryId: initialQueryBId });
  const [selectionOpen, setSelectionOpen] = useState(
    !(initialEngineId && initialQueryAId && initialQueryBId && initialQueryAId !== initialQueryBId)
  );

  useEffect(() => {
    setEngineId(initialEngineId);
    setQueryA({ groupId: '', queryId: initialQueryAId });
    setQueryB({ groupId: '', queryId: initialQueryBId });
    setSelectionOpen(
      !(
        initialEngineId &&
        initialQueryAId &&
        initialQueryBId &&
        initialQueryAId !== initialQueryBId
      )
    );
  }, [initialEngineId, initialQueryAId, initialQueryBId]);

  const { data: engines = [] } = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
  });

  const { data: queryGroups = [] } = useQuery({
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

  useEffect(() => {
    setQueryA(prev => {
      if (prev.groupId || !prev.queryId) return prev;
      const groupId = findGroupForQuery(prev.queryId, queriesByGroup);
      return groupId ? { ...prev, groupId } : prev;
    });
    setQueryB(prev => {
      if (prev.groupId || !prev.queryId) return prev;
      const groupId = findGroupForQuery(prev.queryId, queriesByGroup);
      return groupId ? { ...prev, groupId } : prev;
    });
  }, [queriesByGroup]);

  const selectedEngine = useMemo(
    () => engines.find(engine => engine.id === engineId),
    [engineId, engines]
  );
  const engineSummary = selectedEngine?.instance_name ?? selectedEngine?.id ?? engineId;
  const queryASummary = useMemo(
    () => queryDisplayLabel(queryA.queryId, queriesByGroup, 'Select Query A'),
    [queryA.queryId, queriesByGroup]
  );
  const queryBSummary = useMemo(
    () => queryDisplayLabel(queryB.queryId, queriesByGroup, 'Select Query B'),
    [queryB.queryId, queriesByGroup]
  );
  const sameQuerySelected = Boolean(queryA.queryId && queryA.queryId === queryB.queryId);
  const canDiff = Boolean(engineId && queryA.queryId && queryB.queryId && !sameQuerySelected);

  const diffQuery = useQueryProfileDiff({
    engineId,
    request: {
      query_a_id: queryA.queryId,
      query_b_id: sameQuerySelected ? '' : queryB.queryId,
    },
  });

  const maybeNavigateToDiff = (
    nextEngineId: string,
    nextA: QuerySideState,
    nextB: QuerySideState
  ) => {
    if (!nextEngineId || !nextA.queryId || !nextB.queryId || nextA.queryId === nextB.queryId) {
      return;
    }
    navigate({
      to: '/diff/engine/$engineId/query/$queryAId/compare/$queryBId',
      params: {
        engineId: nextEngineId,
        queryAId: nextA.queryId,
        queryBId: nextB.queryId,
      },
    });
  };

  const handleEngineChange = (nextEngineId: string) => {
    setEngineId(nextEngineId);
    setQueryA({ groupId: '', queryId: '' });
    setQueryB({ groupId: '', queryId: '' });
    setSelectionOpen(true);
    navigate({ to: '/diff' });
  };

  const handleGroupChange = (side: 'a' | 'b', groupId: string) => {
    setSelectionOpen(true);
    if (side === 'a') {
      setQueryA({ groupId, queryId: '' });
    } else {
      setQueryB({ groupId, queryId: '' });
    }
  };

  const handleQueryChange = (side: 'a' | 'b', queryId: string) => {
    if (side === 'a') {
      const nextA = { ...queryA, queryId };
      setQueryA(nextA);
      maybeNavigateToDiff(engineId, nextA, queryB);
    } else {
      const nextB = { ...queryB, queryId };
      setQueryB(nextB);
      maybeNavigateToDiff(engineId, queryA, nextB);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <Collapsible
        open={selectionOpen}
        onOpenChange={setSelectionOpen}
        className="shrink-0 border-b border-border bg-card"
      >
        <div className="mx-auto flex w-full max-w-6xl justify-center px-4 py-2">
          <CollapsibleTrigger className="group flex max-w-full items-center justify-center gap-2 rounded-sm px-2 py-1 text-left transition-colors hover:bg-accent hover:text-accent-foreground">
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">Query Diff</span>
            <span className="flex min-w-0 flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs">
              <DataText className="inline-block max-w-[16rem] truncate align-bottom">
                {queryASummary}
              </DataText>
              <span className="text-muted-foreground">vs</span>
              <DataText className="inline-block max-w-[16rem] truncate align-bottom">
                {queryBSummary}
              </DataText>
              {engineSummary && (
                <>
                  <span className="hidden text-muted-foreground sm:inline">on</span>
                  <DataText className="hidden max-w-[14rem] truncate align-bottom sm:inline-block">
                    {engineSummary}
                  </DataText>
                </>
              )}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="mx-auto w-full max-w-5xl px-4 pb-3">
            <div className="mb-2 flex justify-center">
              <div className="w-full max-w-xs">
                <label
                  htmlFor="diff-engine"
                  className="mb-1 block text-center text-[11px] font-medium leading-none text-muted-foreground"
                >
                  Engine
                </label>
                <Select value={engineId} onValueChange={handleEngineChange}>
                  <SelectTrigger id="diff-engine" className="h-8 px-2 text-xs">
                    <SelectValue placeholder="Select Engine" />
                  </SelectTrigger>
                  <SelectContent>
                    {engines.length === 0 ? (
                      <SelectItem value="no-engines" disabled className={COMPACT_SELECT_ITEM_CLASS}>
                        No engines
                      </SelectItem>
                    ) : (
                      engines.map(engine => (
                        <SelectItem
                          key={engine.id}
                          value={engine.id}
                          className={COMPACT_SELECT_ITEM_CLASS}
                        >
                          <DataText>{engine.instance_name ?? engine.id}</DataText>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mx-auto grid w-full max-w-4xl gap-2 lg:grid-cols-2">
              <QuerySelectorColumn
                label="Query A"
                side={queryA}
                queryGroups={queryGroups}
                queriesByGroup={queriesByGroup}
                disabled={!engineId || queriesLoading}
                onGroupChange={groupId => handleGroupChange('a', groupId)}
                onQueryChange={queryId => handleQueryChange('a', queryId)}
              />
              <QuerySelectorColumn
                label="Query B"
                side={queryB}
                queryGroups={queryGroups}
                queriesByGroup={queriesByGroup}
                disabled={!engineId || queriesLoading}
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
          {!engineId ? (
            <div className="text-sm text-muted-foreground">
              Select an engine to compare queries.
            </div>
          ) : sameQuerySelected ? (
            <div className="text-sm text-destructive">Choose two different queries.</div>
          ) : !canDiff ? (
            <div className="text-sm text-muted-foreground">Select Query A and Query B.</div>
          ) : diffQuery.isLoading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Loading diff...
            </div>
          ) : diffQuery.error ? (
            <div className="flex h-full items-center justify-center text-sm text-destructive">
              Failed to load diff
            </div>
          ) : diffQuery.data ? (
            <QueryDiffTable diff={diffQuery.data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

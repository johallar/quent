// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMatch, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@quent/components';
import { cn } from '@quent/utils';
import {
  queryBundleQueryOptions,
  fetchListEngines,
  fetchListCoordinators,
  fetchListQueries,
} from '@quent/client';
import { DataText } from '@quent/components';

function OverflowHoverCardContent({ label }: { label: string }) {
  return (
    <HoverCardContent
      side="right"
      align="start"
      className="w-auto max-w-sm bg-background p-2 text-foreground"
    >
      <DataText className="break-all text-xs">{label}</DataText>
    </HoverCardContent>
  );
}

function OverflowingItemLabel({ label }: { label: string }) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  const handleOpenChange = (nextOpen: boolean) => {
    const trigger = triggerRef.current;
    setOpen(nextOpen && !!trigger && trigger.scrollWidth > trigger.clientWidth);
  };

  return (
    <HoverCard open={open} onOpenChange={handleOpenChange}>
      <HoverCardTrigger asChild>
        <span ref={triggerRef} className="min-w-0 flex-1 truncate">
          <DataText>{label}</DataText>
        </span>
      </HoverCardTrigger>
      <OverflowHoverCardContent label={label} />
    </HoverCard>
  );
}

function BreadcrumbDropdown({
  label,
  activeId,
  items,
  onSelect,
}: {
  label: string;
  activeId: string;
  items: { id: string; label: string }[] | undefined;
  onSelect: (id: string) => void;
}) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [labelCardOpen, setLabelCardOpen] = useState(false);

  const handleLabelCardOpenChange = (nextOpen: boolean) => {
    const labelElement = labelRef.current;
    setLabelCardOpen(
      nextOpen && !!labelElement && labelElement.scrollWidth > labelElement.clientWidth
    );
  };

  return (
    <HoverCard open={labelCardOpen} onOpenChange={handleLabelCardOpenChange}>
      <DropdownMenu>
        <HoverCardTrigger asChild>
          <DropdownMenuTrigger asChild>
            <button className="-mx-1.5 flex min-w-0 max-w-40 cursor-pointer items-center gap-0.5 rounded-sm px-1.5 py-0.5 transition-colors hover:bg-accent hover:text-foreground md:max-w-48 xl:max-w-64">
              <span ref={labelRef} className="min-w-0 truncate">
                <DataText>{label}</DataText>
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
            </button>
          </DropdownMenuTrigger>
        </HoverCardTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-64 w-64 max-w-[calc(100vw-2rem)] overflow-y-auto"
        >
          {items?.map(item => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => onSelect(item.id)}
              className={cn('min-w-0', item.id === activeId && 'bg-accent font-semibold')}
            >
              <OverflowingItemLabel label={item.label} />
            </DropdownMenuItem>
          ))}
          {(!items || items.length === 0) && <DropdownMenuItem disabled>No items</DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>
      <OverflowHoverCardContent label={label} />
    </HoverCard>
  );
}

export function NavBarNavigator() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Match the layout route — satisfied by any child route (timeline, operators,
  // node/$nodeId, index, …) without needing a per-leaf match here.
  const queryLayoutMatch = useMatch({
    from: '/profile/engine/$engineId/query/$queryId',
    shouldThrow: false,
  });

  const engineId = queryLayoutMatch?.params?.engineId;
  const queryId = queryLayoutMatch?.params?.queryId;

  const { data: queryBundle } = useQuery({
    ...queryBundleQueryOptions({ engineId: engineId ?? '', queryId: queryId ?? '' }),
    enabled: !!engineId && !!queryId,
  });

  const queryGroupId = queryBundle?.entities.query_group.id;

  const { data: engines } = useQuery({
    queryKey: ['list_engines'],
    queryFn: fetchListEngines,
    enabled: !!engineId,
  });

  const { data: queryGroups } = useQuery({
    queryKey: ['list_coordinators', engineId],
    queryFn: () => fetchListCoordinators(engineId!),
    enabled: !!engineId,
  });

  const { data: queries } = useQuery({
    queryKey: ['list_queries', engineId, queryGroupId],
    queryFn: () => fetchListQueries(engineId!, queryGroupId!),
    enabled: !!engineId && !!queryGroupId,
  });

  if (!queryBundle || !engineId) return null;

  const engine = queryBundle.entities.engine.instance_name ?? queryBundle.entities.engine.id;
  const queryGroupName = queryBundle.entities.query_group.instance_name;

  const handleEngineChange = async (newEngineId: string) => {
    if (newEngineId === engineId) return;
    try {
      const groups = await queryClient.fetchQuery({
        queryKey: ['list_coordinators', newEngineId],
        queryFn: () => fetchListCoordinators(newEngineId),
      });
      const firstGroup = groups[0];
      if (!firstGroup) return;
      const groupQueries = await queryClient.fetchQuery({
        queryKey: ['list_queries', newEngineId, firstGroup.id],
        queryFn: () => fetchListQueries(newEngineId, firstGroup.id),
      });
      const firstQuery = groupQueries[0];
      if (firstQuery) {
        navigate({
          to: '/profile/engine/$engineId/query/$queryId',
          params: { engineId: newEngineId, queryId: firstQuery.id },
          search: {},
        });
      }
    } catch {
      // ignore
    }
  };

  const handleQueryGroupChange = async (newGroupId: string) => {
    if (newGroupId === queryGroupId) return;
    try {
      const groupQueries = await queryClient.fetchQuery({
        queryKey: ['list_queries', engineId, newGroupId],
        queryFn: () => fetchListQueries(engineId!, newGroupId),
      });
      const firstQuery = groupQueries[0];
      if (firstQuery) {
        navigate({
          to: '/profile/engine/$engineId/query/$queryId',
          params: { engineId: engineId!, queryId: firstQuery.id },
          search: {},
        });
      }
    } catch {
      // ignore
    }
  };

  const handleQueryChange = (newQueryId: string) => {
    if (newQueryId === queryId) return;
    navigate({
      to: '/profile/engine/$engineId/query/$queryId',
      params: { engineId, queryId: newQueryId },
      search: {},
    });
  };

  return (
    <nav className="flex min-w-0 max-w-full items-center gap-1.5 text-sm text-muted-foreground">
      <BreadcrumbDropdown
        label={engine}
        activeId={engineId}
        items={engines?.map(e => ({ id: e.id, label: e.instance_name ?? e.id }))}
        onSelect={handleEngineChange}
      />
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      <BreadcrumbDropdown
        label={queryGroupName ?? queryGroupId ?? ''}
        activeId={queryGroupId ?? ''}
        items={queryGroups?.map(g => ({ id: g.id, label: g.instance_name ?? g.id }))}
        onSelect={handleQueryGroupChange}
      />
      <ChevronRight className="h-3.5 w-3.5 shrink-0" />
      <BreadcrumbDropdown
        label={
          'SELECT * FROM THINGS WHERE FIELD1 < 100 AND FIELD2 > 100 GROUP BY OTHER_THING ORDER BY FIELD3 DESC LIMIT 100;'
        }
        activeId={queryId ?? ''}
        items={queries?.map(q => ({
          id: q.id,
          label:
            'SELECT * FROM THINGS WHERE FIELD1 < 100 AND FIELD2 > 100 GROUP BY OTHER_THING ORDER BY FIELD3 DESC LIMIT 100;',
        }))}
        onSelect={handleQueryChange}
      />
    </nav>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useMemo, useState } from 'react';
import { useEntityList } from '@quent/client';
import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  thinScrollbarClass,
} from '@quent/components';
import { useDebouncedZoomRange, useSelectedNodeIds } from '@quent/hooks';
import { formatDuration } from '@quent/utils';
import type { EntityRef, FiniteStateMachine, QueryBundle } from '@quent/utils';

const ALL_ENTITY_TYPES = '__all_entity_types__';
const MAX_ENTITIES = 200;

function getEntityBounds(entity: FiniteStateMachine) {
  const first = entity.transitions[0]?.timestamp ?? 0;
  const last = entity.transitions[entity.transitions.length - 1]?.timestamp ?? first;
  return { first, last };
}

type RelatedEntitiesTableProps = {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
  focusedResourceId: string | null;
};

export function RelatedEntitiesTable({
  engineId,
  queryBundle,
  focusedResourceId,
}: RelatedEntitiesTableProps) {
  const [entityType, setEntityType] = useState<string | null>(null);
  const zoomRange = useDebouncedZoomRange();
  const selectedNodeIds = useSelectedNodeIds();
  const operatorId = selectedNodeIds.size === 1 ? [...selectedNodeIds][0]! : null;
  const resourceTypeName = focusedResourceId
    ? queryBundle.entities.resources[focusedResourceId]?.type_name
    : undefined;
  const entityTypes = useMemo(
    () =>
      resourceTypeName
        ? [...(queryBundle.entities.resource_types[resourceTypeName]?.used_by ?? [])].sort()
        : [],
    [queryBundle.entities.resource_types, resourceTypeName]
  );

  useEffect(() => {
    if (entityType && !entityTypes.includes(entityType)) setEntityType(null);
  }, [entityType, entityTypes]);

  const { data, isFetching, error } = useEntityList(
    {
      engineId,
      queryId: queryBundle.query_id,
      window: zoomRange,
      operatorId,
      filter: {
        scope: focusedResourceId ? { Resource: { resource_id: focusedResourceId } } : null,
        entityTypeName: entityType,
      },
      minUsageSeconds: 0,
      sortDir: 'Desc',
      maxItems: MAX_ENTITIES,
    },
    { enabled: focusedResourceId != null }
  );

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {focusedResourceId ?? 'No resource selected'}
          </div>
          <div className="text-xs text-muted-foreground">
            {data ? `${data.total} related entities` : 'Entities in the visible time window'}
          </div>
        </div>
        <Select
          value={entityType ?? ALL_ENTITY_TYPES}
          onValueChange={value => setEntityType(value === ALL_ENTITY_TYPES ? null : value)}
          disabled={entityTypes.length === 0}
        >
          <SelectTrigger className="h-8 w-40" aria-label="Filter entities by type">
            <SelectValue placeholder="All entity types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ENTITY_TYPES}>All entity types</SelectItem>
            {entityTypes.map(type => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className={`min-h-0 flex-1 overflow-auto ${thinScrollbarClass}`}>
        {!focusedResourceId ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            Select a leaf resource to inspect its entities
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-destructive">
            Failed to load related entities
          </div>
        ) : !data && isFetching ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} className="h-9 w-full" />
            ))}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
            No entities use this resource in the visible time window
          </div>
        ) : (
          <Table containerClassName="">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Entity</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Start</TableHead>
                <TableHead className="text-right">End</TableHead>
                <TableHead className="text-right">Span</TableHead>
                <TableHead className="text-right">States</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.items.map(entity => {
                const { first, last } = getEntityBounds(entity);
                return (
                  <TableRow key={entity.id}>
                    <TableCell className="max-w-52 truncate font-mono text-data">
                      {entity.instance_name || entity.id}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{entity.type_name}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-data">
                      {formatDuration(first * 1000)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-data">
                      {formatDuration(last * 1000)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-data">
                      {formatDuration(Math.max(0, last - first) * 1000)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-data">
                      {Math.max(0, entity.transitions.length - 1)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

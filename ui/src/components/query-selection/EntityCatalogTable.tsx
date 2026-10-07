// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, RotateCcw, Search } from 'lucide-react';
import {
  Button,
  DataText,
  Input,
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
} from '@quent/components';
import { formatAttributeValue } from '@quent/utils';
import {
  attributeLabel,
  attributeValue,
  catalogAttributeKeys,
  filterCatalogItems,
  groupCatalogItems,
  type CatalogEntity,
} from './catalog';

const NO_GROUPING = '__none__';

export interface CatalogMetadataColumn<T> {
  id: string;
  label: string;
  render: (item: T) => ReactNode;
}

export interface EntityCatalogTableProps<T extends CatalogEntity> {
  title: string;
  description: string;
  items: T[];
  initialGroupBy: string | null;
  metadataColumns?: CatalogMetadataColumn<T>[];
  isLoading: boolean;
  error: Error | null;
  emptyMessage: string;
  actionLabel: string;
  onRetry: () => void;
  onSelect: (item: T) => void;
}

export function EntityCatalogTable<T extends CatalogEntity>({
  title,
  description,
  items,
  initialGroupBy,
  metadataColumns = [],
  isLoading,
  error,
  emptyMessage,
  actionLabel,
  onRetry,
  onSelect,
}: EntityCatalogTableProps<T>) {
  const [search, setSearch] = useState('');
  const [groupByOverride, setGroupByOverride] = useState<string>();
  const attributeKeys = useMemo(() => catalogAttributeKeys(items), [items]);
  const hintedGroupBy =
    initialGroupBy && attributeKeys.includes(initialGroupBy) ? initialGroupBy : '';
  const groupBy = groupByOverride ?? hintedGroupBy;
  const filteredItems = useMemo(() => filterCatalogItems(items, search), [items, search]);
  const groups = useMemo(() => groupCatalogItems(filteredItems, groupBy), [filteredItems, groupBy]);
  const columnCount = 3 + metadataColumns.length + attributeKeys.length;
  const catalogName = title.replace(/^Select (?:an?|the) /i, '');

  return (
    <section aria-labelledby="catalog-title" className="flex min-h-0 flex-col gap-4">
      <div>
        <h1 id="catalog-title" className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground text-pretty">{description}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder={`Search ${catalogName}…`}
            aria-label={`Search ${catalogName}`}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="catalog-group-by" className="text-sm text-muted-foreground">
            Group by
          </label>
          <Select
            value={groupBy || NO_GROUPING}
            onValueChange={value => setGroupByOverride(value === NO_GROUPING ? '' : value)}
          >
            <SelectTrigger id="catalog-group-by" className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_GROUPING}>None</SelectItem>
              {attributeKeys.map(key => (
                <SelectItem key={key} value={key}>
                  {attributeLabel(key)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="min-h-0 overflow-hidden rounded-md border border-border bg-card">
        {isLoading ? (
          <CatalogLoading />
        ) : error ? (
          <CatalogError error={error} onRetry={onRetry} />
        ) : items.length === 0 ? (
          <CatalogMessage>{emptyMessage}</CatalogMessage>
        ) : filteredItems.length === 0 ? (
          <CatalogMessage>No matches for “{search}”.</CatalogMessage>
        ) : (
          <Table containerClassName="max-h-[min(62vh,42rem)] overflow-auto">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead className="sticky left-0 z-20 min-w-48 border-r border-border bg-card">
                  Name
                </TableHead>
                <TableHead>ID</TableHead>
                {metadataColumns.map(column => (
                  <TableHead key={column.id}>{column.label}</TableHead>
                ))}
                {attributeKeys.map(key => (
                  <TableHead key={key}>{attributeLabel(key)}</TableHead>
                ))}
                <TableHead className="sticky right-0 z-20 min-w-32 border-l border-border bg-card text-right">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.flatMap(group => [
                ...(groupBy
                  ? [
                      <TableRow key={`group-${group.id}`} className="hover:bg-muted/30">
                        <TableCell
                          colSpan={columnCount}
                          className="bg-muted/30 py-2 text-xs font-semibold text-muted-foreground"
                        >
                          {attributeLabel(groupBy)}: {group.label}
                          <span className="ml-2 font-normal tabular-nums">
                            ({group.items.length})
                          </span>
                        </TableCell>
                      </TableRow>,
                    ]
                  : []),
                ...group.items.map(item => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="sticky left-0 z-10 min-w-48 max-w-64 border-r border-border bg-card font-medium transition-colors group-hover:bg-muted/50">
                      <DataText className="block truncate">
                        {item.instance_name ?? 'Unnamed'}
                      </DataText>
                    </TableCell>
                    <TableCell className="max-w-64 text-muted-foreground">
                      <DataText className="block truncate">{item.id}</DataText>
                    </TableCell>
                    {metadataColumns.map(column => (
                      <TableCell key={column.id}>{column.render(item)}</TableCell>
                    ))}
                    {attributeKeys.map(key => (
                      <TableCell key={key} className="max-w-64">
                        <DataText className="block truncate">
                          {formatAttributeValue(key, attributeValue(item.custom_attributes, key))}
                        </DataText>
                      </TableCell>
                    ))}
                    <TableCell className="sticky right-0 z-10 min-w-32 border-l border-border bg-card text-right transition-colors group-hover:bg-muted/50">
                      <Button size="xs" onClick={() => onSelect(item)}>
                        {actionLabel}
                        <ArrowRight />
                      </Button>
                    </TableCell>
                  </TableRow>
                )),
              ])}
            </TableBody>
          </Table>
        )}
      </div>
    </section>
  );
}

function CatalogLoading() {
  return (
    <div aria-label="Loading catalog" className="space-y-3 p-4">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

function CatalogError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div role="alert" className="flex min-h-48 flex-col items-center justify-center gap-3 p-6">
      <div className="text-center">
        <p className="font-medium">Unable to load this catalog</p>
        <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RotateCcw />
        Retry
      </Button>
    </div>
  );
}

function CatalogMessage({ children }: { children: ReactNode }) {
  return (
    <p className="flex min-h-48 items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

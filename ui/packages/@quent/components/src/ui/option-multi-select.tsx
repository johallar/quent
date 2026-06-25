// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type ReactNode } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { cn } from '@quent/utils';
import { useColumnDragDrop } from '@quent/hooks';
import { Badge } from './badge';
import { Button } from './button';
import { Input } from './input';
import { Popover, PopoverContent, PopoverTrigger } from './popover';

export interface OptionMultiSelectItem {
  id: string;
  label: ReactNode;
  /** Optional override rendered inside the selected-badge. Defaults to `label`. */
  badgeLabel?: ReactNode;
  /** Optional override used for popover search filtering. Defaults to `id`. */
  searchText?: string;
}

export interface OptionMultiSelectProps {
  label: string;
  triggerText: string;
  /** Mixed-shape input: strings become `{ id, label: <mono>id</mono> }` items. */
  options: ReadonlyArray<string | OptionMultiSelectItem>;
  selectedOptionIds: Set<string> | null;
  onToggleOption: (optionId: string) => void;
  onSelectAllOptions: () => void;
  onSelectNoOptions: () => void;
  /** When provided, selected badges become drag-reorderable. */
  onReorderOption?: (
    fromOptionId: string,
    toOptionId: string,
    position: 'before' | 'after'
  ) => void;
  searchPlaceholder?: string;
  emptyMessage?: string;
  noneSelectedText?: string;
  maxVisibleBadges?: number;
  showSelectedBadges?: boolean;
  /** Overrides the default outer wrapper classes. */
  wrapperClassName?: string;
  /** Trailing slot rendered inside the wrapper (e.g. an Aggregate select). */
  trailing?: ReactNode;
}

const DEFAULT_WRAPPER_CLASS = 'flex items-center gap-1 px-3 py-1.5 border-t border-border/50';

function normalizeOption(opt: string | OptionMultiSelectItem): OptionMultiSelectItem {
  if (typeof opt !== 'string') return opt;
  const mono = <span className="font-mono">{opt}</span>;
  return { id: opt, label: mono, badgeLabel: mono, searchText: opt };
}

function getSearchText(item: OptionMultiSelectItem): string {
  return (item.searchText ?? item.id).toLowerCase();
}

export function OptionMultiSelect({
  label,
  triggerText,
  options,
  selectedOptionIds,
  onToggleOption,
  onSelectAllOptions,
  onSelectNoOptions,
  onReorderOption,
  searchPlaceholder = 'Search options…',
  emptyMessage = 'No options found',
  noneSelectedText = 'None selected',
  maxVisibleBadges = 6,
  showSelectedBadges = true,
  wrapperClassName,
  trailing,
}: OptionMultiSelectProps) {
  const [search, setSearch] = useState('');

  const items = useMemo(() => options.map(normalizeOption), [options]);

  const isSelected = (id: string): boolean =>
    selectedOptionIds ? selectedOptionIds.has(id) : true;

  const selectedItems = useMemo(
    () => items.filter(item => (selectedOptionIds ? selectedOptionIds.has(item.id) : true)),
    [items, selectedOptionIds]
  );
  const visibleSelectedItems = selectedItems.slice(0, maxVisibleBadges);
  const hiddenSelectedCount = Math.max(0, selectedItems.length - visibleSelectedItems.length);

  const filteredItems = useMemo(() => {
    if (!search) return items;
    const needle = search.toLowerCase();
    return items.filter(item => getSearchText(item).includes(needle));
  }, [items, search]);

  const dragDrop = useColumnDragDrop({
    onDropCommit: (fromId, toId, position) => onReorderOption?.(fromId, toId, position),
  });
  const reorderable = Boolean(onReorderOption);

  return (
    <div className={cn(wrapperClassName ?? DEFAULT_WRAPPER_CLASS)}>
      <span className="text-xs text-muted-foreground shrink-0 mr-1">{label}:</span>
      <Popover
        onOpenChange={open => {
          if (!open) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            className="h-7 min-w-36 justify-between gap-2 px-2 text-xs font-normal"
          >
            <span className="truncate">
              {selectedItems.length > 0 ? `${triggerText} (${selectedItems.length})` : triggerText}
            </span>
            <ChevronDown className="text-muted-foreground shrink-0 opacity-70" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start" side="bottom">
          <div className="relative mb-2">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              className="h-7 pl-7 pr-2 text-xs md:text-xs"
              placeholder={searchPlaceholder}
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-1 mb-2 border-b border-border pb-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSelectAllOptions}
              className="h-6 px-2 text-xs text-primary hover:text-primary"
            >
              All
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSelectNoOptions}
              className="h-6 px-2 text-xs text-primary hover:text-primary"
            >
              None
            </Button>
          </div>
          <div role="listbox" aria-multiselectable className="max-h-52 overflow-y-auto space-y-0.5">
            {filteredItems.map(item => {
              const checked = isSelected(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  data-state={checked ? 'checked' : 'unchecked'}
                  onClick={() => onToggleOption(item.id)}
                  className={cn(
                    'relative flex w-full cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1 text-xs outline-none',
                    'transition-colors hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:bg-accent focus-visible:text-accent-foreground'
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'flex size-3.5 shrink-0 items-center justify-center rounded-sm border transition-colors',
                      checked
                        ? 'bg-primary border-primary text-primary-foreground'
                        : 'border-input bg-background'
                    )}
                  >
                    {checked && <Check className="size-2.5" strokeWidth={3} />}
                  </span>
                  <span className="truncate text-left">{item.label}</span>
                </button>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">{emptyMessage}</p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {showSelectedBadges && (
        <div className="flex-1 min-w-0">
          {selectedItems.length === 0 ? (
            <span className="text-xs text-muted-foreground italic">{noneSelectedText}</span>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              {visibleSelectedItems.map(item => {
                const dropPosition = reorderable
                  ? dragDrop.getDropTargetPosition(item.id)
                  : undefined;
                const dropIndicatorStyle = dropPosition
                  ? {
                      boxShadow:
                        dropPosition === 'before'
                          ? 'inset 3px 0 0 hsl(var(--primary))'
                          : 'inset -3px 0 0 hsl(var(--primary))',
                    }
                  : undefined;
                return (
                  <Badge
                    key={item.id}
                    variant="outline"
                    draggable={reorderable || undefined}
                    onDragStart={
                      reorderable ? e => dragDrop.handleDragStart(e, item.id) : undefined
                    }
                    onDragOver={reorderable ? e => dragDrop.handleDragOver(e, item.id) : undefined}
                    onDragLeave={
                      reorderable ? e => dragDrop.handleDragLeave(e, item.id) : undefined
                    }
                    onDrop={reorderable ? e => dragDrop.handleDrop(e, item.id) : undefined}
                    onDragEnd={reorderable ? dragDrop.handleDragEnd : undefined}
                    style={dropIndicatorStyle}
                    className={cn(
                      'px-1.5 py-0 text-data bg-primary/10 border-primary/40 hover:bg-primary/15',
                      reorderable && 'cursor-grab active:cursor-grabbing select-none',
                      reorderable && dragDrop.draggedId === item.id && 'opacity-45'
                    )}
                  >
                    <span className="truncate">{item.badgeLabel ?? item.label}</span>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        onToggleOption(item.id);
                      }}
                      aria-label={`Remove ${item.id}`}
                      className="ml-0.5 rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer"
                    >
                      <X className="size-2.5" />
                    </button>
                  </Badge>
                );
              })}
              {hiddenSelectedCount > 0 && (
                <Badge variant="outline" className="px-1.5 py-0 bg-muted/40 text-muted-foreground">
                  +{hiddenSelectedCount} more
                </Badge>
              )}
            </div>
          )}
        </div>
      )}
      {trailing}
    </div>
  );
}

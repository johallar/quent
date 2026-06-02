// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import {
  Button,
  DataText,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@quent/components';
import { cn } from '@quent/utils';
import type { QueryPickerOption } from './useAllQueriesIndex';

export interface QueryPickerProps {
  mode: 'single' | 'multi';
  options: QueryPickerOption[];
  loading?: boolean;
  selectedQueryIds: readonly string[];
  disabledQueryIds?: readonly string[];
  triggerPlaceholder: string;
  triggerOverride?: React.ReactNode;
  ariaLabel: string;
  id?: string;
  onChange: (queryIds: string[]) => void;
  emptyMessage?: string;
}

export function QueryPicker({
  mode,
  options,
  loading = false,
  selectedQueryIds,
  disabledQueryIds = [],
  triggerPlaceholder,
  triggerOverride,
  ariaLabel,
  id,
  onChange,
  emptyMessage = 'No queries match',
}: QueryPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const disabledSet = useMemo(() => new Set(disabledQueryIds), [disabledQueryIds]);
  const selectedSet = useMemo(() => new Set(selectedQueryIds), [selectedQueryIds]);

  const filteredOptions = useMemo(() => {
    if (!search) return options;
    const needle = search.toLowerCase();
    return options.filter(opt => opt.searchText.includes(needle));
  }, [options, search]);

  const handleSelect = (queryId: string) => {
    if (mode === 'single') {
      onChange([queryId]);
      setOpen(false);
      return;
    }
    if (selectedSet.has(queryId)) {
      onChange(selectedQueryIds.filter(id => id !== queryId));
    } else {
      onChange([...selectedQueryIds, queryId]);
    }
  };

  const selectedSingle = useMemo(
    () =>
      mode === 'single'
        ? (options.find(opt => opt.queryId === selectedQueryIds[0]) ?? null)
        : null,
    [mode, options, selectedQueryIds]
  );

  const defaultTriggerContent =
    mode === 'single' ? (
      selectedSingle ? (
        <DataText className="truncate">
          {selectedSingle.engineName} / {selectedSingle.queryName}
        </DataText>
      ) : (
        <span className="truncate text-muted-foreground">{triggerPlaceholder}</span>
      )
    ) : selectedQueryIds.length > 0 ? (
      <span className="truncate">
        {selectedQueryIds.length === 1 ? '1 query selected' : `${selectedQueryIds.length} queries selected`}
      </span>
    ) : (
      <span className="truncate text-muted-foreground">{triggerPlaceholder}</span>
    );

  return (
    <Popover
      open={open}
      onOpenChange={nextOpen => {
        setOpen(nextOpen);
        if (!nextOpen) setSearch('');
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          role="combobox"
          aria-label={ariaLabel}
          aria-expanded={open}
          className="h-8 w-full min-w-0 justify-between gap-2 px-2 text-xs font-normal"
        >
          <span className="min-w-0 flex-1 truncate text-left">
            {triggerOverride ?? defaultTriggerContent}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-72 p-2"
      >
        <div className="relative mb-2">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            className="h-7 pl-7 pr-2 text-xs md:text-xs"
            placeholder="Search queries…"
            value={search}
            onChange={event => setSearch(event.target.value)}
            autoFocus
          />
        </div>
        <div
          role="listbox"
          aria-label={ariaLabel}
          aria-multiselectable={mode === 'multi'}
          className="max-h-72 space-y-0.5 overflow-y-auto"
        >
          {loading && options.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">Loading queries…</p>
          ) : filteredOptions.length === 0 ? (
            <p className="py-2 text-center text-xs text-muted-foreground">{emptyMessage}</p>
          ) : (
            filteredOptions.map(opt => {
              const isSelected = selectedSet.has(opt.queryId);
              const isDisabled = disabledSet.has(opt.queryId);
              return (
                <button
                  key={`${opt.engineId}:${opt.queryId}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isDisabled}
                  onClick={() => handleSelect(opt.queryId)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs outline-none transition-colors',
                    'hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent',
                    isSelected && 'bg-accent/60',
                    isDisabled && 'cursor-not-allowed opacity-50 hover:bg-transparent'
                  )}
                >
                  {mode === 'multi' && (
                    <span
                      aria-hidden
                      className={cn(
                        'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-input bg-background'
                      )}
                    >
                      {isSelected && <Check className="h-2.5 w-2.5" strokeWidth={3} />}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <DataText className="block truncate">{opt.queryName}</DataText>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {opt.engineName} / {opt.groupName}
                    </span>
                  </div>
                  {mode === 'single' && isSelected && (
                    <Check className="h-3 w-3 shrink-0 text-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

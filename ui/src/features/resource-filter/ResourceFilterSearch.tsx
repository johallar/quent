// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useId, useMemo } from 'react';
import { CircleAlert, Search, X } from 'lucide-react';
import { Input } from '@quent/components';
import { MAX_RESOURCE_FILTER_QUERY_LENGTH } from './resourceFilter';

interface ResourceFilterSearchProps {
  errors: string[];
  fsmTypes: string[];
  matchCount: number;
  onQueryChange: (query: string) => void;
  query: string;
  resourceTypes: string[];
}

export function ResourceFilterSearch({
  errors,
  fsmTypes,
  matchCount,
  onQueryChange,
  query,
  resourceTypes,
}: ResourceFilterSearchProps) {
  const suggestionListId = useId();
  const suggestions = useMemo(
    () => [
      'name:',
      'id:',
      ...resourceTypes.map(type => `type:${type}`),
      ...fsmTypes.map(type => `fsm:${type}`),
    ],
    [fsmTypes, resourceTypes]
  );
  const isActive = query.trim().length > 0;

  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <div className="relative min-w-[12rem] max-w-[24rem] flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2"
        />
        <Input
          aria-label="Filter resources"
          aria-invalid={errors.length > 0}
          className="h-6 rounded-sm py-0 pl-6 pr-6 text-xs"
          list={suggestionListId}
          maxLength={MAX_RESOURCE_FILTER_QUERY_LENGTH}
          onChange={event => onQueryChange(event.target.value)}
          placeholder="Filter resources…"
          title="Search names or use name:, id:, type:, and fsm:. Quote values containing spaces."
          value={query}
        />
        {isActive && (
          <button
            aria-label="Clear resource filter"
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded-sm p-0.5 hover:bg-accent hover:text-accent-foreground"
            onClick={() => onQueryChange('')}
            type="button"
          >
            <X className="h-3 w-3" />
          </button>
        )}
        <datalist id={suggestionListId}>
          {suggestions.map(suggestion => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      </div>
      {isActive && errors.length === 0 && (
        <span aria-live="polite" className="shrink-0 tabular-nums">
          {matchCount} {matchCount === 1 ? 'match' : 'matches'}
        </span>
      )}
      {errors.length > 0 && (
        <span
          aria-live="polite"
          className="inline-flex min-w-0 items-center gap-1 text-destructive"
          title={errors.join('. ')}
        >
          <CircleAlert className="h-3 w-3 shrink-0" />
          <span className="max-w-36 truncate">{errors[0]}</span>
        </span>
      )}
    </div>
  );
}

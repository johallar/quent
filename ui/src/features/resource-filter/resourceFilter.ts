// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { TreeTableItem } from '@quent/components';
import { EntityTypeKey, type QueryEntities } from '@quent/utils';

export const RESOURCE_FILTER_FIELDS = ['name', 'id', 'type', 'fsm'] as const;
export const MAX_RESOURCE_FILTER_QUERY_LENGTH = 512;

export type ResourceFilterField = (typeof RESOURCE_FILTER_FIELDS)[number];

export interface ParsedResourceFilter {
  canonicalQuery: string;
  errors: string[];
  filters: Record<ResourceFilterField, string[]>;
  isActive: boolean;
  nameTerms: string[];
}

export interface ResourceFilterResult {
  autoExpandedIds: Set<string>;
  directMatchIds: Set<string>;
  filteredRoot: TreeTableItem | null;
  matchCount: number;
  parsed: ParsedResourceFilter;
}

interface TokenizeResult {
  errors: string[];
  tokens: string[];
}

function tokenize(query: string): TokenizeResult {
  const tokens: string[] = [];
  const errors: string[] = [];
  let current = '';
  let inQuotes = false;

  const flush = () => {
    if (current) tokens.push(current);
    current = '';
  };

  for (const character of query.trim()) {
    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (/\s/.test(character) && !inQuotes) {
      flush();
      continue;
    }
    current += character;
  }
  flush();

  if (inQuotes) errors.push('Unclosed quote');
  return { errors, tokens };
}

function isResourceFilterField(value: string): value is ResourceFilterField {
  return RESOURCE_FILTER_FIELDS.includes(value as ResourceFilterField);
}

function normalizeValues(value: string): string[] {
  return value
    .split(',')
    .map(part => part.trim().toLocaleLowerCase())
    .filter(Boolean);
}

function quoteValue(value: string): string {
  return /\s/.test(value) ? `"${value}"` : value;
}

export function parseResourceFilter(query: string): ParsedResourceFilter {
  const { errors, tokens } = tokenize(query);
  const filters: Record<ResourceFilterField, string[]> = {
    name: [],
    id: [],
    type: [],
    fsm: [],
  };
  const nameTerms: string[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const qualifier = token.match(/^([a-zA-Z][\w-]*):(.*)$/);
    if (!qualifier) {
      nameTerms.push(token.toLocaleLowerCase());
      continue;
    }

    const field = qualifier[1]!.toLocaleLowerCase();
    if (!isResourceFilterField(field)) {
      errors.push(`Unknown qualifier "${field}"`);
      continue;
    }

    let value = qualifier[2]!;
    if (!value && tokens[index + 1] && !/^[a-zA-Z][\w-]*:/.test(tokens[index + 1]!)) {
      value = tokens[index + 1]!;
      index += 1;
    }

    const values = normalizeValues(value);
    if (values.length === 0) {
      errors.push(`Missing value for "${field}:"`);
      continue;
    }
    filters[field].push(...values);
  }

  for (const field of RESOURCE_FILTER_FIELDS) {
    filters[field] = [...new Set(filters[field])];
  }

  const canonicalParts = [
    ...nameTerms.map(quoteValue),
    ...RESOURCE_FILTER_FIELDS.flatMap(field =>
      filters[field].length ? [`${field}:${filters[field].map(quoteValue).join(',')}`] : []
    ),
  ];

  return {
    canonicalQuery: canonicalParts.join(' '),
    errors,
    filters,
    isActive: canonicalParts.length > 0,
    nameTerms,
  };
}

function includesAny(value: string, candidates: string[]): boolean {
  const normalized = value.toLocaleLowerCase();
  return candidates.some(candidate => normalized.includes(candidate));
}

function itemMatches(
  item: TreeTableItem,
  parsed: ParsedResourceFilter,
  entities: QueryEntities
): boolean {
  const entity = item.entity;
  const name = 'instance_name' in entity ? (entity.instance_name ?? '') : '';
  const typeName = 'type_name' in entity ? (entity.type_name ?? '') : '';
  const normalizedId = item.id.toLocaleLowerCase();
  const isResource = item.type === EntityTypeKey.Resource;
  const fsmTypes = isResource ? (entities.resource_types[typeName]?.used_by ?? []) : [];

  if (!parsed.nameTerms.every(term => name.toLocaleLowerCase().includes(term))) return false;
  if (parsed.filters.name.length && !includesAny(name, parsed.filters.name)) return false;
  if (
    parsed.filters.id.length &&
    !parsed.filters.id.some(candidate => normalizedId === candidate)
  ) {
    return false;
  }
  if (parsed.filters.type.length && (!isResource || !includesAny(typeName, parsed.filters.type))) {
    return false;
  }
  if (
    parsed.filters.fsm.length &&
    !parsed.filters.fsm.some(candidate =>
      fsmTypes.some(fsmType => fsmType.toLocaleLowerCase().includes(candidate))
    )
  ) {
    return false;
  }
  return true;
}

export function filterResourceTree(
  root: TreeTableItem,
  entities: QueryEntities,
  query: string
): ResourceFilterResult {
  const parsed = parseResourceFilter(query);
  const autoExpandedIds = new Set<string>();
  const directMatchIds = new Set<string>();
  let matchCount = 0;

  if (!parsed.isActive) {
    return { autoExpandedIds, directMatchIds, filteredRoot: root, matchCount, parsed };
  }

  const visit = (item: TreeTableItem): TreeTableItem | null => {
    const isDirectMatch = itemMatches(item, parsed, entities);
    if (isDirectMatch) {
      directMatchIds.add(item.id);
      matchCount += 1;
      if (item.children?.length) autoExpandedIds.add(item.id);
      return item;
    }

    const children = item.children?.map(visit).filter(child => child !== null) ?? [];
    if (children.length === 0) return null;

    autoExpandedIds.add(item.id);
    return { ...item, children };
  };

  return {
    autoExpandedIds,
    directMatchIds,
    filteredRoot: visit(root),
    matchCount,
    parsed,
  };
}

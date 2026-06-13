// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute } from '@tanstack/react-router';
import { DiffPage } from '@/pages/DiffPage';

export interface DiffSearch {
  baseline?: string;
  compare?: string[];
}

function parseCompare(raw: unknown): string[] | undefined {
  if (raw == null) return undefined;
  if (Array.isArray(raw)) {
    const cleaned = raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof raw === 'string' && raw.length > 0) return [raw];
  return undefined;
}

export const Route = createFileRoute('/diff/')({
  component: DiffIndex,
  validateSearch: (search: Record<string, unknown>): DiffSearch => {
    const baseline =
      typeof search.baseline === 'string' && search.baseline.length > 0
        ? search.baseline
        : undefined;
    const compare = parseCompare(search.compare);
    return baseline || compare ? { baseline, compare } : {};
  },
});

function DiffIndex() {
  const { baseline, compare } = Route.useSearch();
  return (
    <DiffPage initialBaselineQueryId={baseline ?? ''} initialComparisonQueryIds={compare ?? []} />
  );
}

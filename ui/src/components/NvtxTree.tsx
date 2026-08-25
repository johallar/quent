// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useAtom, useSetAtom } from 'jotai';
import { ChartGantt } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useNvtxStream } from '@quent/client';
import {
  DEFAULT_TIMELINE_HEIGHT,
  InlineSelector,
  NVTX_DOMAIN_ROW_TYPE,
  NVTX_GANTT_HEIGHT,
  NVTX_LANE_ROW_TYPE,
  NVTX_SECTION_ROW_TYPE,
  NvtxGantt,
  buildNvtxTree,
  indexNvtxLanes,
  isNvtxTreeEntity,
  nvtxDefaultExpandedIds,
  nvtxDomainMeta,
  nvtxLaneLabel,
} from '@quent/components';
import { useDebouncedZoomRange, useSetDebouncedZoomRange, useSetZoomRange } from '@quent/hooks';
import type { EntityRef, NvtxCatalog, QueryBundle } from '@quent/utils';
import { expandedIdsAtom, selectedNvtxDomainAtom } from '@/atoms/resourceTree';
import { useExpandedIds } from '@/hooks/useExpandedIds';
import {
  TimelineTreeTable,
  useTimelineTreeSetup,
  type TimelineTreeControls,
  type TimelineTreeItem,
  type TimelineTreeModel,
} from '@/components/TimelineTreeTable';

const NVTX_ALL_DOMAINS = '__all__';

function NvtxSectionLabel({
  catalog,
  selectedDomainId,
  onDomainChange,
}: {
  catalog: NvtxCatalog;
  selectedDomainId: string | null;
  onDomainChange: (domainId: string | null) => void;
}) {
  const options = [
    { value: NVTX_ALL_DOMAINS, label: 'All' },
    ...catalog.domains.map(domain => ({ value: domain.domain_id, label: domain.name })),
  ];
  return (
    <div className="flex items-center">
      <ChartGantt aria-hidden className="mr-4 h-4 w-4 shrink-0 text-foreground" />
      <div className="flex flex-col gap-y-1 pb-1">
        <span className="text-xs font-semibold leading-none">NVTX</span>
        <InlineSelector
          id="nvtx-domain"
          label="Domain"
          value={selectedDomainId ?? NVTX_ALL_DOMAINS}
          options={options}
          onChange={(_, value) => onDomainChange(value === NVTX_ALL_DOMAINS ? null : value)}
        />
      </div>
    </div>
  );
}

function NvtxDomainLabel({ name, color }: { name: string; color: string }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs leading-none">
      <span
        aria-hidden
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

export interface NvtxTreeModel extends TimelineTreeModel, TimelineTreeControls {}

interface NvtxTreeProps {
  engineId: string;
  queryBundle: QueryBundle<EntityRef>;
}

interface UseNvtxTreeModelProps extends NvtxTreeProps {
  isDark: boolean;
}

// QueryResourceTree reuses the model to combine multiple trees in one table.
// eslint-disable-next-line react-refresh/only-export-components
export function useNvtxTreeModel({
  engineId,
  queryBundle,
  isDark,
}: UseNvtxTreeModelProps): NvtxTreeModel {
  const durationSeconds = queryBundle.duration_s;
  const [selectedNvtxDomain, setSelectedNvtxDomain] = useAtom(selectedNvtxDomainAtom);
  const setExpandedIds = useSetAtom(expandedIdsAtom);
  const { expandedIds, handleExpandChange } = useExpandedIds();
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();
  const seededExpansion = useRef(false);
  const debouncedZoomRange = useDebouncedZoomRange();
  const nvtxWindow = useMemo(() => {
    const { start, end } = debouncedZoomRange;
    return end > start ? { start, end } : { start: 0, end: durationSeconds };
  }, [debouncedZoomRange, durationSeconds]);
  const { catalog, viewport } = useNvtxStream(
    engineId,
    queryBundle.start_time_unix_ns,
    nvtxWindow,
    { domainId: selectedNvtxDomain }
  );

  useEffect(() => {
    if (!catalog || seededExpansion.current) return;
    seededExpansion.current = true;
    const ids = nvtxDefaultExpandedIds(catalog);
    setExpandedIds(previous => {
      const next = new Set(previous);
      for (const id of ids) next.add(id);
      return next;
    });
  }, [catalog, setExpandedIds]);

  useEffect(() => {
    if (
      selectedNvtxDomain != null &&
      catalog &&
      !catalog.domains.some(domain => domain.domain_id === selectedNvtxDomain)
    ) {
      setSelectedNvtxDomain(null);
    }
  }, [catalog, selectedNvtxDomain, setSelectedNvtxDomain]);

  const lanesByRowId = useMemo(() => indexNvtxLanes(viewport), [viewport]);
  const laneRowIdsKey = useMemo(() => [...lanesByRowId.keys()].sort().join('\0'), [lanesByRowId]);
  const laneRowIds = useMemo(
    () => new Set(laneRowIdsKey ? laneRowIdsKey.split('\0') : []),
    [laneRowIdsKey]
  );
  const tree = useMemo(
    () => (catalog ? buildNvtxTree(catalog, laneRowIds, selectedNvtxDomain) : null),
    [catalog, laneRowIds, selectedNvtxDomain]
  );
  const onZoomChange = useCallback(
    (range: { start: number; end: number }) => {
      setZoomRange(range);
      setDebouncedZoomRange(range);
    },
    [setDebouncedZoomRange, setZoomRange]
  );

  const renderLabel = useCallback(
    (item: TimelineTreeItem) => {
      if (item.type === NVTX_SECTION_ROW_TYPE) {
        return catalog ? (
          <NvtxSectionLabel
            catalog={catalog}
            selectedDomainId={selectedNvtxDomain}
            onDomainChange={setSelectedNvtxDomain}
          />
        ) : null;
      }
      if (item.type === NVTX_DOMAIN_ROW_TYPE) {
        const domain = isNvtxTreeEntity(item.entity) ? nvtxDomainMeta(item.entity) : null;
        return domain ? <NvtxDomainLabel name={domain.name} color={domain.color} /> : null;
      }
      if (item.type === NVTX_LANE_ROW_TYPE) {
        const label = isNvtxTreeEntity(item.entity) ? nvtxLaneLabel(item.entity) : '';
        return <span className="truncate text-xs leading-none text-muted-foreground">{label}</span>;
      }
      return null;
    },
    [catalog, selectedNvtxDomain, setSelectedNvtxDomain]
  );

  const renderTimeline = useCallback(
    (item: TimelineTreeItem) => {
      if (item.type === NVTX_SECTION_ROW_TYPE || item.type === NVTX_DOMAIN_ROW_TYPE) {
        return <div style={{ minHeight: DEFAULT_TIMELINE_HEIGHT }} />;
      }
      if (item.type === NVTX_LANE_ROW_TYPE) {
        return (
          <NvtxGantt
            lanes={lanesByRowId.get(item.id) ?? []}
            durationSeconds={durationSeconds}
            height={NVTX_GANTT_HEIGHT}
            isDark={isDark}
          />
        );
      }
      return null;
    },
    [durationSeconds, isDark, lanesByRowId]
  );

  return {
    tree: tree as TimelineTreeItem | null,
    initialSelectedItemId: tree?.id,
    expandedIds,
    onExpandChange: handleExpandChange,
    onZoomChange,
    renderLabel,
    renderTimeline,
  };
}

export function NvtxTree({ engineId, queryBundle }: NvtxTreeProps) {
  const { durationSeconds, isDark } = useTimelineTreeSetup(queryBundle);
  const nvtxTree = useNvtxTreeModel({ engineId, queryBundle, isDark });

  return (
    <TimelineTreeTable
      durationSeconds={durationSeconds}
      isDark={isDark}
      trees={[nvtxTree]}
      controls={nvtxTree}
    />
  );
}

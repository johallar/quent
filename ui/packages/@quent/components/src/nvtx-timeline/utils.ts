// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  DynamicAttribute,
  NvtxCatalog,
  NvtxLane,
  NvtxLaneIdentity,
  NvtxMarkItem,
  NvtxRangeItem,
  NvtxViewportResponse,
} from '@quent/utils';
import { formatDuration } from '@quent/utils';
import type { TreeTableItem } from '../resource-tree/types';
import type { ActiveMark } from '../timeline/TimelineTooltip';

export const NVTX_SECTION_ROW_TYPE = 'nvtx-section';
export const NVTX_DOMAIN_ROW_TYPE = 'nvtx-domain';
export const NVTX_LANE_ROW_TYPE = 'nvtx-lane';

export const NVTX_SECTION_ID = '__nvtx__';
const DOMAIN_PREFIX = '__nvtx_domain__';
const THREAD_PREFIX = '__nvtx_thread__';
const PROCESS_PREFIX = '__nvtx_process__';
const MARKS_PREFIX = '__nvtx_marks__';

const STUB_ENTITY = {} as TreeTableItem['entity'];

export function nvtxDomainRowId(domainId: string): string {
  return `${DOMAIN_PREFIX}${domainId}`;
}

export function nvtxThreadRowId(domainId: string, threadId: number): string {
  return `${THREAD_PREFIX}${domainId}__${threadId}`;
}

export function nvtxProcessRowId(domainId: string): string {
  return `${PROCESS_PREFIX}${domainId}`;
}

export function nvtxMarksRowId(domainId: string): string {
  return `${MARKS_PREFIX}${domainId}`;
}

export function isThreadIdentity(
  identity: NvtxLaneIdentity
): identity is Extract<NvtxLaneIdentity, { kind: 'thread' }> {
  return identity.kind === 'thread';
}

function treeItem(id: string, type: string, children?: TreeTableItem[]): TreeTableItem {
  return { id, type, entity: STUB_ENTITY, ...(children?.length ? { children } : {}) };
}

/** NVTX lanes for one domain, or domain sub-trees when all domains are selected. */
export function buildNvtxTree(
  catalog: NvtxCatalog,
  viewport: NvtxViewportResponse | null,
  selectedDomainId: string | null = null
): TreeTableItem | null {
  const viewportLanes = indexNvtxLanes(viewport);
  const visibleDomains = catalog.domains.filter(
    domain => selectedDomainId == null || domain.domain_id === selectedDomainId
  );
  if (visibleDomains.length === 0) return null;
  const domainLanes = visibleDomains.map(domain => {
    const threadRows = domain.threads.map(thread =>
      treeItem(nvtxThreadRowId(domain.domain_id, thread.thread_id), NVTX_LANE_ROW_TYPE)
    );
    const extraRows: TreeTableItem[] = [];
    if (viewportLanes.has(nvtxProcessRowId(domain.domain_id))) {
      extraRows.push(treeItem(nvtxProcessRowId(domain.domain_id), NVTX_LANE_ROW_TYPE));
    }
    if (viewportLanes.has(nvtxMarksRowId(domain.domain_id))) {
      extraRows.push(treeItem(nvtxMarksRowId(domain.domain_id), NVTX_LANE_ROW_TYPE));
    }
    return [...threadRows, ...extraRows];
  });
  const children =
    selectedDomainId == null
      ? visibleDomains.flatMap((domain, index) => {
          const lanes = domainLanes[index] ?? [];
          return lanes.length > 0
            ? [treeItem(nvtxDomainRowId(domain.domain_id), NVTX_DOMAIN_ROW_TYPE, lanes)]
            : [];
        })
      : (domainLanes[0] ?? []);
  return treeItem(NVTX_SECTION_ID, NVTX_SECTION_ROW_TYPE, children);
}

/** Map tree row id → viewport lanes (thread depths grouped, process/marks as one lane). */
export function indexNvtxLanes(viewport: NvtxViewportResponse | null): Map<string, NvtxLane[]> {
  const lanesByRowId = new Map<string, NvtxLane[]>();
  if (!viewport) return lanesByRowId;
  for (const domain of viewport.domains) {
    const byThread = new Map<number, NvtxLane[]>();
    for (const lane of domain.lanes) {
      if (isThreadIdentity(lane.identity)) {
        const lanes = byThread.get(lane.identity.thread_id) ?? [];
        lanes.push(lane);
        byThread.set(lane.identity.thread_id, lanes);
      } else if (lane.identity.kind === 'process') {
        lanesByRowId.set(nvtxProcessRowId(domain.domain_id), [lane]);
      } else if (lane.identity.kind === 'marks') {
        lanesByRowId.set(nvtxMarksRowId(domain.domain_id), [lane]);
      }
    }
    for (const [threadId, lanes] of byThread) {
      lanes.sort((left, right) => {
        const leftDepth = isThreadIdentity(left.identity) ? left.identity.depth : 0;
        const rightDepth = isThreadIdentity(right.identity) ? right.identity.depth : 0;
        return leftDepth - rightDepth;
      });
      lanesByRowId.set(nvtxThreadRowId(domain.domain_id, threadId), lanes);
    }
  }
  return lanesByRowId;
}

export function nvtxDomainMeta(
  catalog: NvtxCatalog,
  rowId: string
): { name: string; color: string } | null {
  if (!rowId.startsWith(DOMAIN_PREFIX)) return null;
  const domainId = rowId.slice(DOMAIN_PREFIX.length);
  const domain = catalog.domains.find(item => item.domain_id === domainId);
  return domain ? { name: domain.name, color: rgbHex(domain.color) } : null;
}

export function nvtxLaneLabel(
  catalog: NvtxCatalog,
  viewport: NvtxViewportResponse | null,
  rowId: string,
  includeDomain = false
): string {
  const domainId = nvtxLaneDomainId(rowId);
  if (domainId == null) return '';
  const domain = catalog.domains.find(item => item.domain_id === domainId);
  const prefix = includeDomain && domain ? `${domain.name} · ` : '';
  if (rowId.startsWith(PROCESS_PREFIX)) return `${prefix}Process ranges`;
  if (rowId.startsWith(MARKS_PREFIX)) return `${prefix}Marks`;
  if (!rowId.startsWith(THREAD_PREFIX)) return '';
  const separator = rowId.lastIndexOf('__');
  const threadId = Number(rowId.slice(separator + 2));
  const thread = domain?.threads.find(item => item.thread_id === threadId);
  if (thread) return `${prefix}${thread.name}`;
  const lanes = indexNvtxLanes(viewport).get(rowId);
  return `${prefix}${lanes?.[0]?.label ?? `thread ${threadId}`}`;
}

function nvtxLaneDomainId(rowId: string): string | null {
  const prefix = [THREAD_PREFIX, PROCESS_PREFIX, MARKS_PREFIX].find(value =>
    rowId.startsWith(value)
  );
  if (!prefix) return null;
  const rest = rowId.slice(prefix.length);
  const separator = rest.lastIndexOf('__');
  return separator < 0 ? rest : rest.slice(0, separator);
}

export type NvtxGanttDatum = {
  value: [number, number, number];
  range?: NvtxRangeItem;
  mark?: NvtxMarkItem;
  /** Set when adjacent same-color bars collapsed to one pixel column. */
  mergedCount?: number;
  /** Per-message counts retained for a merged block's tooltip. */
  mergedTypeCounts?: Array<{ label: string; count: number }>;
};

export interface NvtxPixelBudget {
  visibleStartMs: number;
  visibleEndMs: number;
  plotWidthPx: number;
}

/** Flatten viewport lanes into Gantt datums. Thread depth is the row index. */
export function nvtxLanesToGanttData(lanes: NvtxLane[]): NvtxGanttDatum[] {
  const data: NvtxGanttDatum[] = [];
  for (const lane of lanes) {
    const rowIndex = isThreadIdentity(lane.identity) ? lane.identity.depth : 0;
    for (const range of lane.ranges) {
      data.push({
        value: [range.display_start * 1_000, range.display_end * 1_000, rowIndex],
        range,
      });
    }
    for (const mark of lane.marks) {
      const timestampMs = mark.timestamp * 1_000;
      data.push({
        value: [timestampMs, timestampMs, rowIndex],
        mark,
      });
    }
  }
  return data;
}

/** Merge same-row, same-color bars whose pixel occupancy is this close. */
export const NVTX_BAR_MERGE_GAP_PX = 2;
/** Minimum touching bars required before collapsing them into one. */
export const NVTX_BAR_MERGE_MIN_COUNT = 8;

/** Collapse same-row, same-color bars that would occupy the same pixels. */
export function mergeNvtxGanttData(
  data: NvtxGanttDatum[],
  budget: NvtxPixelBudget
): NvtxGanttDatum[] {
  const spanMs = budget.visibleEndMs - budget.visibleStartMs;
  if (data.length <= 1 || budget.plotWidthPx <= 0 || spanMs <= 0) return data;
  const msPerPx = spanMs / budget.plotWidthPx;
  const groups = new Map<string, NvtxGanttDatum[]>();
  for (const datum of data) {
    const key = nvtxBarMergeKey(datum);
    const group = groups.get(key);
    if (group) group.push(datum);
    else groups.set(key, [datum]);
  }
  const merged: NvtxGanttDatum[] = [];
  for (const group of groups.values()) {
    merged.push(...mergeNvtxBarGroup(group, budget.visibleStartMs, msPerPx));
  }
  return merged;
}

function nvtxBarMergeKey(datum: NvtxGanttDatum): string {
  const color = rgbHex(datum.range?.color ?? datum.mark?.color ?? '');
  const kind = datum.mark ? 'm' : 'r';
  return `${datum.value[2]}:${kind}:${color}`;
}

function mergeNvtxBarGroup(
  group: NvtxGanttDatum[],
  originMs: number,
  msPerPx: number
): NvtxGanttDatum[] {
  if (group.length <= 1) return group;
  const sorted = [...group].sort((left, right) => left.value[0] - right.value[0]);
  const out: NvtxGanttDatum[] = [];
  let run = [sorted[0]!];
  let startMs = run[0]!.value[0];
  let endMs = run[0]!.value[1];
  let endPx = barEndPx(startMs, endMs, originMs, msPerPx);
  for (let index = 1; index < sorted.length; index++) {
    const next = sorted[index]!;
    const nextStartPx = (next.value[0] - originMs) / msPerPx;
    if (nextStartPx <= endPx + NVTX_BAR_MERGE_GAP_PX) {
      run.push(next);
      endMs = Math.max(endMs, next.value[1]);
      endPx = Math.max(endPx, barEndPx(next.value[0], next.value[1], originMs, msPerPx));
      continue;
    }
    out.push(...condenseNvtxBarRun(run, startMs, endMs));
    run = [next];
    startMs = next.value[0];
    endMs = next.value[1];
    endPx = barEndPx(startMs, endMs, originMs, msPerPx);
  }
  out.push(...condenseNvtxBarRun(run, startMs, endMs));
  return out;
}

function condenseNvtxBarRun(
  run: NvtxGanttDatum[],
  startMs: number,
  endMs: number
): NvtxGanttDatum[] {
  if (run.length < NVTX_BAR_MERGE_MIN_COUNT) return run;
  return [nvtxMergedDatum(run, startMs, endMs)];
}

function barEndPx(startMs: number, endMs: number, originMs: number, msPerPx: number): number {
  const startPx = (startMs - originMs) / msPerPx;
  return Math.max((Math.max(endMs, startMs) - originMs) / msPerPx, startPx + 1);
}

function nvtxMergedDatum(run: NvtxGanttDatum[], startMs: number, endMs: number): NvtxGanttDatum {
  const datum = run[0]!;
  const counts = new Map<string, number>();
  for (const item of run) {
    const label = item.range?.message ?? item.mark?.message;
    if (label) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return {
    ...datum,
    value: [startMs, endMs, datum.value[2]],
    mergedCount: run.length,
    mergedTypeCounts: [...counts].map(([label, count]) => ({ label, count })),
  };
}

export function nvtxItemsAtTimestamp(
  data: NvtxGanttDatum[],
  timestampMs: number
): NvtxGanttDatum[] {
  return data.filter(datum => {
    const [startMs, endMs] = datum.value;
    const hitEnd = Math.max(endMs, startMs + 1);
    return startMs <= timestampMs && timestampMs < hitEnd;
  });
}

function stringAttr(key: string, value: string): DynamicAttribute {
  return { key, value };
}

function countLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? `1 ${singular}` : `${count} ${plural}`;
}

/** Compact name + count row for pixel-merged bars. */
export function nvtxToSummaryMark(datum: NvtxGanttDatum): ActiveMark {
  const count = datum.mergedCount ?? 1;
  if (datum.mark) {
    return {
      label: 'Consolidated block',
      stateName: countLabel(count, 'mark', 'marks'),
      color: rgbHex(datum.mark.color),
      compact: true,
    };
  }
  const range = datum.range!;
  return {
    label: 'Consolidated block',
    stateName: countLabel(count, 'range', 'ranges'),
    color: rgbHex(range.color),
    compact: true,
  };
}

function nvtxToSummaryMarks(datum: NvtxGanttDatum): ActiveMark[] {
  const typeCounts = datum.mergedTypeCounts;
  if (!typeCounts?.length) return [nvtxToSummaryMark(datum)];
  const isMark = datum.mark != null;
  const color = rgbHex(datum.mark?.color ?? datum.range?.color ?? '');
  return typeCounts.map(({ label, count }) => ({
    label,
    stateName: countLabel(count, isMark ? 'mark' : 'range', isMark ? 'marks' : 'ranges'),
    color,
    compact: true,
  }));
}

export const NVTX_TOOLTIP_COMPACT_LIMIT = 6;
export const NVTX_TOOLTIP_DETAIL_LIMIT = 3;

export type NvtxTooltipModel = {
  marks: ActiveMark[];
  summary?: string;
  compact: boolean;
  itemLimit: number;
};

/** Count rows for merged bars; full range data when the item is a single range. */
export function nvtxTooltipModel(data: NvtxGanttDatum[]): NvtxTooltipModel {
  const orderedData = [...data].sort((left, right) => left.value[2] - right.value[2]);
  const hasMerged = orderedData.some(datum => (datum.mergedCount ?? 1) > 1);
  const hasSingle = orderedData.some(datum => (datum.mergedCount ?? 1) === 1);
  const rangeCount = orderedData.reduce(
    (sum, datum) => sum + (datum.range ? (datum.mergedCount ?? 1) : 0),
    0
  );
  const markCount = orderedData.reduce(
    (sum, datum) => sum + (datum.mark ? (datum.mergedCount ?? 1) : 0),
    0
  );
  const parts = [
    ...(rangeCount > 0 ? [countLabel(rangeCount, 'range', 'ranges')] : []),
    ...(markCount > 0 ? [countLabel(markCount, 'mark', 'marks')] : []),
  ];
  return {
    marks: orderedData.flatMap(datum =>
      (datum.mergedCount ?? 1) > 1 ? nvtxToSummaryMarks(datum) : [nvtxToActiveMark(datum)]
    ),
    summary: hasMerged ? parts.join(', ') : undefined,
    compact: hasMerged,
    itemLimit: hasSingle ? NVTX_TOOLTIP_DETAIL_LIMIT : NVTX_TOOLTIP_COMPACT_LIMIT,
  };
}

/** Map a Gantt datum onto the shared TimelineTooltip mark shape. */
export function nvtxToActiveMark(datum: NvtxGanttDatum): ActiveMark {
  const mergedCount = datum.mergedCount ?? 1;
  if (datum.mark) {
    if (mergedCount > 1) return nvtxToSummaryMark(datum);
    return {
      label: datum.mark.domain_name,
      stateName: datum.mark.message,
      color: rgbHex(datum.mark.color),
      attributes: [
        stringAttr('kind', nvtxKindLabel('mark')),
        stringAttr('category', datum.mark.category_name ?? 'Uncategorized'),
      ],
    };
  }
  const range = datum.range!;
  if (mergedCount > 1) {
    return nvtxToSummaryMark(datum);
  }
  return {
    label: range.message,
    stateName: '',
    color: rgbHex(range.color),
    durationMs: range.observed_duration != null ? range.observed_duration * 1_000 : undefined,
    attributes: [
      stringAttr('start', formatDuration(range.observed_start * 1_000)),
      stringAttr(
        'end',
        range.observed_end != null ? formatDuration(range.observed_end * 1_000) : '(open)'
      ),
      stringAttr('kind', nvtxKindLabel(range.kind)),
      stringAttr('domain', range.domain_name),
      stringAttr('category', range.category_name ?? 'Uncategorized'),
    ],
  };
}

export function rgbHex(color: string): string {
  return color.length >= 7 ? color.slice(0, 7) : color;
}

const MERGED_COUNT_CHARACTER_WIDTH = 5;
const MERGED_COUNT_PADDING = 4;
const MERGED_COUNT_OPACITY = 0.6;

/** Shows the exact item count when a merged bar is wide enough to read it. */
export function nvtxMergedBarCountLabel(
  shape: { x: number; y: number; width: number; height: number },
  fill: string,
  count: number
): Array<{ type: 'text'; silent: true; style: object }> {
  const text = `(${count} ranges)`;
  if (shape.width < text.length * MERGED_COUNT_CHARACTER_WIDTH + MERGED_COUNT_PADDING) return [];
  const cy = shape.y + shape.height / 2;
  return [
    {
      type: 'text',
      silent: true,
      style: {
        text,
        x: shape.x + shape.width / 2,
        y: cy,
        textAlign: 'center',
        textVerticalAlign: 'middle',
        fontSize: 9,
        fill,
        opacity: MERGED_COUNT_OPACITY,
      },
    },
  ];
}

export function nvtxKindLabel(kind: NvtxRangeItem['kind'] | 'mark'): string {
  if (kind === 'mark') return 'mark';
  if (kind === 'push_pop') return 'push/pop range';
  return 'start/end range';
}

export function nvtxDefaultExpandedIds(catalog: NvtxCatalog): string[] {
  return [NVTX_SECTION_ID, ...catalog.domains.map(domain => nvtxDomainRowId(domain.domain_id))];
}

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

/** Catalog domains plus viewport-only process/marks rows, as a resource-tree sibling. */
export function buildNvtxTree(
  catalog: NvtxCatalog,
  viewport: NvtxViewportResponse | null
): TreeTableItem | null {
  const viewportLanes = indexNvtxLanes(viewport);
  const domains = catalog.domains.flatMap(domain => {
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
    const children = [...threadRows, ...extraRows];
    if (children.length === 0) return [];
    return [treeItem(nvtxDomainRowId(domain.domain_id), NVTX_DOMAIN_ROW_TYPE, children)];
  });
  if (domains.length === 0) return null;
  return treeItem(NVTX_SECTION_ID, NVTX_SECTION_ROW_TYPE, domains);
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
  rowId: string
): string {
  if (rowId.startsWith(PROCESS_PREFIX)) return 'Process ranges';
  if (rowId.startsWith(MARKS_PREFIX)) return 'Marks';
  if (!rowId.startsWith(THREAD_PREFIX)) return '';
  const rest = rowId.slice(THREAD_PREFIX.length);
  const separator = rest.lastIndexOf('__');
  if (separator < 0) return '';
  const domainId = rest.slice(0, separator);
  const threadId = Number(rest.slice(separator + 2));
  const domain = catalog.domains.find(item => item.domain_id === domainId);
  const thread = domain?.threads.find(item => item.thread_id === threadId);
  if (thread) return thread.name;
  const lanes = indexNvtxLanes(viewport).get(rowId);
  return lanes?.[0]?.label ?? `thread ${threadId}`;
}

export type NvtxGanttDatum = {
  value: [number, number, number];
  range?: NvtxRangeItem;
  mark?: NvtxMarkItem;
  /** Set when adjacent same-color bars collapsed to one pixel column. */
  mergedCount?: number;
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
  let current = sorted[0]!;
  let startMs = current.value[0];
  let endMs = current.value[1];
  let endPx = barEndPx(startMs, endMs, originMs, msPerPx);
  let count = 1;
  for (let index = 1; index < sorted.length; index++) {
    const next = sorted[index]!;
    const nextStartPx = (next.value[0] - originMs) / msPerPx;
    if (nextStartPx <= endPx + NVTX_BAR_MERGE_GAP_PX) {
      endMs = Math.max(endMs, next.value[1]);
      endPx = Math.max(endPx, barEndPx(next.value[0], next.value[1], originMs, msPerPx));
      count += 1;
      continue;
    }
    out.push(nvtxMergedDatum(current, startMs, endMs, count));
    current = next;
    startMs = next.value[0];
    endMs = next.value[1];
    endPx = barEndPx(startMs, endMs, originMs, msPerPx);
    count = 1;
  }
  out.push(nvtxMergedDatum(current, startMs, endMs, count));
  return out;
}

function barEndPx(startMs: number, endMs: number, originMs: number, msPerPx: number): number {
  const startPx = (startMs - originMs) / msPerPx;
  return Math.max((Math.max(endMs, startMs) - originMs) / msPerPx, startPx + 1);
}

function nvtxMergedDatum(
  datum: NvtxGanttDatum,
  startMs: number,
  endMs: number,
  count: number
): NvtxGanttDatum {
  if (count === 1 && startMs === datum.value[0] && endMs === datum.value[1]) return datum;
  return {
    ...datum,
    value: [startMs, endMs, datum.value[2]],
    ...(count > 1 ? { mergedCount: count } : {}),
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
      label: datum.mark.message,
      stateName: countLabel(count, 'mark', 'marks'),
      color: rgbHex(datum.mark.color),
      compact: true,
    };
  }
  const range = datum.range!;
  return {
    label: range.message,
    stateName: countLabel(count, 'range', 'ranges'),
    color: rgbHex(range.color),
    compact: true,
  };
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
  const hasMerged = data.some(datum => (datum.mergedCount ?? 1) > 1);
  const hasSingle = data.some(datum => (datum.mergedCount ?? 1) === 1);
  const rangeCount = data.reduce(
    (sum, datum) => sum + (datum.range ? (datum.mergedCount ?? 1) : 0),
    0
  );
  const markCount = data.reduce(
    (sum, datum) => sum + (datum.mark ? (datum.mergedCount ?? 1) : 0),
    0
  );
  const parts = [
    ...(rangeCount > 0 ? [countLabel(rangeCount, 'range', 'ranges')] : []),
    ...(markCount > 0 ? [countLabel(markCount, 'mark', 'marks')] : []),
  ];
  return {
    marks: data.map(datum =>
      (datum.mergedCount ?? 1) > 1 ? nvtxToSummaryMark(datum) : nvtxToActiveMark(datum)
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
    label: range.thread_name ?? range.domain_name,
    stateName: range.message,
    color: rgbHex(range.color),
    durationMs: range.observed_duration != null ? range.observed_duration * 1_000 : undefined,
    attributes: [
      stringAttr('start', formatDuration(range.observed_start * 1_000)),
      stringAttr(
        'end',
        range.observed_end != null ? formatDuration(range.observed_end * 1_000) : '(open)'
      ),
      stringAttr('kind', nvtxKindLabel(range.kind)),
      ...(range.thread_id != null
        ? [stringAttr('thread', range.thread_name ?? String(range.thread_id))]
        : []),
      stringAttr('domain', range.domain_name),
      stringAttr('category', range.category_name ?? 'Uncategorized'),
    ],
  };
}

export function rgbHex(color: string): string {
  return color.length >= 7 ? color.slice(0, 7) : color;
}

const MERGED_DOT_RADIUS = 1;
const MERGED_DOT_GAP = 3.5;
const MERGED_DOTS_MIN_WIDTH = 12;
const MERGED_ELLIPSIS_MIN_WIDTH = 8;

/** Teeny "more" glyph for pixel-merged bars. Dots when they fit, else an ellipsis. */
export function nvtxMergedBarGlyph(
  shape: { x: number; y: number; width: number; height: number },
  fill: string
): Array<{ type: 'circle' | 'text'; silent: true; shape?: object; style: object }> {
  const cy = shape.y + shape.height / 2;
  if (shape.width >= MERGED_DOTS_MIN_WIDTH) {
    const right = shape.x + shape.width - 4;
    return [0, 1, 2].map(index => ({
      type: 'circle' as const,
      silent: true as const,
      shape: { cx: right - (2 - index) * MERGED_DOT_GAP, cy, r: MERGED_DOT_RADIUS },
      style: { fill },
    }));
  }
  if (shape.width >= MERGED_ELLIPSIS_MIN_WIDTH) {
    return [
      {
        type: 'text' as const,
        silent: true as const,
        style: {
          text: '…',
          x: shape.x + shape.width / 2,
          y: cy,
          textAlign: 'center',
          textVerticalAlign: 'middle',
          fontSize: 9,
          fill,
        },
      },
    ];
  }
  return [];
}

export function nvtxKindLabel(kind: NvtxRangeItem['kind'] | 'mark'): string {
  if (kind === 'mark') return 'mark';
  if (kind === 'push_pop') return 'push/pop range';
  return 'start/end range';
}

export function nvtxDefaultExpandedIds(catalog: NvtxCatalog): string[] {
  return [NVTX_SECTION_ID, ...catalog.domains.map(domain => nvtxDomainRowId(domain.domain_id))];
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  NvtxCatalog,
  NvtxLane,
  NvtxLaneIdentity,
  NvtxMarkItem,
  NvtxRangeItem,
  NvtxViewportResponse,
} from '@quent/utils';
import type { TreeTableItem } from '../resource-tree/types';

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
};

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

export function rgbHex(color: string): string {
  return color.length >= 7 ? color.slice(0, 7) : color;
}

export function nvtxKindLabel(kind: NvtxRangeItem['kind'] | 'mark'): string {
  if (kind === 'mark') return 'mark';
  if (kind === 'push_pop') return 'push/pop range';
  return 'start/end range';
}

export function nvtxDefaultExpandedIds(catalog: NvtxCatalog): string[] {
  return [NVTX_SECTION_ID, ...catalog.domains.map(domain => nvtxDomainRowId(domain.domain_id))];
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export interface GanttRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Clip a rectangle to the chart grid bounds. */
export function clipRectByRect(target: GanttRect, bounds: GanttRect): GanttRect | undefined {
  const x = Math.max(target.x, bounds.x);
  const x2 = Math.min(target.x + target.width, bounds.x + bounds.width);
  const y = Math.max(target.y, bounds.y);
  const y2 = Math.min(target.y + target.height, bounds.y + bounds.height);
  if (x2 >= x && y2 >= y) {
    return { x, y, width: x2 - x, height: y2 - y };
  }
  return undefined;
}

/** Greedily pack intervals into non-overlapping rows. */
export function stackIntervalsIntoRows<
  T extends { startMs: number; endMs: number; rowIndex: number },
>(entries: T[]): T[] {
  if (entries.length === 0) return entries;

  const sorted = [...entries].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const rowEndMs: number[] = [];

  for (const entry of sorted) {
    let row = 0;
    while (row < rowEndMs.length && entry.startMs < rowEndMs[row]) {
      row++;
    }
    if (row === rowEndMs.length) {
      rowEndMs.push(entry.endMs);
    } else {
      rowEndMs[row] = Math.max(rowEndMs[row], entry.endMs);
    }
    entry.rowIndex = row;
  }

  return entries;
}

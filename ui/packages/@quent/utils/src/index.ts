// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// Utilities
export { cn } from './cn';
export { parseJsonWithBigInt } from './parseJsonWithBigInt';

// Color utilities
export {
  PALETTES,
  getColorForKey,
  assignColors,
  getColorByIndex,
  getOperationTypeColor,
  buildOperatorColorMap,
  withOpacity,
  resetColorAssignments,
  darkenColor,
  getActivePalette,
  setActivePalette,
  getPalette,
  BLACK,
  WHITE,
  isLightColor,
  createCapacitiesColorFn,
  CONTINUOUS_PALETTES,
  continuousColor,
  getLegendGradientStops,
} from './colors';
export type { PaletteName, PaletteTheme, ChartColor, ContinuousPaletteName } from './colors';
export type { UnitPrefixSystem } from './formatters';

// Formatter utilities
export {
  formatDuration,
  formatDurationForWindow,
  formatDurationForAxisInterval,
  formatWithPrefix,
  formatCompactWithPrefix,
  formatBytes,
  formatNumber,
  formatNumberWithMaxFractionDigits,
  inferFieldFormatter,
  isNumericValue,
  isBytesStat,
  isBytesRateStat,
  isCountStat,
} from './formatters';

// Timeline types and constants
export type { ZoomRange } from './types/ZoomRange';
export const MAX_TIMELINE_BINS = 200;

// Operator timeline row ID utilities
export const OPERATOR_TIMELINE_ROW_TYPE = 'operator-timeline';
const OPERATOR_TIMELINE_ROW_ID_PREFIX = '__operator_timeline__';
export function operatorTimelineRowId(workerId: string): string {
  return `${OPERATOR_TIMELINE_ROW_ID_PREFIX}${workerId}`;
}
export function workerIdFromOperatorTimelineRowId(id: string): string | null {
  return id.startsWith(OPERATOR_TIMELINE_ROW_ID_PREFIX)
    ? id.slice(OPERATOR_TIMELINE_ROW_ID_PREFIX.length)
    : null;
}

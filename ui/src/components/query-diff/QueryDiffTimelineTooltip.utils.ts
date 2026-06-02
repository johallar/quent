// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { formatDuration } from '@quent/utils';

export function formatRelativePercent(value: number): string {
  const percent = value * 100;
  const decimals = Math.abs(percent) < 10 && percent !== 0 ? 1 : 0;
  return `${percent.toFixed(decimals)}%`;
}

export function escapeTooltipText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface QueryDiffTimelineTooltipBin {
  label: string;
  relative: number;
  signedDelta: number;
  baseline: number;
  comparison: number;
  timestamp: number;
  formatter: (value: number, decimals?: number) => string;
}

export function formatQueryDiffTimelineTooltipHtml(
  bin: QueryDiffTimelineTooltipBin,
  colors: { positive: string; negative: string; neutral: string }
): string {
  const deltaLabel =
    bin.signedDelta > 0
      ? 'Comparison higher'
      : bin.signedDelta < 0
        ? 'Comparison lower'
        : 'No change';
  const deltaColor =
    bin.signedDelta > 0
      ? colors.positive
      : bin.signedDelta < 0
        ? colors.negative
        : colors.neutral;
  const deltaStyle = `color:${deltaColor};font-weight:600`;
  const relativeText = escapeTooltipText(formatRelativePercent(bin.relative));
  const deltaText = escapeTooltipText(bin.formatter(bin.signedDelta, 2));

  return [
    `<strong>${escapeTooltipText(bin.label)}</strong>`,
    `<span style="${deltaStyle}">${escapeTooltipText(deltaLabel)}</span> (${relativeText})`,
    `Baseline: ${escapeTooltipText(bin.formatter(bin.baseline, 2))}`,
    `Comparison: ${escapeTooltipText(bin.formatter(bin.comparison, 2))}`,
    `Delta: <span style="${deltaStyle}">${deltaText}</span>`,
    `Time: ${escapeTooltipText(formatDuration(bin.timestamp))}`,
  ].join('<br />');
}

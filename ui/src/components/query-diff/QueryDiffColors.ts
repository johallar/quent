// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { getColorByIndex, getOperationTypeColor, type PaletteTheme } from '@quent/utils';

export const DIFF_DIVERGING_COLORS_LIGHT = [
  '#2166AC',
  '#4393C3',
  '#92C5DE',
  '#D1E5F0',
  '#F7F7F7',
  '#FDDBC7',
  '#F4A582',
  '#D6604D',
  '#B2182B',
] as const;

export const DIFF_DIVERGING_COLORS_DARK = [
  '#92C5DE',
  '#4393C3',
  '#2166AC',
  '#0B2F4A',
  '#020817',
  '#4A1218',
  '#B2182B',
  '#D6604D',
  '#F4A582',
] as const;

export const DIFF_DIVERGING_COLORS = DIFF_DIVERGING_COLORS_LIGHT;

const BASELINE_QUERY_COLOR_INDEX = 8;
const COMPARISON_QUERY_COLOR_INDICES = [4, 6, 2, 3, 7, 8, 9, 10];

export function getDiffDivergingColors(theme: PaletteTheme): readonly string[] {
  return theme === 'dark' ? DIFF_DIVERGING_COLORS_DARK : DIFF_DIVERGING_COLORS_LIGHT;
}

export function getDiffPositiveColor(theme: PaletteTheme): string {
  const colors = getDiffDivergingColors(theme);
  return colors[colors.length - 1]!;
}

export function getDiffNegativeColor(theme: PaletteTheme): string {
  return getDiffDivergingColors(theme)[0]!;
}

export const DIFF_POSITIVE_COLOR = getDiffPositiveColor('light');
export const DIFF_NEGATIVE_COLOR = getDiffNegativeColor('light');

export interface QueryDiffQueryColors {
  baseline: string;
  comparison: string;
}

export function getQueryDiffQueryColors({
  comparisonIndex = 0,
  theme,
}: {
  baselineQueryId: string;
  comparisonQueryId: string;
  comparisonIndex?: number;
  theme: PaletteTheme;
}): QueryDiffQueryColors {
  return {
    baseline: getColorByIndex(BASELINE_QUERY_COLOR_INDEX, theme),
    comparison: getColorByIndex(
      COMPARISON_QUERY_COLOR_INDICES[comparisonIndex % COMPARISON_QUERY_COLOR_INDICES.length]!,
      theme
    ),
  };
}

export function getQueryDiffOperatorTypeColor(operatorType: string): string {
  return getOperationTypeColor(operatorType.toLowerCase());
}

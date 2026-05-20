// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  getColorByIndex,
  getOperationTypeColor,
  getPalette,
  type PaletteTheme,
} from '@quent/utils';

const TOL_GREEN_INDEX = 0;
const TOL_RED_INDEX = 1;
const BASELINE_QUERY_COLOR_INDEX = 5;
const COMPARISON_QUERY_COLOR_INDICES = [4, 6, 2, 3, 7, 8, 9, 10];

export function getDiffPositiveColor(theme: PaletteTheme): string {
  return getPalette('extended', theme)[TOL_RED_INDEX]!;
}

export function getDiffNegativeColor(theme: PaletteTheme): string {
  return getPalette('extended', theme)[TOL_GREEN_INDEX]!;
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

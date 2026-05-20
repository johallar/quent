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
  competitor: string;
}

export function getQueryDiffQueryColors({
  theme,
}: {
  baselineQueryId: string;
  competitorQueryId: string;
  theme: PaletteTheme;
}): QueryDiffQueryColors {
  return {
    baseline: getColorByIndex(5, theme),
    competitor: getColorByIndex(4, theme),
  };
}

export function getQueryDiffOperatorTypeColor(operatorType: string): string {
  return getOperationTypeColor(operatorType.toLowerCase());
}

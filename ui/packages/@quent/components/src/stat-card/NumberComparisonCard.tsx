// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { CSSProperties, ReactNode } from 'react';
import { StatisticCard, type StatisticCardComparison } from './StatisticCard';

export interface NumberComparisonCardProps {
  title: ReactNode;
  baselineLabel: ReactNode;
  comparisonLabel: ReactNode;
  baselineValue: number;
  comparisonValue: number;
  deltaValue: number;
  percentDelta?: number | null;
  baselineColor?: string;
  comparisonColor?: string;
  formatValue: (value: number) => ReactNode;
  formatDeltaValue: (value: number) => ReactNode;
  formatPercentDelta?: (value: number | null) => ReactNode;
  valueStyle?: CSSProperties;
  comparisonSeparator?: ReactNode;
  className?: string;
}

export function NumberComparisonCard({
  title,
  baselineLabel,
  comparisonLabel,
  baselineValue,
  comparisonValue,
  deltaValue,
  percentDelta = null,
  baselineColor,
  comparisonColor,
  formatValue,
  formatDeltaValue,
  formatPercentDelta,
  valueStyle,
  comparisonSeparator,
  className,
}: NumberComparisonCardProps) {
  const comparisons: StatisticCardComparison[] = [
    {
      id: 'baseline',
      label: baselineLabel,
      value: formatValue(baselineValue),
      color: baselineColor,
    },
    {
      id: 'comparison',
      label: comparisonLabel,
      value: formatValue(comparisonValue),
      color: comparisonColor,
    },
  ];

  return (
    <StatisticCard
      title={title}
      value={formatDeltaValue(deltaValue)}
      valueStyle={valueStyle}
      secondaryValue={formatPercentDelta?.(percentDelta)}
      className={className}
      comparisons={comparisons}
      comparisonSeparator={comparisonSeparator}
    />
  );
}

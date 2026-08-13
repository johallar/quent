// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import EChartsReactCore from 'echarts-for-react/lib/core';
import type { FsmTransition } from '@quent/utils';
import { bigintToChartNumber, formatBytes, isBytesStat } from '@quent/utils';
import { echarts } from '../lib/echarts';
import { useChartResize } from '../lib/useChartResize';
import type { PointerPosition } from '../ui/pointer-tooltip-portal';
import { PositionedTooltip } from '../ui/positioned-tooltip';
import { useTimelineEchartsTheme } from '../timeline/timelineEchartsTheme';
import { FsmCapacityTooltip } from './FsmCapacityTooltip';

const CHART_HEIGHT = 90;
const GRID = { left: 52, right: 8, top: 8, bottom: 36 };

interface CapacitySeries {
  label: string;
  // Full-length array aligned to transitions — null where no reading exists
  data: Array<number | null>;
  // Original bigint values for lossless tooltip formatting
  rawData: Array<bigint | null>;
}

export interface FsmCapacityChartProps {
  transitions: FsmTransition[];
  isDark: boolean;
  resourceLabel: (id: string) => string;
}

export function FsmCapacityChart({ transitions, isDark, resourceLabel }: FsmCapacityChartProps) {
  const { themeName } = useTimelineEchartsTheme(isDark);
  const { handleChartReady } = useChartResize();
  const [hover, setHover] = useState<(PointerPosition & { dataIndex: number }) | null>(null);

  const { series, stateLabels } = useMemo(() => {
    const n = transitions.length;
    const stateLabels = transitions.map((t, i) => `${i + 1}. ${t.name}`);

    // Build per-resource full-length arrays (null = no reading at that state)
    const dataMap = new Map<string, Array<number | null>>();
    const rawMap = new Map<string, Array<bigint | null>>();
    const labelMap = new Map<string, string>();

    transitions.forEach((t, i) => {
      t.usages.forEach(usage => {
        const resourceName = resourceLabel(usage.resource);
        usage.capacities.forEach(([name, cap]) => {
          if (cap == null || !isBytesStat(name)) return;
          const key = `${usage.resource} ${name}`;
          if (!dataMap.has(key)) {
            dataMap.set(key, Array<number | null>(n).fill(null));
            rawMap.set(key, Array<bigint | null>(n).fill(null));
            labelMap.set(key, name === 'capacity_bytes' ? resourceName : `${resourceName} ${name}`);
          }
          dataMap.get(key)![i] = bigintToChartNumber(cap);
          rawMap.get(key)![i] = cap;
        });
      });
    });

    // Only show resources with readings in at least 2 states
    const series: CapacitySeries[] = [...dataMap.entries()]
      .filter(([, data]) => data.filter(v => v !== null).length >= 2)
      .map(([key, data]) => ({
        label: labelMap.get(key) ?? key,
        data,
        rawData: rawMap.get(key) ?? Array<bigint | null>(n).fill(null),
      }));

    return { series, stateLabels };
  }, [transitions, resourceLabel]);

  const reportHover = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const plotWidth = rect.width - GRID.left - GRID.right;
    const outsidePlot =
      x < GRID.left || x > rect.width - GRID.right || y < GRID.top || y > rect.height - GRID.bottom;
    if (outsidePlot || plotWidth <= 0 || stateLabels.length === 0) {
      setHover(null);
      return;
    }

    const ratio = (x - GRID.left) / plotWidth;
    const dataIndex = stateLabels.length === 1 ? 0 : Math.round(ratio * (stateLabels.length - 1));
    setHover({ dataIndex, clientX: event.clientX, clientY: event.clientY });
  };

  const tooltipItems = hover
    ? series.flatMap((item, seriesIndex) => {
        const value = item.data[hover.dataIndex];
        if (value == null) return [];
        const raw = item.rawData[hover.dataIndex];
        return [
          {
            id: `${item.label}-${seriesIndex}`,
            label: item.label,
            value: formatBytes(raw ?? value),
          },
        ];
      })
    : [];

  const option = useMemo(
    () => ({
      animation: false,
      grid: GRID,
      xAxis: {
        type: 'category' as const,
        data: stateLabels,
        boundaryGap: false,
        axisLabel: {
          show: true,
          fontSize: 9,
          interval: 0,
          // Show only the state number to save space; full name is in the tooltip
          formatter: (_val: string, idx: number) => String(idx + 1),
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: 'value' as const,
        splitNumber: 3,
        axisLabel: {
          show: true,
          fontSize: 9,
          formatter: (v: number) => formatBytes(v, 0),
        },
        splitLine: { show: true, lineStyle: { opacity: 0.25 } },
        minInterval: 1,
      },
      tooltip: {
        trigger: 'axis' as const,
        showContent: false,
        axisPointer: { type: 'line' as const, snap: true },
      },
      series: series.map(s => ({
        type: 'line' as const,
        name: s.label,
        data: s.data,
        connectNulls: false,
        step: 'end' as const,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 1.5 },
      })),
    }),
    [series, stateLabels]
  );

  if (series.length === 0) return null;

  return (
    <div
      className="shrink-0 border-b"
      onPointerMove={reportHover}
      onPointerLeave={() => setHover(null)}
      onPointerCancel={() => setHover(null)}
    >
      <EChartsReactCore
        echarts={echarts}
        theme={themeName}
        option={option}
        style={{ height: CHART_HEIGHT }}
        onChartReady={handleChartReady}
        autoResize={false}
        notMerge={false}
        lazyUpdate={false}
      />
      {hover && tooltipItems.length > 0 && (
        <PositionedTooltip clientX={hover.clientX} clientY={hover.clientY}>
          <FsmCapacityTooltip
            stateIndex={hover.dataIndex}
            stateName={transitions[hover.dataIndex]?.name ?? ''}
            items={tooltipItems}
          />
        </PositionedTooltip>
      )}
    </div>
  );
}

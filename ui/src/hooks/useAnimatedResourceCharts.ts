// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useEffect, useRef, useState } from 'react';
import { RESOURCE_CHART_ORDER, type ResourceChartType } from '@/lib/resourceCharts';

export const RESOURCE_CHART_ANIMATION_MS = 200;

function mergeSelections(
  rendered: Map<string, ResourceChartType[]>,
  selected: Map<string, ResourceChartType[]>
): Map<string, ResourceChartType[]> {
  const ids = new Set([...rendered.keys(), ...selected.keys()]);
  return new Map(
    Array.from(ids, id => {
      const charts = new Set([...(rendered.get(id) ?? []), ...(selected.get(id) ?? [])]);
      return [id, RESOURCE_CHART_ORDER.filter(chart => charts.has(chart))];
    })
  );
}

function selectionsEqual(
  left: Map<string, ResourceChartType[]>,
  right: Map<string, ResourceChartType[]>
): boolean {
  if (left.size !== right.size) return false;
  return Array.from(left).every(
    ([id, charts]) =>
      charts.length === right.get(id)?.length &&
      charts.every((chart, index) => chart === right.get(id)?.[index])
  );
}

export function useAnimatedResourceCharts(
  selected: Map<string, ResourceChartType[]>
): Map<string, ResourceChartType[]> {
  const [rendered, setRendered] = useState(selected);
  const renderedRef = useRef(rendered);
  const selectedRef = useRef(selected);

  useEffect(() => {
    selectedRef.current = selected;
    const merged = mergeSelections(renderedRef.current, selected);
    const hasClosingChart = Array.from(merged).some(([id, charts]) =>
      charts.some(chart => !(selected.get(id) ?? []).includes(chart))
    );

    if (!selectionsEqual(renderedRef.current, merged)) {
      renderedRef.current = merged;
      setRendered(merged);
    }

    if (!hasClosingChart) return;

    const timeoutId = window.setTimeout(() => {
      const current = selectedRef.current;
      renderedRef.current = current;
      setRendered(current);
    }, RESOURCE_CHART_ANIMATION_MS);

    return () => window.clearTimeout(timeoutId);
  }, [selected]);

  return rendered;
}

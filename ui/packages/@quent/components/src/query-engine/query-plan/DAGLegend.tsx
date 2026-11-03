// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useMemo } from 'react';
import {
  COLOR_REGISTRY_KEYS,
  formatDataFlowValueCompact,
  useColorResolver,
  useDataFlowEnabled,
  useDataFlowFrame,
  useDataFlowMeta,
  useEdgeColorPalette,
  useEdgeColoring,
  useNodeColorPalette,
  useNodeColoringValue,
  useSelectedColorField,
  useSelectedEdgeColorField,
  useSelectedScaleType,
} from '@quent/hooks';
import {
  SCALE_TYPE,
  formatQuantity,
  getLegendGradientStops,
  inferFieldFormatter,
  statisticFieldLabel,
  statisticFieldName,
  type EdgeColoring,
  type NodeColoring,
  type QuantitySpec,
  type ScaleType,
  type StatisticField,
} from '@quent/utils';
import { DAGLegendView, type DAGLegendSection } from '../../quent-views/query-plan/DAGLegendView';

const SCALE_LABELS: Record<ScaleType, string> = {
  [SCALE_TYPE.LOG]: 'Log',
  [SCALE_TYPE.LINEAR]: 'Linear',
};

function formatter(
  field: string | StatisticField,
  specs: Record<string, QuantitySpec>
): (value: number) => string {
  const spec = specs[typeof field === 'string' ? field : field.key];
  return spec
    ? value => formatQuantity(value, spec, 'Occupancy')
    : inferFieldFormatter(statisticFieldName(field));
}

function coloringSection({
  id,
  coloring,
  field,
  palette,
  isDark,
  scale,
  specs,
}: {
  id: string;
  coloring: NodeColoring | EdgeColoring;
  field: string | StatisticField | null;
  palette: Parameters<typeof getLegendGradientStops>[0];
  isDark: boolean;
  scale: ScaleType;
  specs: Record<string, QuantitySpec>;
}): DAGLegendSection | null {
  if (!coloring || !field) {
    return null;
  }
  if (coloring.type === 'continuous') {
    return {
      kind: 'continuous',
      id,
      label: statisticFieldLabel(field),
      min: coloring.min,
      max: coloring.max,
      gradientStops: getLegendGradientStops(palette, isDark),
      formatValue: formatter(field, specs),
      scaleLabel: SCALE_LABELS[scale],
    };
  }
  return {
    kind: 'categorical',
    id,
    label: statisticFieldLabel(field),
    categoryMap: coloring.categoryMap,
  };
}

export interface DAGLegendProps {
  isDark: boolean;
  statQuantitySpecs?: Record<string, QuantitySpec>;
  statisticFields?: ReadonlyMap<string, StatisticField>;
}

/** Query-engine-aware legend adapter over the provider-free legend view. */
export function DAGLegend({ isDark, statQuantitySpecs = {}, statisticFields }: DAGLegendProps) {
  const nodeColoring = useNodeColoringValue();
  const edgeColoring = useEdgeColoring();
  const [nodePalette] = useNodeColorPalette();
  const [edgePalette] = useEdgeColorPalette();
  const [nodeField] = useSelectedColorField();
  const [edgeField] = useSelectedEdgeColorField();
  const [scale] = useSelectedScaleType();
  const dataFlowEnabled = useDataFlowEnabled();
  const dataFlowMeta = useDataFlowMeta();
  const dataFlowFrame = useDataFlowFrame();
  const stateColor = useColorResolver(COLOR_REGISTRY_KEYS.FSM_STATES);
  const dimensionColor = useColorResolver(COLOR_REGISTRY_KEYS.DATA_FLOW_DIMENSIONS);

  const sections = useMemo(() => {
    const result: DAGLegendSection[] = [];
    const nodeSection = coloringSection({
      id: 'node',
      coloring: nodeColoring,
      field: nodeField ? (statisticFields?.get(nodeField) ?? nodeField) : null,
      palette: nodePalette,
      isDark,
      scale,
      specs: statQuantitySpecs,
    });
    const edgeSection = coloringSection({
      id: 'edge',
      coloring: edgeColoring,
      field: edgeField ? (statisticFields?.get(edgeField) ?? edgeField) : null,
      palette: edgePalette,
      isDark,
      scale,
      specs: statQuantitySpecs,
    });
    if (nodeSection) {
      result.push(nodeSection);
    }
    if (edgeSection) {
      result.push(edgeSection);
    }
    if (!dataFlowEnabled || !dataFlowMeta) {
      return result;
    }

    result.push({
      kind: 'categorical',
      id: 'flow-state',
      label: dataFlowMeta.decl.entity_type_name,
      categoryMap: new Map(dataFlowMeta.stateNames.map(state => [state, stateColor(state)])),
    });
    const suffixes = new Map<string, string>();
    const totals = dataFlowFrame?.dimensionTotalsByMeasure[dataFlowFrame.measure];
    dataFlowMeta.decl.dimension_keys.forEach((dimension, index) => {
      const total = totals?.[index] ?? 0;
      if (total > 0 && dataFlowFrame) {
        suffixes.set(
          dimension.display_name,
          formatDataFlowValueCompact(total, dataFlowFrame.measure, dataFlowMeta)
        );
      }
    });
    result.push({
      kind: 'categorical',
      id: 'flow-dimension',
      label: dataFlowMeta.decl.dimension_name,
      categoryMap: new Map(
        dataFlowMeta.decl.dimension_keys.map(dimension => [
          dimension.display_name,
          dimensionColor(dimension.key),
        ])
      ),
      dimmedLabels: new Set(
        dataFlowMeta.decl.dimension_keys
          .filter(dimension => !dataFlowMeta.dimensionSelection.has(dimension.key))
          .map(dimension => dimension.display_name)
      ),
      entrySuffixes: suffixes,
    });
    return result;
  }, [
    dataFlowEnabled,
    dataFlowFrame,
    dataFlowMeta,
    dimensionColor,
    edgeColoring,
    edgeField,
    edgePalette,
    isDark,
    nodeColoring,
    nodeField,
    nodePalette,
    scale,
    statQuantitySpecs,
    stateColor,
    statisticFields,
  ]);

  return <DAGLegendView sections={sections} />;
}

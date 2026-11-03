// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { memo } from 'react';
import {
  COLOR_REGISTRY_KEYS,
  useDataFlowFrame,
  useDataFlowMeta,
  useColorResolver,
  fitDataFlowSegmentLabel,
  formatDataFlowValueCompact,
} from '@quent/hooks';
import {
  NODE_LAYOUT_WIDTH,
  FLOW_BAR_TOP_MARGIN,
  FLOW_BAR_TRACK_HEIGHT,
  FLOW_BAR_TRACK_GAP,
  FLOW_BAR_LABEL_HEIGHT,
} from '../../quent-views/query-plan/layout';
import { SegmentedBar } from '../../ui/segmented-bar/SegmentedBar';

const BAR_TRANSITION = 'width 120ms linear';

// Fixed geometry width-gates labels without DOM measurement.
const FLOW_TRACK_PX = NODE_LAYOUT_WIDTH - 32;

/** Isolates per-frame updates from the full query-plan node. */
export const NodeFlowBar = memo(({ operatorId }: { operatorId: string }) => {
  const meta = useDataFlowMeta();
  const frame = useDataFlowFrame();
  const stateColor = useColorResolver(COLOR_REGISTRY_KEYS.FSM_STATES);
  const dimensionColor = useColorResolver(COLOR_REGISTRY_KEYS.DATA_FLOW_DIMENSIONS);

  if (!meta || !frame) {
    return null;
  }

  const operatorFrame = frame.perOperator.get(operatorId);
  const total = operatorFrame?.total ?? 0;
  const hasData = operatorFrame != null && total > 0 && frame.maxTotal > 0;

  // Pipes keep adjacent totals from reading like decimals.
  const operatorTotals = frame.totalsByMeasure.get(operatorId);
  const totalsLabel = operatorTotals
    ? meta.decl.measures
        .filter(m => (operatorTotals[m.name] ?? 0) > 0)
        .map(m => formatDataFlowValueCompact(operatorTotals[m.name]!, m.name, meta))
        .join(' | ')
    : '';
  const stateSegments = hasData
    ? meta.stateNames.flatMap((state, stateIndex) => {
        const value = operatorFrame.byState[stateIndex] ?? 0;
        if (value <= 0) {
          return [];
        }
        const color = stateColor(state);
        const label = fitDataFlowSegmentLabel(
          value,
          frame.maxTotal,
          frame.measure,
          meta,
          FLOW_TRACK_PX,
          {
            value: operatorFrame.labelByState[stateIndex] ?? 0,
            measure: frame.labelMeasure,
          }
        );
        return [{ id: state, value, color, label: label ?? undefined }];
      })
    : [];
  const dimensionSegments = hasData
    ? meta.decl.dimension_keys.flatMap((dimension, dimensionIndex) => {
        const value = operatorFrame.byDimension[dimensionIndex] ?? 0;
        if (value <= 0) {
          return [];
        }
        const color = dimensionColor(dimension.key);
        const label = fitDataFlowSegmentLabel(
          value,
          frame.maxTotal,
          frame.measure,
          meta,
          FLOW_TRACK_PX,
          {
            value: operatorFrame.labelByDimension[dimensionIndex] ?? 0,
            measure: frame.labelMeasure,
          }
        );
        return [{ id: dimension.key, value, color, label: label ?? undefined }];
      })
    : [];

  return (
    <div className="w-full" style={{ marginTop: FLOW_BAR_TOP_MARGIN }} data-testid="node-flow-bar">
      <SegmentedBar
        segments={stateSegments}
        fillValue={total}
        maxValue={frame.maxTotal}
        height={FLOW_BAR_TRACK_HEIGHT}
        minimumFillPx={2}
        showTooltips={false}
        transition={BAR_TRANSITION}
        trackClassName={hasData ? 'bg-muted/40' : 'bg-transparent'}
        labelTestId="flow-segment-label"
      />
      <SegmentedBar
        segments={dimensionSegments}
        fillValue={total}
        maxValue={frame.maxTotal}
        height={FLOW_BAR_TRACK_HEIGHT}
        minimumFillPx={2}
        showTooltips={false}
        transition={BAR_TRANSITION}
        style={{ marginTop: FLOW_BAR_TRACK_GAP }}
        trackClassName={hasData ? 'bg-muted/40' : 'bg-transparent'}
        labelTestId="flow-tier-label"
      />
      <div
        className="text-right text-[9px] text-muted-foreground tabular-nums truncate"
        style={{ lineHeight: `${FLOW_BAR_LABEL_HEIGHT}px` }}
        data-testid="flow-bar-totals"
      >
        {totalsLabel !== '' ? totalsLabel : '\u00A0'}
      </div>
    </div>
  );
});

NodeFlowBar.displayName = 'NodeFlowBar';

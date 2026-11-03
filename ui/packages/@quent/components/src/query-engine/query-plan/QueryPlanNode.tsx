// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { memo, useMemo, useState } from 'react';
import { useAtom } from 'jotai';
import {
  BLACK,
  DAG_LAYOUT_DIRECTION,
  NODE_LABEL_FIELD,
  WHITE,
  formatStatWithQuantity,
  isLightColor,
  scaleColor,
  statisticFieldName,
  withOpacity,
  type DAGStatisticSet,
  type DagLayoutDirection,
  type Operator,
  type SelectedOperatorGroupData,
  type QuantitySpec,
  type ScaleRange,
  type Statistic,
} from '@quent/utils';
import {
  COLOR_REGISTRY_KEYS,
  useColorResolver,
  useNodeColorPalette,
  useNodeColoring,
  useSelectedNodeLabelField,
  useSelectedScaleType,
  useSetHighlightedNodeIds,
} from '@quent/hooks';
import { QueryPlanNodeView } from '../../quent-views/query-plan/QueryPlanNodeView';
import { resolveNodeOpacity } from '../../quent-views/query-plan/nodeOpacity';
import { resolveStatisticFields } from '../../lib/queryBundle.utils';
import { DAGItemActions } from '../../dag/DAGItemActions';
import { DAGItemStatus } from '../../dag/DAGItemStatus';
import { activeDAGPreviewIdAtom } from '../../dag/dagPreviewState';
import { OperatorDetailsBlock } from '../../node-info/OperatorDetailsBlock';
import { NodeFlowBar } from './NodeFlowBar';

export interface QueryPlanNodeData extends Record<string, unknown> {
  label: string;
  nodeId: string;
  operationType: string;
  metadata?: {
    rawNode?: Operator;
    relatedOperatorIds?: string[];
    relatedOperators?: Operator[];
    aggregatedStatistics?: Statistic[];
    operatorStatistics?: DAGStatisticSet;
    relatedOperatorStatistics?: DAGStatisticSet[];
    operatorWorkerLabels?: Record<string, string | undefined>;
    operatorPlanLabels?: Record<string, string | undefined>;
  };
  hasIncoming?: boolean;
  hasOutgoing?: boolean;
  layoutDirection?: DagLayoutDirection;
  isDark?: boolean;
  flowBarVisible?: boolean;
  quantitySpecs?: { [key: string]: QuantitySpec | undefined };
  hoveredStatActive?: boolean;
  hoveredStatValue?: number;
  heatmapRange?: ScaleRange;
  highlightedNodeIds?: ReadonlySet<string> | null;
  actions?: {
    filtered: boolean;
    details: SelectedOperatorGroupData;
  };
}

/** Query-engine-aware node adapter over the provider-free node view. */
export const QueryPlanNode = memo(({ data }: { data: QueryPlanNodeData }) => {
  const setHighlightState = useSetHighlightedNodeIds();
  const [nodePalette] = useNodeColorPalette();
  const [scaleType] = useSelectedScaleType();
  const resolveOperatorTypeColor = useColorResolver(COLOR_REGISTRY_KEYS.OPERATOR_TYPES);
  const [nodeLabelField] = useSelectedNodeLabelField();
  const isDark = data.isDark ?? false;
  const operatorId = data.metadata?.rawNode?.id ?? data.nodeId;
  const highlightedNodeIds = data.highlightedNodeIds ?? null;
  const isHighlighted = highlightedNodeIds?.has(operatorId) === true;
  const { fieldColor, isDimmed, isFiltered, colorField } = useNodeColoring(
    operatorId,
    isDark,
    data.metadata?.relatedOperatorIds
  );
  const [closedPreviewOperatorIds, setClosedPreviewOperatorIds] = useState<Set<string>>(
    () => new Set()
  );
  const [activePreviewId, setActivePreviewId] = useAtom(activeDAGPreviewIdAtom);
  const previewId = `node:${data.nodeId}`;

  const resolvedLabel = useMemo(() => {
    if (nodeLabelField === NODE_LABEL_FIELD.ID) {
      return data.metadata?.rawNode?.id ?? data.nodeId;
    }
    if (nodeLabelField === NODE_LABEL_FIELD.TYPE) {
      return data.operationType;
    }
    return data.label;
  }, [data, nodeLabelField]);

  const colorFieldStat = colorField
    ? data.metadata?.operatorStatistics && data.metadata.relatedOperatorStatistics
      ? resolveStatisticFields(
          data.metadata.operatorStatistics.fields,
          data.metadata.relatedOperatorStatistics.map(statistics => statistics.fields),
          colorField
        )
      : undefined
    : undefined;
  const colorFieldValue = colorFieldStat?.value ?? null;
  const formattedColorFieldValue =
    colorFieldValue === null
      ? null
      : typeof colorFieldValue === 'number' || typeof colorFieldValue === 'bigint'
        ? formatStatWithQuantity(
            colorFieldValue,
            statisticFieldName(colorFieldStat ?? colorField!),
            colorFieldStat?.quantity && data.quantitySpecs
              ? data.quantitySpecs[colorFieldStat.quantity]
              : undefined
          )
        : String(colorFieldValue);

  const baseColor = resolveOperatorTypeColor(data.operationType);
  const heatmapColor = useMemo(() => {
    if (data.hoveredStatValue === undefined || !data.heatmapRange) {
      return undefined;
    }
    return scaleColor(data.hoveredStatValue, data.heatmapRange, scaleType, nodePalette, isDark);
  }, [data.heatmapRange, data.hoveredStatValue, isDark, nodePalette, scaleType]);
  const activeColor = heatmapColor ?? fieldColor ?? baseColor;
  const backgroundColor =
    heatmapColor ?? fieldColor ?? withOpacity(baseColor, isFiltered ? 0.3 : 0.15);
  const hoverBackgroundColor = heatmapColor ?? fieldColor ?? withOpacity(baseColor, 0.22);
  const isBottomToTop =
    (data.layoutDirection ?? DAG_LAYOUT_DIRECTION.BOTTOM_TO_TOP) ===
    DAG_LAYOUT_DIRECTION.BOTTOM_TO_TOP;

  return (
    <QueryPlanNodeView
      data={{
        nodeId: data.nodeId,
        label: resolvedLabel,
        operationType: data.operationType,
        hasIncoming: data.hasIncoming ?? false,
        hasOutgoing: data.hasOutgoing ?? false,
        incomingHandlePosition: isBottomToTop ? 'bottom' : 'top',
        outgoingHandlePosition: isBottomToTop ? 'top' : 'bottom',
        formattedColorFieldValue,
        flowBar:
          data.flowBarVisible && operatorId ? <NodeFlowBar operatorId={operatorId} /> : undefined,
        status: data.actions?.filtered ? (
          <DAGItemStatus
            label={data.label}
            status="filtered"
            className="absolute right-1 top-1 z-20"
          />
        ) : undefined,
        actions: data.actions ? (
          <DAGItemActions
            label={data.label}
            backgroundColor={heatmapColor ?? activeColor}
            previewOpen={activePreviewId === previewId}
            onOpenChange={open => setActivePreviewId(open ? previewId : null)}
            className="-mx-4 -mb-2 mt-2 w-[calc(100%+2rem)] overflow-hidden rounded-b-md"
            previewContent={
              <OperatorDetailsBlock
                operator={data.actions.details}
                quantitySpecs={data.quantitySpecs}
                isOpen={id => !closedPreviewOperatorIds.has(id)}
                onOpenChange={(id, open) =>
                  setClosedPreviewOperatorIds(current => {
                    const next = new Set(current);
                    if (open) {
                      next.delete(id);
                    } else {
                      next.add(id);
                    }
                    return next;
                  })
                }
              />
            }
          />
        ) : undefined,
        presentation: {
          borderColor: activeColor,
          backgroundColor,
          hoverBackgroundColor,
          textColor: fieldColor && isLightColor(fieldColor) ? '#111827' : undefined,
          colorFieldTextColor: fieldColor
            ? isLightColor(fieldColor)
              ? withOpacity(BLACK, 0.5)
              : withOpacity(WHITE, 0.65)
            : undefined,
          isSelected: isFiltered,
          isActiveHighlight: isHighlighted && !isFiltered,
          opacity: resolveNodeOpacity({
            isHoveredStatActive: data.hoveredStatActive ?? false,
            hasHoveredValue: data.hoveredStatValue !== undefined,
            highlightedNodeIds,
            operatorId,
            isDimmed,
            isFiltered,
          }),
        },
        onHoverChange: hovered => {
          setHighlightState(previous => {
            if (hovered) {
              return {
                ...previous,
                ids: new Set([operatorId]),
                source: 'dag',
                primaryOperatorId: operatorId,
              };
            }
            return previous.source === 'dag' &&
              previous.ids?.size === 1 &&
              previous.ids.has(operatorId)
              ? { ...previous, ids: null, source: null, primaryOperatorId: null }
              : previous;
          });
        },
      }}
    />
  );
});

QueryPlanNode.displayName = 'QueryPlanNode';

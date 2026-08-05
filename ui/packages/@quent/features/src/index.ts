// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

// ─── Provider ─────────────────────────────────────────────────────────────────
export { QuentProvider } from './provider/QuentProvider';
export type { QuentProviderProps } from './provider/QuentProvider';

// ─── UI primitives ────────────────────────────────────────────────────────────
export { Button, buttonVariants } from './shared/ui/button';
export type { ButtonProps } from './shared/ui/button';
export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
} from './shared/ui/card';
export { Collapsible, CollapsibleTrigger, CollapsibleContent } from './shared/ui/collapsible';
export { DataText } from './shared/ui/data-text';
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from './shared/ui/dropdown-menu';
export { HoverCard, HoverCardTrigger, HoverCardContent } from './shared/ui/hover-card';
export { Input } from './shared/ui/input';
export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
} from './shared/ui/navigation-menu';
export { Popover, PopoverTrigger, PopoverContent } from './shared/ui/popover';
export { ResizablePanelGroup, ResizablePanel, ResizableHandle } from './shared/ui/resizable';
export { ScrollArea, ScrollBar } from './shared/ui/scroll-area';
export {
  ThinScroll,
  thinScrollbarClass,
  HiddenScroll,
  hiddenScrollbarClass,
} from './shared/ui/thin-scroll';
export type { ThinScrollProps, HiddenScrollProps } from './shared/ui/thin-scroll';
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './shared/ui/select';
export { SelectField } from './shared/ui/select-field';
export type { SelectFieldProps, SelectFieldOption } from './shared/ui/select-field';
export { Skeleton } from './shared/ui/skeleton';
export { TreeView } from './shared/ui/tree-view';
export type { TreeDataItem } from './shared/ui/tree-view';
export { TreeTable } from './shared/ui/tree-table';
export type { Column, ColumnComponent, IconComponent } from './shared/ui/tree-table';
export { Badge, badgeVariants } from './shared/ui/badge';
export { OptionMultiSelect } from './shared/ui/option-multi-select';
export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './shared/ui/table';
export { Tabs, TabsList, TabsTrigger, TabsContent } from './shared/ui/tabs';

// ─── ECharts ──────────────────────────────────────────────────────────────────
export { echarts } from '@quent/viz-core';
export type { EChartsOption } from '@quent/viz-core';

// ─── Lib utilities ────────────────────────────────────────────────────────────
export {
  entityRefToEntitiesKey,
  ENTITY_REF_TO_ENTITIES_KEY,
  parseCustomStatistics,
  parsePortStatistics,
} from './query-plan/queryBundle.utils';
export {
  getIconForType,
  collectResourceTypesFromTree,
  transformResourceTree,
} from './resource-tree/resource.utils';
export {
  nanosToMs,
  connectChart,
  registerAxisPointerSync,
  unregisterAxisPointerSync,
  broadcastSyncedPointer,
  hideSyncedPointer,
  buildBinnedTimelineSeries,
  buildBulkParamsForItem,
  buildTimelineMarks,
  collectVisibleEntries,
  getAdaptiveNumBins,
  getFsmTypeName,
  getLongEntitiesThreshold,
  getLongFsms,
  getResourceTypeName,
  getTimelineConfig,
  getTimelineXAxisIntervalMs,
  mergeOverlaySeries,
  setOperatorOnEntries,
  setOperatorOnEntry,
  findItemById,
} from '@quent/resource-timeline';
export type { AxisPointerSyncOptions } from '@quent/viz-core';

// ─── Services – query-plan ────────────────────────────────────────────────────
export {
  computeNodeColoring,
  computeEdgeColoring,
  computeEdgeWidthConfig,
} from './query-plan/transforms/dagFieldProcessing';
export {
  getPlanDAG,
  getTreeData,
  validateQueryBundle,
} from './query-plan/transforms/query-bundle-transformer';
export type {
  DAGData,
  DAGEdge,
  DAGNode,
  QueryPlanDataItem,
  QueryPlanNodeData,
} from './query-plan/transforms/types';
export { DAG_LAYOUT_DIRECTION, NODE_LABEL_FIELD } from './dag/state/types';
export type {
  CategoricalEdgeColoring,
  CategoricalNodeColoring,
  ContinuousEdgeColoring,
  ContinuousNodeColoring,
  DagLayoutDirection,
  EdgeColoring,
  EdgeWidthConfig,
  NodeColoring,
  NodeLabelField,
} from './dag/state/types';

// ─── Timeline components ──────────────────────────────────────────────────────
export { DEFAULT_CHART_GROUP as CHART_GROUP } from '@quent/viz-core';
export { Timeline } from '@quent/viz-timeline';
export { TimelineController } from '@quent/resource-timeline';
export { TimelineRuler } from '@quent/resource-timeline';
export { TimelineSkeleton } from '@quent/viz-timeline';
export { TimelineToolbar } from './timeline-ui/components/TimelineToolbar';
export { QueryToolbar } from './timeline-ui/components/QueryToolbar';
export { TooltipContent } from '@quent/resource-timeline';
export { TimelineTooltipPortal } from '@quent/resource-timeline';
export {
  useTimelineEchartsTheme,
  TIMELINE_MONO_FONT,
  TIMELINE_THEME_NAME_LIGHT,
  TIMELINE_THEME_NAME_DARK,
  MARK_AREA_BORDER_OPACITY,
  MARK_AREA_FILL_OPACITY,
  MARK_LABEL_TEXT_COLOR,
  ROLLUP_TIMELINE_COLOR_LIGHT,
  ROLLUP_TIMELINE_COLOR_DARK,
} from '@quent/viz-timeline';
export {
  DEFAULT_TIMELINE_HEIGHT,
  TIMELINE_SPACING,
  TIMELINE_X_AXIS_ANIMATION,
} from '@quent/viz-timeline';
export type { TimelineMark, TimelineSeries, TimelineSeriesEntry } from '@quent/viz-timeline';
export { ResourceTimeline } from '@quent/resource-timeline';

// ─── DAG components ───────────────────────────────────────────────────────────
export { DAGChart } from './dag/components/DAGChart';
export { DAGControls } from './dag/components/DAGControls';
export { DAGLegend } from './dag/components/DAGLegend';
export { DAGNodeInfoPanel } from './dag/components/DAGNodeInfoPanel';
export { DagPlayhead } from './dag/components/DagPlayhead';

// ─── Query-plan components ────────────────────────────────────────────────────
export { QueryPlanNode } from './query-plan/components/QueryPlanNode';
export { NodeFlowBar } from './query-plan/components/NodeFlowBar';

// ─── Resource-tree components ─────────────────────────────────────────────────
export { InlineSelector } from './resource-tree/InlineSelector';
export { ResourceColumn } from './resource-tree/ResourceColumn';
export { ResourceGroupRow } from './resource-tree/ResourceGroupRow';
export { ResourceRow } from './resource-tree/ResourceRow';
export type { TreeTableItem } from './resource-tree/types';
export { UsageColumn } from './resource-tree/UsageColumn';

// ─── Pivot-table components ──────────────────────────────────────────────────
export { GroupedDataTable } from './pivot-table/components/GroupedDataTable';
export type {
  GroupedDataTableProps,
  GroupedDataTableVirtualizationOptions,
  GroupedDataTableGroupRenderMode,
} from './pivot-table/components/GroupedDataTable';
export { PivotedStatTable } from './pivot-table/components/PivotedStatTable';
export { PivotTableToolbar } from './pivot-table/components/PivotTableToolbar';
export type {
  IndexConfigEntry,
  PivotTableToolbarProps,
} from './pivot-table/components/PivotTableToolbar';
export type {
  GroupedDataTableRowBase,
  GroupedDataTableSortInfo,
  GroupedDataTableGroupKeyEntry,
  DataHeaderProps,
  GroupCellProps,
  DataCellProps,
  SortDir,
  StatGroupInputGroupValue,
  StatGroupExpandedRow,
  PivotedStatTableSchema,
  GroupKeyEntry,
  PivotedRowAgg,
  PivotedRow,
  PivotTableInteractionConfig,
  PivotTableRenderConfig,
  PivotTableDisplayConfig,
  PivotTableDnDConfig,
  PivotTableGroupCellHoverHandlers,
} from './pivot-table/components/types';
export {
  buildPivotedRows,
  computeRowSpans,
  expandRowsFromSchema,
  formatNumericStat,
  formatStatValue,
  getGroupKeys,
  getSchemaStatNames,
  getSortValue,
  getUniqueStatNames,
  gradientBg,
  isNumericValue,
  itemHasId,
  rowGroupKey,
} from './pivot-table/components/utils';
export type { GroupIndexDef, RowWithGroupKeys } from './pivot-table/components/utils';

// ─── Operator-timeline components ────────────────────────────────────────────
export { OperatorGanttChart } from './operator-timeline/OperatorGanttChart';
export type { OperatorGanttChartProps } from './operator-timeline/OperatorGanttChart';
export type { OperatorActiveSpanEntry } from './operator-timeline/types';
export {
  clipRectByRect,
  OPERATOR_TIMELINE_ROW_TYPE,
  operatorTimelineRowId,
  workerIdFromOperatorTimelineRowId,
  getWorkerIdsFromPlanTree,
  getPlanIdsForWorker,
  stackOperatorsIntoRows,
  spanToMs,
  operatorsWithActiveSpans,
  operatorsWithActiveSpansForWorker,
} from './operator-timeline/utils';

// ─── Feature hooks and state ──────────────────────────────────────────────────
// DAG hooks
export { useSelectedNodeIds, useSetSelectedNodeIds } from './dag/hooks/useSelectedNodeIds';
export {
  useSelectedOperatorLabel,
  useSetSelectedOperatorLabel,
} from './dag/hooks/useSelectedOperatorLabel';
export { useSelectedPlanId, useSetSelectedPlanId } from './dag/hooks/useSelectedPlanId';
export { useHoveredWorkerId, useSetHoveredWorkerId } from './dag/hooks/useHoveredWorkerId';

// Timeline hooks
export {
  useTimelineData,
  useZoomRange,
  useSetZoomRange,
  useDebouncedZoomRange,
  useSetDebouncedZoomRange,
  useTimelineHover,
  useSetTimelineHover,
  useStartTimeMs,
  useSetStartTimeMs,
  useBulkInitialized,
  useSetBulkInitialized,
  useVisibleEntries,
  useSetVisibleEntries,
  useHideTasks,
  useSetHideTasks,
  useHydrateTimelineAtoms,
} from '@quent/resource-timeline';

// Timeline cache key helpers (consumers need these to address per-item data)
export { timelineCacheKey } from '@quent/resource-timeline';
export type { TimelineCacheParams, TimelineHoverState } from '@quent/resource-timeline';
export { bulkEntryId } from '@quent/resource-timeline';

// Complex timeline hooks
export { useBulkTimelines } from '@quent/resource-timeline';
export type { TreeNode } from '@quent/resource-timeline';
export {
  useBulkTimelineFetch,
  applyBulkTimelineResponse,
  buildMergedBulkEntries,
} from '@quent/resource-timeline';
export type { BulkTimelineIdMeta, MergedBulkEntries } from '@quent/resource-timeline';

// Highlighted items hook
export { useHighlightedItemIds } from './timeline-ui/hooks/useHighlightedItemIds';

// DAG controls hooks (computation functions injected for reusable DAG computations)
export {
  useDagNodeColoring,
  useDagEdgeWidthConfig,
  useDagEdgeColoring,
  useOperatorStatFields,
  usePortStatFields,
} from './dag/hooks/useDagControls';

// DAG node coloring hook (accepts isDark instead of useTheme for decoupling)
export { useNodeColoring } from './dag/hooks/useNodeColoring';

// DAG control selector hooks (wrapping private atoms per HOOKS-02)
export {
  useSelectedColorField,
  useNodeColoringValue,
  useSetNodeColoring,
  useNodeColorPalette,
  useSelectedEdgeWidthField,
  useEdgeWidthConfig,
  useSelectedEdgeColorField,
  useEdgeColoring,
  useEdgeColorPalette,
  useSelectedNodeLabelField,
  useSelectedDagLayoutDirection,
  useSelectedNodeData,
  useSetSelectedNodeData,
  useHighlightedNodeIds,
  useSetHighlightedNodeIds,
  useEffectiveHighlightedNodeIds,
  useEffectiveHoveredStat,
  useHoveredStat,
  useSetHoveredStat,
  useSetDagDisplayedNodeIds,
} from './dag/hooks/dagControlSelectors';
export type {
  HoveredStatInfo,
  HighlightedNodeIdsState,
  InspectedNodeData,
} from './dag/state/dagControls';

// Data-flow overlay hooks (HOOKS-02: selector hooks over private atoms)
export {
  useDataFlowEnabled,
  useSetDataFlowEnabled,
  usePlayheadTimeS,
  useSetPlayheadTimeS,
  useSelectedDataFlowMeasure,
  useSetSelectedDataFlowMeasure,
  useDataFlowLabelMeasure,
  useSetDataFlowLabelMeasure,
  useDataFlowSelectedDimensions,
  useSetDataFlowSelectedDimensions,
  useDataFlowMeta,
  useDataFlowFrame,
} from './dag/data-flow/dataFlowSelectors';
export { useDataFlowSync } from './dag/data-flow/useDataFlowSync';
export {
  normalizeDataFlowResponse,
  isDataFlowAvailable,
  resolveDataFlowWindow,
  resolveDataFlowMeasure,
  resolveDataFlowLabelMeasure,
  resolveDataFlowDimensions,
  formatDataFlowValue,
  formatDataFlowValueCompact,
  fitDataFlowSegmentLabel,
} from './dag/data-flow/dataFlow.utils';
export type {
  DataFlowBinConfig,
  DataFlowMeta,
  DataFlowFrame,
  DataFlowOperatorFrame,
} from './dag/data-flow/dataFlow.utils';

// Utility hooks
export { useDeferredReady } from '@quent/resource-timeline';

// Pivot-table hooks
export { useColumnDragDrop } from './pivot-table/hooks/useColumnDragDrop';
export type { DropPosition } from './pivot-table/hooks/useColumnDragDrop';
export { useStatGroupTableControls } from './pivot-table/hooks/useStatGroupTableControls';
export type { AggMode } from './pivot-table/state/pivotTable';

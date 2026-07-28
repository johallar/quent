// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { SelectField, type SelectFieldOption } from '../ui/select-field';
import {
  useSelectedColorField,
  useSelectedEdgeWidthField,
  useSelectedEdgeColorField,
  useSelectedNodeLabelField,
  useSelectedDagLayoutDirection,
  useNodeColorPalette,
  useEdgeColorPalette,
  useDataFlowEnabled,
  useSetDataFlowEnabled,
  useDataFlowMeta,
  useSelectedDataFlowMeasure,
  useSetSelectedDataFlowMeasure,
  useDataFlowLabelMeasure,
  useSetDataFlowLabelMeasure,
  useSetDataFlowSelectedDimensions,
  resolveDataFlowMeasure,
} from '@quent/hooks';
import {
  cn,
  NODE_LABEL_FIELD,
  DAG_LAYOUT_DIRECTION,
  type NodeLabelField,
  type DagLayoutDirection,
} from '@quent/utils';
import { Palette, Spline, Brush, Type, ArrowUpDown, Gauge, Tags, Layers } from 'lucide-react';
import { PalettePicker } from './PalettePicker';
import { DAGControlField, DAGControlGrid, DAGControlSection } from './DAGControlSection';

interface DAGControlsProps {
  operatorStatFields: string[];
  portStatFields: string[];
  /** Whether dark mode is active. Passed explicitly to decouple from ThemeContext. */
  isDark: boolean;
}

const NODE_LABEL_OPTIONS: SelectFieldOption[] = [
  { value: NODE_LABEL_FIELD.NAME, label: 'Name' },
  { value: NODE_LABEL_FIELD.ID, label: 'ID' },
  { value: NODE_LABEL_FIELD.TYPE, label: 'Type' },
];

const LAYOUT_DIRECTION_OPTIONS: SelectFieldOption[] = [
  { value: DAG_LAYOUT_DIRECTION.BOTTOM_TO_TOP, label: 'Bottom to top' },
  { value: DAG_LAYOUT_DIRECTION.TOP_TO_BOTTOM, label: 'Top to bottom' },
];

interface DimensionOption {
  key: string;
  display_name: string;
}

interface RequiredDimensionFieldProps {
  label: string;
  options: DimensionOption[];
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
}

function RequiredDimensionField({
  label,
  options,
  selected,
  onToggle,
}: RequiredDimensionFieldProps) {
  return (
    <DAGControlField label={label} icon={Layers} align="start" className="lg:col-span-2">
      <fieldset>
        <legend className="sr-only">{label}</legend>
        <div className="flex flex-wrap gap-x-3 gap-y-1.5">
          {options.map(option => {
            const checked = selected.has(option.key);
            const isLastChecked = checked && selected.size <= 1;
            return (
              <label
                key={option.key}
                className={cn(
                  'flex h-6 cursor-pointer items-center gap-1.5 rounded-sm border px-2 text-xs transition-colors',
                  checked
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:bg-accent',
                  isLastChecked && 'cursor-default'
                )}
              >
                <input
                  type="checkbox"
                  data-testid="flow-tier-toggle"
                  checked={checked}
                  disabled={isLastChecked}
                  onChange={() => onToggle(option.key)}
                  className="size-3 cursor-pointer accent-primary disabled:cursor-default"
                />
                <span>{option.display_name}</span>
              </label>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] leading-tight text-muted-foreground">
          Select one or more. At least one location is required.
        </p>
      </fieldset>
    </DAGControlField>
  );
}

/** DAG visual control toolbar: node color, edge width, edge color, node label field selectors. */
export const DAGControls = ({ operatorStatFields, portStatFields, isDark }: DAGControlsProps) => {
  const [colorField, setColorField] = useSelectedColorField();
  const [edgeWidthField, setEdgeWidthField] = useSelectedEdgeWidthField();
  const [edgeColorField, setEdgeColorField] = useSelectedEdgeColorField();
  const [nodeLabelField, setNodeLabelField] = useSelectedNodeLabelField();
  const [layoutDirection, setLayoutDirection] = useSelectedDagLayoutDirection();
  const [nodePalette, setNodePalette] = useNodeColorPalette();
  const [edgePalette, setEdgePalette] = useEdgeColorPalette();
  const dataFlowEnabled = useDataFlowEnabled();
  const setDataFlowEnabled = useSetDataFlowEnabled();
  const dataFlowMeta = useDataFlowMeta();
  const selectedDataFlowMeasure = useSelectedDataFlowMeasure();
  const setSelectedDataFlowMeasure = useSetSelectedDataFlowMeasure();
  const dataFlowLabelMeasure = useDataFlowLabelMeasure();
  const setDataFlowLabelMeasure = useSetDataFlowLabelMeasure();
  const setDataFlowSelectedDimensions = useSetDataFlowSelectedDimensions();

  const operatorOptions: SelectFieldOption[] = operatorStatFields.map(f => ({ value: f }));
  const portOptions: SelectFieldOption[] = portStatFields.map(f => ({ value: f }));

  const measureOptions: SelectFieldOption[] = (dataFlowMeta?.decl.measures ?? []).map(m => ({
    value: m.name,
    label: m.display_name,
  }));
  const effectiveMeasure = dataFlowMeta
    ? resolveDataFlowMeasure(selectedDataFlowMeasure, dataFlowMeta.decl)
    : null;

  // The resolved selection is never empty; a full selection normalizes to "all".
  const dimensionKeys = dataFlowMeta?.decl.dimension_keys ?? [];
  const dimensionSelection = dataFlowMeta?.dimensionSelection;
  const toggleDimension = (key: string) => {
    if (!dimensionSelection) return;
    const next = new Set(dimensionSelection);
    if (next.has(key)) {
      if (next.size <= 1) return;
      next.delete(key);
    } else {
      next.add(key);
    }
    // Normalize a full selection back to `null` (= all, survives new keys).
    setDataFlowSelectedDimensions(next.size === dimensionKeys.length ? null : next);
  };

  return (
    <div className="space-y-3 bg-card p-3">
      <DAGControlSection title="Plan controls">
        <DAGControlGrid>
          <DAGControlField
            label="Node color"
            icon={Palette}
            trailingAdornment={
              <PalettePicker value={nodePalette} onValueChange={setNodePalette} isDark={isDark} />
            }
          >
            <SelectField
              ariaLabel="Node color"
              options={operatorOptions}
              value={colorField ?? ''}
              onValueChange={setColorField}
              placeholder="None"
              triggerClassName="h-6 text-xs"
            />
          </DAGControlField>
          <DAGControlField label="Edge width" icon={Spline}>
            <SelectField
              ariaLabel="Edge width"
              options={portOptions}
              value={edgeWidthField ?? ''}
              onValueChange={setEdgeWidthField}
              placeholder="None"
              triggerClassName="h-6 text-xs"
            />
          </DAGControlField>
          <DAGControlField
            label="Edge color"
            icon={Brush}
            trailingAdornment={
              <PalettePicker value={edgePalette} onValueChange={setEdgePalette} isDark={isDark} />
            }
          >
            <SelectField
              ariaLabel="Edge color"
              options={portOptions}
              value={edgeColorField ?? ''}
              onValueChange={setEdgeColorField}
              placeholder="None"
              triggerClassName="h-6 text-xs"
            />
          </DAGControlField>
          <DAGControlField label="Node label" icon={Type}>
            <SelectField
              ariaLabel="Node label"
              options={NODE_LABEL_OPTIONS}
              value={nodeLabelField}
              onValueChange={v => v && setNodeLabelField(v as NodeLabelField)}
              placeholder="Name"
              clearable={false}
              triggerClassName="h-6 text-xs"
            />
          </DAGControlField>
          <DAGControlField label="Layout direction" icon={ArrowUpDown}>
            <SelectField
              ariaLabel="Layout direction"
              options={LAYOUT_DIRECTION_OPTIONS}
              value={layoutDirection}
              onValueChange={v => v && setLayoutDirection(v as DagLayoutDirection)}
              placeholder="Bottom to top"
              clearable={false}
              triggerClassName="h-6 text-xs"
            />
          </DAGControlField>
        </DAGControlGrid>
      </DAGControlSection>

      {dataFlowMeta && (
        <DAGControlSection
          title="Data flow"
          action={
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={dataFlowEnabled}
                onChange={e => setDataFlowEnabled(e.target.checked)}
                className="size-3 cursor-pointer accent-primary"
              />
              Enabled
            </label>
          }
        >
          <DAGControlGrid>
            {measureOptions.length > 1 && (
              <DAGControlField label="Flow measure" icon={Gauge}>
                <SelectField
                  ariaLabel="Flow measure"
                  options={measureOptions}
                  value={effectiveMeasure ?? ''}
                  onValueChange={v => v && setSelectedDataFlowMeasure(v)}
                  placeholder="Measure"
                  clearable={false}
                  triggerClassName="h-6 text-xs"
                />
              </DAGControlField>
            )}
            {measureOptions.length > 1 && (
              <DAGControlField label="Bar labels" icon={Tags}>
                <SelectField
                  ariaLabel="Bar labels"
                  options={measureOptions}
                  value={dataFlowLabelMeasure ?? ''}
                  onValueChange={setDataFlowLabelMeasure}
                  placeholder="Follow measure"
                  triggerClassName="h-6 text-xs"
                />
              </DAGControlField>
            )}
            {dimensionSelection && dimensionKeys.length > 1 && (
              <RequiredDimensionField
                label={dataFlowMeta.decl.dimension_name}
                options={dimensionKeys}
                selected={dimensionSelection}
                onToggle={toggleDimension}
              />
            )}
          </DAGControlGrid>
        </DAGControlSection>
      )}
    </div>
  );
};

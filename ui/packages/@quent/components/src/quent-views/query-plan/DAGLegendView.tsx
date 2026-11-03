// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Panel } from '@xyflow/react';
import { CategoricalLegend } from '../../ui/legend/CategoricalLegend';
import { ContinuousLegend } from '../../ui/legend/ContinuousLegend';

export interface DAGContinuousLegendSection {
  kind: 'continuous';
  id: string;
  label: string;
  min: number;
  max: number;
  gradientStops: string[];
  formatValue: (value: number) => string;
  scaleLabel: string;
}

export interface DAGCategoricalLegendSection {
  kind: 'categorical';
  id: string;
  label: string;
  categoryMap: ReadonlyMap<string, string>;
  dimmedLabels?: ReadonlySet<string>;
  entrySuffixes?: ReadonlyMap<string, string>;
}

export type DAGLegendSection = DAGContinuousLegendSection | DAGCategoricalLegendSection;

export interface DAGLegendViewProps {
  sections: readonly DAGLegendSection[];
}

/** Provider-free DAG legend driven by preformatted presentation sections. */
export function DAGLegendView({ sections }: DAGLegendViewProps) {
  if (sections.length === 0) {
    return null;
  }

  return (
    <Panel position="bottom-left" className="min-w-[175px] max-w-[40%]">
      <div className="flex min-w-0 max-w-full flex-col gap-2.5 overflow-hidden rounded-md border bg-card/90 px-3 py-2.5 text-card-foreground shadow-md backdrop-blur-sm">
        {sections.map((section, index) => (
          <div
            key={section.id}
            className={index === 0 ? undefined : 'border-t border-border pt-2.5'}
          >
            {section.kind === 'continuous' ? (
              <ContinuousLegend
                label={section.label}
                min={section.min}
                max={section.max}
                gradientStops={section.gradientStops}
                formatValue={section.formatValue}
                scaleLabel={section.scaleLabel}
              />
            ) : (
              <CategoricalLegend
                label={section.label}
                categoryMap={section.categoryMap}
                dimmedLabels={section.dimmedLabels}
                entrySuffixes={section.entrySuffixes}
              />
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

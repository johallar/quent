// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EntityTooltipContent, TooltipContent, type ActiveMark } from './TimelineTooltip';
import type { DynamicValue } from '@quent/utils';

// The Rust `DynamicValue` enum serializes externally tagged. This is the shape the
// server actually sends, even though the generated TS type is untagged.
const tagged = (v: object) => v as unknown as DynamicValue;

describe('TooltipContent active marks', () => {
  const series = [{ color: '#8884d8', name: 'computing', value: 1 }];

  const renderWithMarks = (marks: ActiveMark[]) =>
    render(<TooltipContent timestamp={3360} series={series} windowMs={5300} activeMarks={marks} />);

  it('renders attribute rows with byte and rate formatting', () => {
    renderWithMarks([
      {
        label: 'task',
        stateName: 'computing',
        color: '#ff0000',
        durationMs: 750,
        attributes: [
          { key: 'input_bytes', value: tagged({ U64: 1_500_000_000 }) },
          { key: 'current_operator_id', value: tagged({ U32: 11 }) },
        ],
        derivedAttributes: [{ key: 'bytes_per_sec', value: tagged({ F64: 2_000_000_000 }) }],
      },
    ]);

    expect(screen.getByText('input_bytes')).toBeInTheDocument();
    expect(screen.getByText('1.40 GiB')).toBeInTheDocument();
    expect(screen.getByText('current_operator_id')).toBeInTheDocument();
    expect(screen.getByText('11')).toBeInTheDocument();
    expect(screen.getByText('duration')).toBeInTheDocument();
    expect(screen.getByText('750.00ms')).toBeInTheDocument();
    expect(screen.getByText('derived')).toBeInTheDocument();
    expect(screen.getByText('bytes_per_sec')).toBeInTheDocument();
    expect(screen.getByText('2.00 GB/s')).toBeInTheDocument();
  });

  it('wraps long string attributes (e.g. a synthesized pipeline chain)', () => {
    renderWithMarks([
      {
        label: 'task-21',
        stateName: 'computing',
        color: '#ff0000',
        durationMs: 26,
        derivedAttributes: [
          {
            key: 'pipeline',
            value: tagged({ String: 'GPU_SCAN(11) -> PROJECTION(6) -> HASH_GROUP_BY(8)' }),
          },
        ],
      },
    ]);

    expect(screen.getByText('pipeline')).toBeInTheDocument();
    expect(
      screen.getByText('GPU_SCAN(11) -> PROJECTION(6) -> HASH_GROUP_BY(8)')
    ).toBeInTheDocument();
  });

  it('renders marks without attributes as before', () => {
    renderWithMarks([{ label: 'task-0', stateName: 'sending', color: '#0000ff' }]);
    expect(screen.getByText('task-0')).toBeInTheDocument();
    expect(screen.getByText('sending')).toBeInTheDocument();
  });

  it('renders entity-only content without a timeline total', () => {
    render(
      <EntityTooltipContent
        timestamp={1_000}
        windowMs={5_000}
        activeMarks={[
          {
            label: 'task-0',
            stateName: 'loading',
            color: '#0000ff',
            durationMs: 500,
          },
        ]}
      />
    );
    expect(screen.getByText('task-0')).toBeInTheDocument();
    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
  });

  it('caps visible marks and reports how many were hidden', () => {
    render(
      <EntityTooltipContent
        timestamp={1_000}
        windowMs={5_000}
        itemLimit={2}
        activeMarks={[
          { label: 'a', stateName: 'one', color: '#000' },
          { label: 'b', stateName: 'two', color: '#000' },
          { label: 'c', stateName: 'three', color: '#000' },
        ]}
      />
    );
    expect(screen.getByText('one')).toBeInTheDocument();
    expect(screen.getByText('two')).toBeInTheDocument();
    expect(screen.queryByText('three')).not.toBeInTheDocument();
    expect(screen.getByText('1 more not shown')).toBeInTheDocument();
  });

  it('renders a compact name + count list with a totals summary', () => {
    render(
      <EntityTooltipContent
        timestamp={1_000}
        windowMs={5_000}
        summary="6 ranges"
        itemLimit={2}
        activeMarks={[
          { label: 'read_parquet', stateName: '4 ranges', color: '#7c3aed', compact: true },
          { label: 'copy_if', stateName: '2 ranges', color: '#2563eb', compact: true },
          { label: 'kernel', stateName: '1 range', color: '#000', compact: true },
        ]}
      />
    );
    expect(screen.getByText('6 ranges')).toBeInTheDocument();
    expect(screen.getByText('read_parquet')).toBeInTheDocument();
    expect(screen.getByText('4 ranges')).toBeInTheDocument();
    expect(screen.getByText('copy_if')).toBeInTheDocument();
    expect(screen.queryByText('kernel')).not.toBeInTheDocument();
    expect(screen.getByText('1 more not shown')).toBeInTheDocument();
  });
});

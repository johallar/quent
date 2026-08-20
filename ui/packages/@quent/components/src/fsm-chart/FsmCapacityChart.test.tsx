// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FsmTransition } from '@quent/utils';
import { FsmCapacityChart } from './FsmCapacityChart';

// ECharts renders to canvas and is not testable in jsdom; stub it out.
vi.mock('echarts-for-react/lib/core', () => ({
  default: () => <div data-testid="echarts" />,
}));

vi.mock('../lib/echarts', () => ({ echarts: {} }));
vi.mock('../lib/useChartResize', () => ({ useChartResize: () => ({ handleChartReady: vi.fn() }) }));
vi.mock('../timeline/timelineEchartsTheme', () => ({
  useTimelineEchartsTheme: () => ({ themeName: 'light' }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function transition(
  name: string,
  timestamp: number,
  usages: FsmTransition['usages'] = []
): FsmTransition {
  return { name, timestamp, usages, attributes: [], derived_attributes: [] };
}

function usage(resource: string, caps: Record<string, bigint | null>): FsmTransition['usages'][0] {
  return { resource, capacities: Object.entries(caps) };
}

const BYTES_SPEC = {
  symbol: 'B',
  singular: 'byte',
  plural: 'bytes',
  occupancy_prefix: 'binary',
  rate_prefix: 'decimal',
} as const;

const UNIT_SPEC = {
  symbol: '',
  singular: 'unit',
  plural: 'units',
  occupancy_prefix: 'none',
  rate_prefix: 'none',
} as const;

const RATE_SPEC = {
  symbol: 'B/s',
  singular: 'byte per second',
  plural: 'bytes per second',
  occupancy_prefix: 'binary',
  rate_prefix: 'decimal',
} as const;

const defaultProps = {
  isDark: false,
  resourceLabel: (id: string) => id,
  quantitySpecs: { bytes: BYTES_SPEC, unit: UNIT_SPEC },
  getCapacityDecl: () => undefined,
} as const;

// Two transitions are the minimum for a capacity to appear (≥2 readings).
const TWO_TRANSITIONS = [
  transition('running', 0, [usage('mem-1', { capacity_bytes: 1024n })]),
  transition('idle', 1, [usage('mem-1', { capacity_bytes: 2048n })]),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FsmCapacityChart', () => {
  describe('rendering', () => {
    it('renders nothing when there are no transitions', () => {
      const { container } = render(<FsmCapacityChart {...defaultProps} transitions={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when all capacities have fewer than 2 readings', () => {
      const transitions = [
        transition('running', 0, [usage('mem-1', { capacity_bytes: 1024n })]),
      ];
      const { container } = render(<FsmCapacityChart {...defaultProps} transitions={transitions} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the chart when at least one capacity has ≥2 readings', () => {
      render(<FsmCapacityChart {...defaultProps} transitions={TWO_TRANSITIONS} />);
      expect(screen.getByTestId('echarts')).toBeInTheDocument();
    });

    it('shows the capacity stat label in the header', () => {
      const getCapacityDecl = (_id: string, name: string) =>
        name === 'capacity_bytes'
          ? { name: 'capacity_bytes', kind: 'Occupancy' as const, quantity: 'bytes' }
          : undefined;

      render(
        <FsmCapacityChart
          {...defaultProps}
          transitions={TWO_TRANSITIONS}
          getCapacityDecl={getCapacityDecl}
        />
      );

      expect(screen.getByText('capacity_bytes (B)')).toBeInTheDocument();
    });

    it('shows the bare capacity name when its quantity has no symbol (dimensionless)', () => {
      const getCapacityDecl = (_id: string, name: string) =>
        name === 'unit'
          ? { name: 'unit', kind: 'Occupancy' as const, quantity: 'unit' }
          : undefined;

      const transitions = [
        transition('running', 0, [usage('cpu-1', { unit: 1n })]),
        transition('idle', 1, [usage('cpu-1', { unit: 1n })]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          transitions={transitions}
          getCapacityDecl={getCapacityDecl}
        />
      );

      expect(screen.getByText('unit')).toBeInTheDocument();
    });
  });

  describe('resource selector', () => {
    it('hides the resource selector when only one resource has data', () => {
      render(<FsmCapacityChart {...defaultProps} transitions={TWO_TRANSITIONS} />);
      expect(screen.queryByRole('combobox', { name: 'Select resource' })).not.toBeInTheDocument();
    });

    it('shows the resource selector when multiple resources have data', () => {
      const transitions = [
        transition('running', 0, [
          usage('mem-1', { capacity_bytes: 1024n }),
          usage('cpu-1', { unit: 1n }),
        ]),
        transition('idle', 1, [
          usage('mem-1', { capacity_bytes: 2048n }),
          usage('cpu-1', { unit: 1n }),
        ]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => (id === 'mem-1' ? 'Memory' : 'CPU')}
          transitions={transitions}
        />
      );

      expect(screen.getByRole('combobox', { name: 'Select resource' })).toBeInTheDocument();
    });

    it('lists all resources with data in the resource selector', () => {
      const transitions = [
        transition('running', 0, [
          usage('mem-1', { capacity_bytes: 1024n }),
          usage('cpu-1', { unit: 1n }),
        ]),
        transition('idle', 1, [
          usage('mem-1', { capacity_bytes: 2048n }),
          usage('cpu-1', { unit: 1n }),
        ]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => (id === 'mem-1' ? 'Memory' : 'CPU')}
          transitions={transitions}
        />
      );

      const select = screen.getByRole('combobox', { name: 'Select resource' });
      const options = Array.from(select.querySelectorAll('option')).map(o => o.textContent);
      expect(options).toContain('Memory');
      expect(options).toContain('CPU');
    });
  });

  describe('capacity selector', () => {
    it('hides the capacity selector when the active resource has only one capacity', () => {
      render(<FsmCapacityChart {...defaultProps} transitions={TWO_TRANSITIONS} />);
      expect(screen.queryByRole('combobox', { name: 'Select capacity' })).not.toBeInTheDocument();
    });

    it('shows the capacity selector when the active resource has multiple capacities', () => {
      const transitions = [
        transition('running', 0, [usage('mem-1', { capacity_bytes: 1024n, unit: 1n })]),
        transition('idle', 1, [usage('mem-1', { capacity_bytes: 2048n, unit: 1n })]),
      ];

      render(<FsmCapacityChart {...defaultProps} transitions={transitions} />);

      expect(screen.getByRole('combobox', { name: 'Select capacity' })).toBeInTheDocument();
    });

    it('lists all capacities for the active resource', () => {
      const transitions = [
        transition('running', 0, [usage('mem-1', { capacity_bytes: 1024n, unit: 1n })]),
        transition('idle', 1, [usage('mem-1', { capacity_bytes: 2048n, unit: 1n })]),
      ];

      render(<FsmCapacityChart {...defaultProps} transitions={transitions} />);

      const select = screen.getByRole('combobox', { name: 'Select capacity' });
      const options = Array.from(select.querySelectorAll('option')).map(o => o.value);
      expect(options).toContain('capacity_bytes');
      expect(options).toContain('unit');
    });

    it('resets the capacity selection when the resource changes', () => {
      const getCapacityDecl = (_id: string, name: string) => {
        if (name === 'capacity_bytes')
          return { name: 'capacity_bytes', kind: 'Occupancy' as const, quantity: 'bytes' };
        if (name === 'rate_bytes')
          return { name: 'rate_bytes', kind: 'Rate' as const, quantity: 'rate' };
        return undefined;
      };

      const transitions = [
        transition('running', 0, [
          usage('mem-1', { capacity_bytes: 1024n }),
          usage('fs-1', { capacity_bytes: 512n, rate_bytes: 100n }),
        ]),
        transition('idle', 1, [
          usage('mem-1', { capacity_bytes: 2048n }),
          usage('fs-1', { capacity_bytes: 1024n, rate_bytes: 200n }),
        ]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => (id === 'mem-1' ? 'Memory' : 'Filesystem')}
          quantitySpecs={{ bytes: BYTES_SPEC, rate: RATE_SPEC }}
          getCapacityDecl={getCapacityDecl}
          transitions={transitions}
        />
      );

      // Switch to Filesystem and select rate_bytes
      const resourceSelect = screen.getByRole('combobox', { name: 'Select resource' });
      fireEvent.change(resourceSelect, { target: { value: 'fs-1' } });

      const capacitySelect = screen.getByRole('combobox', { name: 'Select capacity' });
      fireEvent.change(capacitySelect, { target: { value: 'rate_bytes' } });
      expect(screen.getByText('rate_bytes (B/s)')).toBeInTheDocument();

      // Switch back to Memory — capacity should reset to its first capacity
      fireEvent.change(resourceSelect, { target: { value: 'mem-1' } });
      expect(screen.getByText('capacity_bytes (B)')).toBeInTheDocument();
    });
  });

  describe('defaultCapacityPredicate', () => {
    it('defaults to the first capacity when no predicate is provided', () => {
      // unit appears before capacity_bytes in insertion order
      const transitions = [
        transition('running', 0, [usage('mem-1', { unit: 1n, capacity_bytes: 1024n })]),
        transition('idle', 1, [usage('mem-1', { unit: 1n, capacity_bytes: 2048n })]),
      ];

      render(<FsmCapacityChart {...defaultProps} transitions={transitions} />);

      // Without a predicate, insertion order wins — unit is first
      expect(screen.getByText('unit', { selector: 'span' })).toBeInTheDocument();
    });

    it('sorts the preferred capacity to the front when a predicate is provided', () => {
      const getCapacityDecl = (_id: string, name: string) =>
        name === 'capacity_bytes'
          ? { name: 'capacity_bytes', kind: 'Occupancy' as const, quantity: 'bytes' }
          : undefined;

      // unit is inserted before capacity_bytes
      const transitions = [
        transition('running', 0, [usage('mem-1', { unit: 1n, capacity_bytes: 1024n })]),
        transition('idle', 1, [usage('mem-1', { unit: 1n, capacity_bytes: 2048n })]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          transitions={transitions}
          getCapacityDecl={getCapacityDecl}
          defaultCapacityPredicate={name => name === 'capacity_bytes'}
        />
      );

      // Predicate pushes capacity_bytes to front — it becomes the default
      expect(screen.getByText('capacity_bytes (B)')).toBeInTheDocument();
    });

    it('sorts resources with the preferred capacity to the front', () => {
      const transitions = [
        transition('running', 0, [
          usage('cpu-1', { unit: 1n }),
          usage('mem-1', { capacity_bytes: 1024n }),
        ]),
        transition('idle', 1, [
          usage('cpu-1', { unit: 1n }),
          usage('mem-1', { capacity_bytes: 2048n }),
        ]),
      ];

      render(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => (id === 'mem-1' ? 'Memory' : 'CPU')}
          transitions={transitions}
          defaultCapacityPredicate={name => name === 'capacity_bytes'}
        />
      );

      // Memory (with capacity_bytes) should be the active resource by default
      const resourceSelect = screen.getByRole('combobox', { name: 'Select resource' });
      expect((resourceSelect as HTMLSelectElement).value).toBe('mem-1');
    });
  });

  describe('entity change', () => {
    it('resets selections when transitions change', () => {
      const getCapacityDecl = (_id: string, name: string) =>
        name === 'capacity_bytes'
          ? { name: 'capacity_bytes', kind: 'Occupancy' as const, quantity: 'bytes' }
          : undefined;

      const firstTransitions = [
        transition('running', 0, [
          usage('mem-1', { capacity_bytes: 1024n }),
          usage('mem-2', { capacity_bytes: 512n }),
        ]),
        transition('idle', 1, [
          usage('mem-1', { capacity_bytes: 2048n }),
          usage('mem-2', { capacity_bytes: 1024n }),
        ]),
      ];

      const { rerender } = render(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => id}
          getCapacityDecl={getCapacityDecl}
          transitions={firstTransitions}
        />
      );

      // Select the second resource
      const resourceSelect = screen.getByRole('combobox', { name: 'Select resource' });
      fireEvent.change(resourceSelect, { target: { value: 'mem-2' } });
      expect((resourceSelect as HTMLSelectElement).value).toBe('mem-2');

      // Simulate opening a different entity (new transitions reference)
      const secondTransitions = [
        transition('running', 0, [usage('mem-1', { capacity_bytes: 1024n })]),
        transition('idle', 1, [usage('mem-1', { capacity_bytes: 2048n })]),
      ];

      rerender(
        <FsmCapacityChart
          {...defaultProps}
          resourceLabel={id => id}
          getCapacityDecl={getCapacityDecl}
          transitions={secondTransitions}
        />
      );

      // Resource selector should be gone (only one resource) and mem-1 is active
      expect(screen.queryByRole('combobox', { name: 'Select resource' })).not.toBeInTheDocument();
      expect(screen.getByText('capacity_bytes (B)')).toBeInTheDocument();
    });
  });
});

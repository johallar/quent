// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Provider as JotaiProvider, createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@/test/test-utils';
import { ThemeProvider } from '@/contexts/ThemeContext';
import {
  buildQueryDiffRows,
  formatSignedDiffValue,
  formatSignedPercentDelta,
  getDeltaCellStyle,
} from './QueryDiffTable.utils';
import { QueryDiffTable } from './QueryDiffTable';
import {
  baselineDiffQueryFixture,
  comparisonDiffQueryFixture,
  equalPlanQueryDiffFixture,
} from '@/test/mocks/queryProfileDiffFixtures';
import { DIFF_NEGATIVE_COLOR, DIFF_POSITIVE_COLOR } from './QueryDiffColors';

function renderQueryDiffTable() {
  const store = createStore();
  return render(
    <JotaiProvider store={store}>
      <ThemeProvider>
        <div className="h-[600px]">
          <QueryDiffTable
            baselineQuery={baselineDiffQueryFixture}
            comparisons={[
              {
                id: 'comparison-1',
                comparisonQuery: comparisonDiffQueryFixture,
                diff: equalPlanQueryDiffFixture,
              },
            ]}
          />
        </div>
      </ThemeProvider>
    </JotaiProvider>
  );
}

describe('QueryDiffTable helpers', () => {
  it('converts matched operator diffs into pivot rows', () => {
    const rows = buildQueryDiffRows(
      baselineDiffQueryFixture,
      comparisonDiffQueryFixture,
      equalPlanQueryDiffFixture
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      engineGroupId: 'engine-b',
      engineGroupLabel: 'Engine B',
      engines: [{ id: 'engine-b', label: 'Engine B' }],
      queryGroupId: 'group-2',
      queryGroupLabel: 'Group 2',
      operatorType: 'Scan',
      operatorLabel: 'Scan orders <-> Scan orders\nscan-a <-> scan-b',
      operatorPairId: 'query-b:scan-a:scan-b',
      operatorAId: 'scan-a',
      operatorALabel: 'Scan orders',
      operatorBId: 'scan-b',
      operatorBLabel: 'Scan orders',
      stats: {
        duration_s: -2,
        input_rows: 200,
      },
      statDetails: {
        duration_s: {
          baseline: 12,
          comparison: 10,
          delta: -2,
          percentDelta: -0.2,
        },
        input_rows: {
          baseline: 1000,
          comparison: 1200,
          delta: 200,
          percentDelta: 0.1666666667,
        },
      },
    });
  });

  it('formats numeric deltas with signs', () => {
    expect(formatSignedDiffValue(12, 'input_rows')).toBe('+12');
    expect(formatSignedDiffValue(-12, 'input_rows')).toBe('-12');
    expect(formatSignedDiffValue(0, 'input_rows')).toBe('0');
    expect(formatSignedDiffValue(null, 'input_rows')).toBe('-');
  });

  it('uses the operator table stat formatter for delta values', () => {
    expect(formatSignedDiffValue(1536, 'buffer_bytes')).toBe('+1.5 KiB');
    expect(formatSignedDiffValue(-0.125, 'probe_selectivity')).toBe('-12.5%');
  });

  it('formats percent deltas with signs', () => {
    expect(formatSignedPercentDelta(0.2)).toBe('+20.0%');
    expect(formatSignedPercentDelta(-0.2)).toBe('-20.0%');
    expect(formatSignedPercentDelta(0)).toBe('0.0%');
    expect(formatSignedPercentDelta(null)).toBe('-');
  });

  it('returns diverging styles for positive and negative deltas only', () => {
    expect(getDeltaCellStyle(5, 10)?.backgroundColor).toContain(DIFF_POSITIVE_COLOR);
    expect(getDeltaCellStyle(-5, 10)?.backgroundColor).toContain(DIFF_NEGATIVE_COLOR);
    expect(getDeltaCellStyle(0, 10)).toBeUndefined();
    expect(getDeltaCellStyle(null, 10)).toBeUndefined();
  });
});

describe('QueryDiffTable', () => {
  it('orders group-by options and selects operator type plus comparison engine by default', () => {
    renderQueryDiffTable();

    const groupByToolbar = screen.getByText('Group by:').parentElement!;
    const groupButtonLabels = within(groupByToolbar)
      .getAllByRole('button')
      .map(button => button.textContent)
      .filter(label =>
        ['Operator Type', 'Engine', 'Query Group', 'Operator Pair'].includes(label ?? '')
      );
    expect(groupButtonLabels).toEqual(['Operator Type', 'Engine', 'Query Group', 'Operator Pair']);

    const defaultGroupHeaders = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .slice(0, 2)
      .map(header => header.textContent);
    expect(defaultGroupHeaders).toEqual(['Operator Type', 'Engine']);
  });

  it('offers query group name as a group-by column', () => {
    renderQueryDiffTable();

    fireEvent.click(screen.getByRole('button', { name: 'Query Group' }));

    const groupHeaders = within(screen.getByRole('table'))
      .getAllByRole('columnheader')
      .slice(0, 3)
      .map(header => header.textContent);

    expect(groupHeaders).toEqual(['Operator Type', 'Engine', 'Query Group']);
  });

  it('allows comparison engine to be disabled as a group-by column', () => {
    renderQueryDiffTable();

    const engineButton = screen.getByRole('button', { name: 'Engine' });
    expect(engineButton).not.toHaveAttribute('aria-disabled');

    fireEvent.click(engineButton);

    const table = within(screen.getByRole('table'));
    expect(table.queryByRole('columnheader', { name: 'Engine' })).not.toBeInTheDocument();
    expect(table.getAllByRole('columnheader')[0]).toHaveTextContent('Operator Type');
  });

  it('allows comparison engine group to be reordered', () => {
    renderQueryDiffTable();

    const getGroupHeaders = () =>
      within(screen.getByRole('table'))
        .getAllByRole('columnheader')
        .slice(0, 2)
        .map(header => header.textContent);

    expect(getGroupHeaders()).toEqual(['Operator Type', 'Engine']);

    const dataTransfer = {
      effectAllowed: '',
      dropEffect: '',
      setData: vi.fn(),
    };
    fireEvent.dragStart(screen.getByRole('button', { name: 'Operator Type' }), {
      dataTransfer,
    });
    fireEvent.dragOver(screen.getByRole('button', { name: 'Engine' }), {
      dataTransfer,
    });
    fireEvent.drop(screen.getByRole('button', { name: 'Engine' }), {
      dataTransfer,
    });

    expect(getGroupHeaders()).toEqual(['Engine', 'Operator Type']);
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { describe, expect, it, vi } from 'vitest';
import { useSelectedColorField, useSetNodeColoring } from '@quent/hooks';
import { projectStatisticScalarFields } from '@quent/utils';
import { QueryPlanNode, type QueryPlanNodeData } from './QueryPlanNode';

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  Position: { Bottom: 'bottom', Top: 'top' },
}));

const statistics = [{ key: 'output_rows', value: 1536, quantity: 'bytes' }];
const field = projectStatisticScalarFields(statistics)[0];

function ColoringSetup() {
  const setNodeColoring = useSetNodeColoring();
  const [, setColorField] = useSelectedColorField();
  return (
    <button
      onClick={() => {
        setColorField(field.id);
        setNodeColoring({
          type: 'continuous',
          values: new Map([['operator-1', 1536]]),
          min: 1536,
          logMin: 1536,
          max: 1536,
        });
      }}
    >
      Color node
    </button>
  );
}

describe('QueryPlanNode statistic formatting', () => {
  it('uses the selected StatisticField quantity metadata', () => {
    const data: QueryPlanNodeData = {
      label: 'Scan',
      nodeId: 'operator-1',
      operationType: 'scan',
      metadata: {
        operatorStatistics: { statistics, fields: [field] },
        relatedOperatorStatistics: [],
      },
      quantitySpecs: {
        bytes: {
          symbol: 'B',
          singular: 'byte',
          plural: 'bytes',
          occupancy_prefix: 'Iec',
          rate_prefix: 'Si',
        },
      },
    };

    render(
      <Provider store={createStore()}>
        <ColoringSetup />
        <QueryPlanNode data={data} />
      </Provider>
    );
    fireEvent.click(screen.getByRole('button', { name: 'Color node' }));

    expect(screen.getByText('1.50 KiB')).toBeVisible();
  });
});

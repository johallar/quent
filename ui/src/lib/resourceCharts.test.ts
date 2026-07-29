// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { longEntitiesRowId, operatorTimelineRowId, type TreeTableItem } from '@quent/components';
import { EntityTypeKey } from '@quent/utils';
import {
  getEffectiveResourceCharts,
  getResourceChartAggregateState,
  injectResourceChartRows,
  setAllResourceCharts,
  setChartForResources,
  type ResourceChartType,
} from './resourceCharts';

const WORKER_ID = 'worker-1';
const GPU_ID = 'gpu-1';
const workerIds = new Set([WORKER_ID]);

function resource(id: string): TreeTableItem {
  return {
    id,
    type: EntityTypeKey.Resource,
    entity: {} as TreeTableItem['entity'],
  };
}

function root(): TreeTableItem {
  return {
    id: 'root',
    type: EntityTypeKey.ResourceGroup,
    entity: {} as TreeTableItem['entity'],
    children: [resource(WORKER_ID), resource(GPU_ID)],
  };
}

describe('resource chart selection', () => {
  it('uses contextual defaults and preserves an explicit empty selection', () => {
    const selections = new Map<string, ResourceChartType[]>();

    expect(getEffectiveResourceCharts(selections, WORKER_ID, workerIds)).toEqual(['operators']);
    expect(getEffectiveResourceCharts(selections, GPU_ID, workerIds)).toEqual(['entities']);

    selections.set(WORKER_ID, []);
    expect(getEffectiveResourceCharts(selections, WORKER_ID, workerIds)).toEqual([]);
  });

  it('injects selected rows as ordered siblings', () => {
    const selections = new Map<string, ResourceChartType[]>([
      [WORKER_ID, ['operators', 'entities']],
      [GPU_ID, []],
    ]);

    const result = injectResourceChartRows(root(), selections, workerIds);

    expect(result.children?.map(item => item.id)).toEqual([
      WORKER_ID,
      operatorTimelineRowId(WORKER_ID),
      longEntitiesRowId(WORKER_ID),
      GPU_ID,
    ]);
    expect(result.children?.slice(1, 3).map(item => item.isChartExpanded)).toEqual([true, true]);
  });

  it('retains deselected rows in a collapsed state while they animate out', () => {
    const rendered = new Map<string, ResourceChartType[]>([[GPU_ID, ['entities']]]);
    const selected = new Map<string, ResourceChartType[]>([[GPU_ID, []]]);

    const result = injectResourceChartRows(root(), rendered, workerIds, selected);
    const chartRow = result.children?.find(item => item.id === longEntitiesRowId(GPU_ID));

    expect(chartRow).toMatchObject({
      rowMinHeight: 0,
      estimatedRowHeight: 0,
      isChartExpanded: false,
    });
  });

  it('keeps operator charts under expanded worker groups', () => {
    const tree: TreeTableItem = {
      id: 'root',
      type: EntityTypeKey.ResourceGroup,
      entity: {} as TreeTableItem['entity'],
      children: [
        {
          id: WORKER_ID,
          type: EntityTypeKey.ResourceGroup,
          entity: {} as TreeTableItem['entity'],
          children: [resource(GPU_ID)],
        },
      ],
    };

    const result = injectResourceChartRows(tree, new Map(), workerIds);

    expect(result.children?.[0]?.children?.map(item => item.id)).toEqual([
      operatorTimelineRowId(WORKER_ID),
      GPU_ID,
      longEntitiesRowId(GPU_ID),
    ]);
  });

  it('derives mixed state and applies bulk chart changes', () => {
    const selections = new Map<string, ResourceChartType[]>([
      [WORKER_ID, ['operators']],
      [GPU_ID, ['entities']],
    ]);

    expect(
      getResourceChartAggregateState('entities', [WORKER_ID, GPU_ID], selections, workerIds)
    ).toBe('mixed');

    const shown = setChartForResources(
      selections,
      [WORKER_ID, GPU_ID],
      workerIds,
      'entities',
      true
    );
    expect(shown.get(WORKER_ID)).toEqual(['operators', 'entities']);
    expect(shown.get(GPU_ID)).toEqual(['entities']);
    expect(getResourceChartAggregateState('entities', [WORKER_ID, GPU_ID], shown, workerIds)).toBe(
      'all'
    );
  });

  it('shows or hides every eligible chart', () => {
    expect(setAllResourceCharts([WORKER_ID, GPU_ID], workerIds, true)).toEqual(
      new Map([
        [WORKER_ID, ['operators', 'entities']],
        [GPU_ID, ['entities']],
      ])
    );
    expect(setAllResourceCharts([WORKER_ID, GPU_ID], workerIds, false)).toEqual(
      new Map([
        [WORKER_ID, []],
        [GPU_ID, []],
      ])
    );
  });
});

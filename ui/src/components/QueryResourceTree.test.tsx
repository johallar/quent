// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { waitFor, act } from '@testing-library/react';
import { renderWithQuery } from '@/test/test-utils';
import { Provider as JotaiProvider, createStore } from 'jotai';
import { QueryResourceTree } from './QueryResourceTree';
import { applyBulkTimelineResponse, timelineCacheKey, useZoomRange } from '@quent/hooks';
import { timelineDataMapAtom } from '@quent/hooks/testing';
import type { SingleTimelineResponse, QueryBundle, EntityRef } from '@quent/utils';
import type { TreeTableItem } from '@quent/components';
import { resourceFilterQueryAtom } from '@/atoms/resourceTree';

// ---------------------------------------------------------------------------
// Mock heavy/visual dependencies so tests run without a real browser/canvas
// ---------------------------------------------------------------------------

vi.mock('@quent/hooks', async importOriginal => {
  const actual = await importOriginal<typeof import('@quent/hooks')>();
  return {
    ...actual,
    useBulkTimelines: () => ({ handleZoomChange: vi.fn(), handleExpand: vi.fn() }),
    useHighlightedItemIds: () => new Set<string>(),
  };
});

vi.mock('@/hooks/useExpandedIds', () => ({
  useExpandedIds: () => ({ expandedIds: new Set<string>(), handleExpandChange: vi.fn() }),
}));

vi.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light', setTheme: vi.fn() }),
  THEME_DARK: 'dark',
  THEME_LIGHT: 'light',
}));

// Capture the timelineData prop passed to TimelineController on every render
let capturedTimelineData: SingleTimelineResponse | null | undefined = undefined;
let capturedTreeData: TreeTableItem[] = [];
let capturedHighlightedIds = new Set<string>();
let capturedExpandedIds = new Set<string>();

// Mock @quent/components: keep all actual exports but override heavy/visual ones
vi.mock('@quent/components', async importOriginal => {
  const actual = await importOriginal<typeof import('@quent/components')>();
  return {
    ...actual,
    TimelineController: (props: { timelineData?: SingleTimelineResponse | null }) => {
      capturedTimelineData = props.timelineData;
      return null;
    },
    TreeTable: ({
      columns,
      controlledExpandedIds,
      data,
      highlightedItemIds,
    }: {
      columns: Array<{ headerContent?: React.ReactNode; subHeaderContent?: React.ReactNode }>;
      controlledExpandedIds?: Set<string>;
      data: TreeTableItem[];
      highlightedItemIds?: Set<string>;
    }) => (
      <div
        ref={() => {
          capturedTreeData = data;
          capturedHighlightedIds = highlightedItemIds ?? new Set();
          capturedExpandedIds = controlledExpandedIds ?? new Set();
        }}
      >
        {columns.map((col, i) => (
          <React.Fragment key={i}>
            {col.headerContent}
            {col.subHeaderContent}
          </React.Fragment>
        ))}
      </div>
    ),
    ResourceColumn: () => null,
    UsageColumn: () => null,
    TimelineToolbar: ({ filters }: { filters?: React.ReactNode }) => filters,
  };
});

import * as clientApi from '@quent/client';
vi.mock('@quent/client', async importOriginal => {
  const actual = await importOriginal<typeof clientApi>();
  return { ...actual, fetchSingleTimeline: vi.fn(), fetchBulkTimelines: vi.fn() };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DURATION_S = 100;
const ROOT_GROUP_ID = 'qg-1';
const RESOURCE_ID = 'res-1';
const RESOURCE_TYPE = 'GPU';

/** Minimal QueryBundle that causes the root timeline query to be enabled. */
const makeBundle = (): QueryBundle<EntityRef> =>
  ({
    query_id: 'test-query',
    entities: {
      engine: { id: 'engine-1' },
      query_group: { id: ROOT_GROUP_ID },
      query: { id: 'query-1' },
      workers: {},
      plans: {},
      operators: {},
      ports: {},
      resource_types: { [RESOURCE_TYPE]: { used_by: ['task'], capacities: [] } },
      resource_group_types: {},
      resources: {
        [RESOURCE_ID]: {
          id: RESOURCE_ID,
          instance_name: 'GPU 0',
          type_name: RESOURCE_TYPE,
        },
      },
      resource_groups: {},
      fsm_types: {},
    },
    resource_tree: {
      ResourceGroup: {
        id: { QueryGroup: ROOT_GROUP_ID },
        children: [{ Resource: { Resource: RESOURCE_ID } }],
      },
    },
    plan_tree: { id: 'plan-1', worker: null, children: [] },
    unique_operator_names: [],
    quantity_specs: {},
    start_time_unix_ns: 0n,
    duration_s: DURATION_S,
  }) as unknown as QueryBundle<EntityRef>;

const makeTimeline = (start: number, end: number): SingleTimelineResponse =>
  ({
    config: { span: { start, end }, bin_duration: 1, num_bins: BigInt(end - start) },
    data: { Binned: { series: {} } },
  }) as unknown as SingleTimelineResponse;

function ViewportProbe() {
  const range = useZoomRange();
  return <output data-testid="viewport">{JSON.stringify(range)}</output>;
}

describe('QueryResourceTree — TimelineController always shows full-range data', () => {
  beforeEach(() => {
    capturedTimelineData = undefined;
    capturedTreeData = [];
    capturedHighlightedIds = new Set();
    capturedExpandedIds = new Set();
    vi.mocked(clientApi.fetchBulkTimelines).mockResolvedValue({ entries: {} } as never);
  });

  it('passes full-range timeline data to TimelineController', async () => {
    const fullRange = makeTimeline(0, DURATION_S);
    vi.mocked(clientApi.fetchSingleTimeline).mockResolvedValue(fullRange);

    const store = createStore();
    renderWithQuery(
      <JotaiProvider store={store}>
        <QueryResourceTree engineId="engine-1" queryBundle={makeBundle()} />
      </JotaiProvider>
    );

    await waitFor(() => expect(capturedTimelineData).toBe(fullRange));
    expect(capturedTimelineData?.config.span.start).toBe(0);
    expect(capturedTimelineData?.config.span.end).toBe(DURATION_S);
  });

  it('hydrates an imported initial viewport instead of the full query range', async () => {
    vi.mocked(clientApi.fetchSingleTimeline).mockResolvedValue(makeTimeline(0, DURATION_S));

    const store = createStore();
    const { getByTestId } = renderWithQuery(
      <JotaiProvider store={store}>
        <QueryResourceTree
          engineId="engine-1"
          queryBundle={makeBundle()}
          initialZoomRange={{ start: 25, end: 75 }}
        />
        <ViewportProbe />
      </JotaiProvider>
    );

    await waitFor(() =>
      expect(getByTestId('viewport')).toHaveTextContent(JSON.stringify({ start: 25, end: 75 }))
    );
  });

  it('is unaffected when a zoom-bounded bulk fetch overwrites the same atom cache key', async () => {
    const fullRange = makeTimeline(0, DURATION_S);
    const zoomed = makeTimeline(25, 75);
    vi.mocked(clientApi.fetchSingleTimeline).mockResolvedValue(fullRange);

    const store = createStore();
    renderWithQuery(
      <JotaiProvider store={store}>
        <QueryResourceTree engineId="engine-1" queryBundle={makeBundle()} />
      </JotaiProvider>
    );

    // Wait for the full-range data to appear in TimelineController
    await waitFor(() => expect(capturedTimelineData).toBe(fullRange));

    // Simulate what useBulkTimelines does when the user zooms: it calls
    // applyBulkTimelineResponse which writes zoom-bounded data to timelineDataAtom
    // under the same key that was previously used for the full-range data.
    // Wrap in act() so any atom-subscription re-renders are flushed synchronously
    // before we assert — this is what makes the test fail on the buggy code.
    const idToMeta = new Map([
      [
        'bulk-id-1',
        {
          resourceId: ROOT_GROUP_ID,
          resourceTypeName: RESOURCE_TYPE,
          operatorId: null,
          fsmTypeName: null,
        },
      ],
    ]);
    await act(async () => {
      applyBulkTimelineResponse(
        {
          entries: {
            'bulk-id-1': { status: 'ok', data: zoomed.data, config: zoomed.config } as never,
          },
        },
        idToMeta,
        store
      );
    });

    // Confirm the atom was indeed overwritten with zoomed data (bug mechanism is intact)
    const cacheKey = timelineCacheKey({
      resourceId: ROOT_GROUP_ID,
      resourceTypeName: RESOURCE_TYPE,
      fsmTypeName: null,
    });
    const timelineMap = store.get(timelineDataMapAtom) as Record<string, SingleTimelineResponse>;
    expect(timelineMap[cacheKey]?.config.span.start).toBe(25);

    // TimelineController must still show the full-range data — not the atom value.
    expect(capturedTimelineData?.config.span.start).toBe(0);
    expect(capturedTimelineData?.config.span.end).toBe(DURATION_S);
  });
});

describe('QueryResourceTree — resource filtering', () => {
  beforeEach(() => {
    capturedTreeData = [];
    capturedHighlightedIds = new Set();
    capturedExpandedIds = new Set();
    vi.mocked(clientApi.fetchSingleTimeline).mockResolvedValue(makeTimeline(0, DURATION_S));
    vi.mocked(clientApi.fetchBulkTimelines).mockResolvedValue({ entries: {} } as never);
  });

  it('keeps matching resources, expands their path, and highlights direct matches', async () => {
    const store = createStore();
    store.set(resourceFilterQueryAtom, `id:${RESOURCE_ID}`);

    const { getByRole } = renderWithQuery(
      <JotaiProvider store={store}>
        <QueryResourceTree engineId="engine-1" queryBundle={makeBundle()} />
      </JotaiProvider>
    );

    expect(getByRole('combobox', { name: 'Filter resources' })).toHaveValue(`id:${RESOURCE_ID}`);
    await waitFor(() => expect(capturedTreeData).toHaveLength(1));
    expect(capturedTreeData[0]?.children?.[0]?.id).toBe(RESOURCE_ID);
    expect(capturedHighlightedIds).toContain(RESOURCE_ID);
    expect(capturedExpandedIds).toContain(ROOT_GROUP_ID);
  });

  it('shows an empty state when no resources match', async () => {
    const store = createStore();
    store.set(resourceFilterQueryAtom, 'id:missing');

    const { findByText } = renderWithQuery(
      <JotaiProvider store={store}>
        <QueryResourceTree engineId="engine-1" queryBundle={makeBundle()} />
      </JotaiProvider>
    );

    expect(await findByText('No resources match this filter.')).toBeInTheDocument();
    expect(capturedTreeData).toEqual([]);
  });
});

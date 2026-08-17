// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { PropsWithChildren } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import { zoomRangeAtom } from '../atoms/timeline';
import { useGetZoomRange } from './useTimelineAtoms';

describe('useGetZoomRange', () => {
  it('reads the latest zoom without subscribing the chart to zoom updates', () => {
    const store = createStore();
    store.set(zoomRangeAtom, { start: 0, end: 100 });
    let renderCount = 0;
    const wrapper = ({ children }: PropsWithChildren) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(
      () => {
        renderCount += 1;
        return useGetZoomRange();
      },
      { wrapper }
    );

    act(() => store.set(zoomRangeAtom, { start: 25, end: 75 }));

    expect(renderCount).toBe(1);
    expect(result.current()).toEqual({ start: 25, end: 75 });
  });
});

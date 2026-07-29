// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedZoomRange, useZoomRange } from './useTimelineAtoms';
import { useTimelineZoomHandler } from './useTimelineZoomHandler';

describe('useTimelineZoomHandler', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('updates live zoom immediately and fetch zoom after 150ms', () => {
    vi.useFakeTimers();
    const store = createStore();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>{children}</Provider>
    );
    const { result } = renderHook(
      () => ({
        handleZoomChange: useTimelineZoomHandler(),
        zoom: useZoomRange(),
        debouncedZoom: useDebouncedZoomRange(),
      }),
      { wrapper }
    );

    act(() => result.current.handleZoomChange({ start: 10, end: 20 }));
    expect(result.current.zoom).toEqual({ start: 10, end: 20 });
    expect(result.current.debouncedZoom).not.toEqual({ start: 10, end: 20 });

    act(() => vi.advanceTimersByTime(150));
    expect(result.current.debouncedZoom).toEqual({ start: 10, end: 20 });
  });
});

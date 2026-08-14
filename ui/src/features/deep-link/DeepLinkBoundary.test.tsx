// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useLayoutEffect } from 'react';
import { Provider as JotaiProvider, useAtomValue, useSetAtom } from 'jotai';
import {
  useDebouncedZoomRange,
  useSetDebouncedZoomRange,
  useSetZoomRange,
  useZoomRange,
} from '@quent/hooks';
import { render, screen, waitFor, userEvent } from '@/test/test-utils';
import { expandedIdsAtom } from '@/atoms/resourceTree';
import { CopyLinkButton } from './CopyLinkButton';
import { DeepLinkBoundary } from './DeepLinkBoundary';
import { decodeDeepLinkState, encodeDeepLinkState } from './deepLink.codec';
import { DEEP_LINK_NAV_SLOT_ID } from './deepLink.constants';
import { useDeepLink } from './deepLink.context';

function ViewportProbe() {
  const immediate = useZoomRange();
  const debounced = useDebouncedZoomRange();
  return <output data-testid="viewport">{JSON.stringify({ immediate, debounced })}</output>;
}

function IntakeStatusProbe() {
  const deepLink = useDeepLink();
  return <output data-testid="intake-status">{deepLink?.intakeStatus.kind}</output>;
}

function ExpandedRowsProbe() {
  const expandedIds = useAtomValue(expandedIdsAtom);
  return <output data-testid="expanded-rows">{JSON.stringify([...expandedIds].sort())}</output>;
}

function SeedViewport({ start, end }: { start: number; end: number }) {
  const setImmediate = useSetZoomRange();
  const setDebounced = useSetDebouncedZoomRange();

  useLayoutEffect(() => {
    setImmediate({ start, end });
    setDebounced({ start, end });
  }, [end, setDebounced, setImmediate, start]);
  return null;
}

function SeedExpandedRows({ ids }: { ids: string[] }) {
  const setExpandedIds = useSetAtom(expandedIdsAtom);

  useLayoutEffect(() => {
    setExpandedIds(new Set(ids));
  }, [ids, setExpandedIds]);
  return null;
}

describe('DeepLinkBoundary', () => {
  it('hydrates timeline viewport and expanded rows before rendering children', () => {
    const encoded = encodeDeepLinkState({
      zoomRange: { start: 10, end: 40 },
      expandedResourceIds: ['resource-b', 'resource-a'],
    });
    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;

    render(
      <JotaiProvider>
        <DeepLinkBoundary durationSeconds={100} encodedState={encoded.value} isQueryReady>
          <ViewportProbe />
          <ExpandedRowsProbe />
        </DeepLinkBoundary>
      </JotaiProvider>
    );

    expect(screen.getByTestId('viewport')).toHaveTextContent(
      JSON.stringify({
        immediate: { start: 10, end: 40 },
        debounced: { start: 10, end: 40 },
      })
    );
    expect(screen.getByTestId('expanded-rows')).toHaveTextContent(
      JSON.stringify(['resource-a', 'resource-b'])
    );
  });

  it('renders normally and reports invalid incoming state without hydrating it', () => {
    render(
      <JotaiProvider>
        <DeepLinkBoundary durationSeconds={100} encodedState="v1.invalid" isQueryReady>
          <IntakeStatusProbe />
          <ViewportProbe />
        </DeepLinkBoundary>
      </JotaiProvider>
    );

    expect(screen.getByTestId('intake-status')).toHaveTextContent('error');
    expect(screen.getByTestId('viewport')).toHaveTextContent(
      JSON.stringify({
        immediate: { start: 0, end: 0 },
        debounced: { start: 0, end: 0 },
      })
    );
  });

  it('copies the current viewport without changing the address bar', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    window.history.replaceState(null, '', '/profile/engine/e/query/q/timeline?unrelated=kept');

    render(
      <>
        <div id={DEEP_LINK_NAV_SLOT_ID} />
        <JotaiProvider>
          <DeepLinkBoundary durationSeconds={100} isQueryReady>
            <SeedViewport start={20} end={60} />
            <SeedExpandedRows ids={['resource-b', 'resource-a']} />
            <ViewportProbe />
            <CopyLinkButton />
          </DeepLinkBoundary>
        </JotaiProvider>
      </>
    );

    await waitFor(() => expect(screen.getByTestId('viewport')).toHaveTextContent('"start":20'));
    const originalUrl = window.location.href;
    await userEvent.click(screen.getByRole('button', { name: 'Copy Link' }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(screen.getByRole('button', { name: 'Copy Link' }).querySelector('svg')).toHaveClass(
      'lucide-check'
    );
    const copiedUrl = writeText.mock.calls[0][0] as string;
    const parsedUrl = new URL(copiedUrl);
    const encoded = parsedUrl.searchParams.get('s');
    expect(encoded).not.toBeNull();
    expect(parsedUrl.searchParams.has('unrelated')).toBe(false);
    expect(decodeDeepLinkState(encoded!)).toEqual({
      ok: true,
      value: {
        zoomRange: { start: 20, end: 60 },
        expandedResourceIds: ['resource-a', 'resource-b'],
      },
    });
    expect(window.location.href).toBe(originalUrl);
  });
});

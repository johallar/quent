// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useCallback, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { useSetDebouncedZoomRange, useSetZoomRange, useZoomRange } from '@quent/hooks';
import { buildDeepLinkUrl, decodeDeepLinkState } from './deepLink.codec';
import {
  DeepLinkContext,
  type CopyLinkResult,
  type DeepLinkContextValue,
  type DeepLinkIntakeStatus,
} from './deepLink.context';
import { normalizeZoomRange, resolveCapturedZoomRange } from './deepLink.normalize';

interface DeepLinkBoundaryProps {
  children: ReactNode;
  durationSeconds: number;
  encodedState?: string;
  isQueryReady: boolean;
}

export function DeepLinkBoundary({
  children,
  durationSeconds,
  encodedState,
  isQueryReady,
}: DeepLinkBoundaryProps) {
  const zoomRange = useZoomRange();
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();

  const intake = useMemo(() => {
    if (!encodedState) {
      return {
        initialZoomRange: null,
        isResolved: true,
        status: { kind: 'idle' } satisfies DeepLinkIntakeStatus,
      };
    }
    if (!isQueryReady) {
      return {
        initialZoomRange: null,
        isResolved: false,
        status: { kind: 'idle' } satisfies DeepLinkIntakeStatus,
      };
    }

    const decoded = decodeDeepLinkState(encodedState);
    if (!decoded.ok) {
      return {
        initialZoomRange: null,
        isResolved: true,
        status: { kind: 'error', message: decoded.message } satisfies DeepLinkIntakeStatus,
      };
    }

    const normalized = normalizeZoomRange(decoded.value.zoomRange, durationSeconds);
    if (!normalized) {
      return {
        initialZoomRange: null,
        isResolved: true,
        status: {
          kind: 'error',
          message: 'The query duration cannot support the shared timeline viewport.',
        } satisfies DeepLinkIntakeStatus,
      };
    }

    return {
      initialZoomRange: normalized.range,
      isResolved: true,
      status: normalized.wasAdjusted
        ? ({
            kind: 'warning',
            message: 'The shared timeline viewport was adjusted to fit this query.',
          } satisfies DeepLinkIntakeStatus)
        : ({ kind: 'ready' } satisfies DeepLinkIntakeStatus),
    };
  }, [durationSeconds, encodedState, isQueryReady]);

  const [isHydrated, setIsHydrated] = useState(!encodedState);

  useLayoutEffect(() => {
    if (!intake.isResolved) return;
    if (intake.initialZoomRange) {
      setZoomRange(intake.initialZoomRange);
      setDebouncedZoomRange(intake.initialZoomRange);
    }
    setIsHydrated(true);
  }, [intake.initialZoomRange, intake.isResolved, setDebouncedZoomRange, setZoomRange]);

  const copyLink = useCallback(async (): Promise<CopyLinkResult> => {
    const capturedRange = resolveCapturedZoomRange(zoomRange, durationSeconds);
    if (!capturedRange) {
      return { ok: false, message: 'The timeline viewport is not available yet.' };
    }

    const canonicalPageUrl = `${window.location.origin}${window.location.pathname}`;
    const result = buildDeepLinkUrl(canonicalPageUrl, { zoomRange: capturedRange });
    if (!result.ok) return { ok: false, message: result.message };
    if (!navigator.clipboard?.writeText) {
      return { ok: false, message: 'Clipboard access is unavailable.' };
    }

    try {
      await navigator.clipboard.writeText(result.value);
      return { ok: true, url: result.value };
    } catch {
      return { ok: false, message: 'Could not copy the link to the clipboard.' };
    }
  }, [durationSeconds, zoomRange]);

  const value = useMemo<DeepLinkContextValue>(
    () => ({
      copyLink,
      initialZoomRange: intake.initialZoomRange,
      intakeStatus: intake.status,
    }),
    [copyLink, intake.initialZoomRange, intake.status]
  );

  return (
    <DeepLinkContext.Provider value={value}>
      {isHydrated ? children : null}
    </DeepLinkContext.Provider>
  );
}

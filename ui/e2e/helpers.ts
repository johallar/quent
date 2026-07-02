// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { Page, Request } from '@playwright/test';

/** Matcher for a single app HTTP endpoint (method + URL regex). */
export interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  pattern: RegExp;
}

/**
 * Canonical set of Quent API endpoints as request matchers. Keep in sync with
 * `packages/@quent/client/src/api.ts`. Patterns match the URL path (ignoring the
 * base URL) so they work regardless of proxy / origin.
 */
export const API_ENDPOINTS = {
  listEngines: { method: 'GET', pattern: /\/engines(?:\?|$)/ },
  listGroups: { method: 'GET', pattern: /\/engines\/[^/]+\/query-groups(?:\?|$)/ },
  listQueries: {
    method: 'GET',
    pattern: /\/engines\/[^/]+\/query_group\/[^/]+\/queries(?:\?|$)/,
  },
  queryBundle: { method: 'GET', pattern: /\/engines\/[^/]+\/query\/[^/?]+(?:\?|$)/ },
  singleTimeline: { method: 'POST', pattern: /\/engines\/[^/]+\/timeline\/single(?:\?|$)/ },
  bulkTimelines: { method: 'POST', pattern: /\/engines\/[^/]+\/timeline\/bulk(?:\?|$)/ },
} as const satisfies Record<string, ApiEndpoint>;

function matchesEndpoint(req: Request, endpoint: ApiEndpoint): boolean {
  return req.method() === endpoint.method && endpoint.pattern.test(req.url());
}

interface WaitForRequestSettledOptions {
  /** Ms of no matching-request activity that counts as "settled". */
  quietMs?: number;
  /** Fail after this many ms if never settled. */
  timeoutMs?: number;
  /** Require at least this many completed matching responses before resolving. */
  minResponses?: number;
  /** Poll interval for the settle check. */
  pollMs?: number;
}

/**
 * Watch requests matching `endpoint` on `page` and return a promise that resolves
 * once none have been in flight for `quietMs`. Install BEFORE triggering the action
 * so any debounced fetches it kicks off can't slip past the listeners.
 */
export function waitForRequestsSettled(
  page: Page,
  endpoint: ApiEndpoint,
  {
    quietMs = 300,
    timeoutMs = 15_000,
    minResponses = 1,
    pollMs = 50,
  }: WaitForRequestSettledOptions = {}
): Promise<void> {
  let inFlight = 0;
  let completed = 0;
  let lastActivityAt = Date.now();

  const onRequest = (req: Request) => {
    if (!matchesEndpoint(req, endpoint)) return;
    inFlight++;
    lastActivityAt = Date.now();
  };
  const onDone = (req: Request) => {
    if (!matchesEndpoint(req, endpoint)) return;
    inFlight = Math.max(0, inFlight - 1);
    completed++;
    lastActivityAt = Date.now();
  };

  page.on('request', onRequest);
  page.on('requestfinished', onDone);
  page.on('requestfailed', onDone);

  const startedAt = Date.now();
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      page.off('request', onRequest);
      page.off('requestfinished', onDone);
      page.off('requestfailed', onDone);
    };
    const tick = () => {
      if (inFlight === 0 && completed >= minResponses && Date.now() - lastActivityAt >= quietMs) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() - startedAt > timeoutMs) {
        cleanup();
        reject(
          new Error(
            `Timed out waiting for ${endpoint.method} ${endpoint.pattern} to settle after ` +
              `${timeoutMs}ms (inFlight=${inFlight}, completed=${completed})`
          )
        );
        return;
      }
      setTimeout(tick, pollMs);
    };
    setTimeout(tick, pollMs);
  });
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { gzipSync } from 'node:zlib';

const MAX_DEEP_LINK_URL_LENGTH = 2048;

export interface EvidenceDeepLinkState {
  route: {
    engineId: string;
    queryId: string;
    tab: 'entities';
  };
  selection?: {
    operatorNodeIds: string[];
  };
  entities: {
    entityType?: string;
    resourceId: string;
    window: {
      start: number;
      end: number;
    };
    sortDir: 'Desc';
    pageSize: number;
    page: number;
    selectedEntityId?: string;
  };
}

export function buildEvidenceDeepLink(currentUrl: string, state: EvidenceDeepLinkState): string {
  const encoded = gzipSync(JSON.stringify(state), { level: 9 }).toString('base64url');
  const isAbsolute = /^[A-Za-z][A-Za-z\d+.-]*:/u.test(currentUrl);
  const url = new URL(currentUrl, 'http://deep-link.invalid');
  url.searchParams.set('s', `v3.${encoded}`);
  const result = isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`;
  if (result.length > MAX_DEEP_LINK_URL_LENGTH) {
    throw new Error('Could not build evidence link: The shareable URL exceeds 2,048 characters.');
  }
  return result;
}

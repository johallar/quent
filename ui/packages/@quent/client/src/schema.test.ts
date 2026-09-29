// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { QueryClient } from '@tanstack/react-query';
import type { Schema } from '@quent/schema';
import { describe, expect, it, vi } from 'vitest';
import { schemaQueryOptions } from './schema';

const SCHEMA: Schema = {
  name: 'Fixture',
  entities: [],
  records: [],
  annotations: { docs: null, constraints: {}, metadata: {} },
};

describe('schemaQueryOptions', () => {
  it('loads an injected schema source through the production query seam', async () => {
    const fetcher = vi.fn().mockResolvedValue(SCHEMA);
    const queryClient = new QueryClient();

    await expect(
      queryClient.fetchQuery(schemaQueryOptions({ engineId: 'engine-a', fetcher }))
    ).resolves.toBe(SCHEMA);
    expect(fetcher).toHaveBeenCalledWith('engine-a');
  });
});

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FlaskConical } from 'lucide-react';

export function NoAvailableQuerySurface() {
  return (
    <div className="flex h-full min-h-64 items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-2">
        <FlaskConical className="mx-auto size-6 text-muted-foreground" />
        <h2 className="text-sm font-semibold">No analysis surface is enabled</h2>
        <p className="text-sm leading-5 text-muted-foreground">
          This schema exposes definitions, but no compatible query analysis feature.
        </p>
      </div>
    </div>
  );
}

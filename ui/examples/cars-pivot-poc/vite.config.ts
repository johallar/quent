// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Reuse the main app's `src/` tree via the `@` alias so this example can
// import the same pivot-table + UI primitives without duplicating code.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src'),
      // TODO: drop this dependency on the simulator's generated ts-bindings.
      // `@/services/formatters` and `@/services/colors` only need a handful
      // of `import type` aliases that the pivot table never calls at runtime.
      '~quent/types': path.resolve(__dirname, '../../../examples/simulator/server/ts-bindings'),
    },
  },
  server: {
    port: 5174,
  },
});

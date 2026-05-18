// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080';
const ENABLE_DIFF_MOCK_API = process.env.VITE_DIFF_MOCK_API !== 'false';

/** Ensures JS chunks get high fetch priority so they load before competing API requests. */
function vitePluginScriptPriority() {
  return {
    name: 'vite-plugin-script-priority',
    transformIndexHtml(html: string) {
      return html
        .replace(/<script(\s[^>]*?)(\s*\/?)>/gi, (_, attrs, close) =>
          attrs.includes('fetchpriority')
            ? `<script${attrs}${close}>`
            : `<script fetchpriority="high"${attrs}${close}>`
        )
        .replace(/<link(\s+)([^>]*?rel=["']modulepreload["'][^>]*?)>/gi, (_, space, rest) =>
          rest.includes('fetchpriority')
            ? `<link${space}${rest}>`
            : `<link${space}fetchpriority="high" ${rest}>`
        );
    },
  };
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function createMockQueryProfileDiffResponse(queryAId: string, queryBId: string) {
  const different = queryAId.includes('different') || queryBId.includes('different');
  const base = {
    query_a: {
      id: queryAId,
      instance_name: queryAId,
      query_group_id: null,
      query_group_name: null,
    },
    query_b: {
      id: queryBId,
      instance_name: queryBId,
      query_group_id: null,
      query_group_name: null,
    },
  };

  if (different) {
    return {
      scenario: 'plans_different',
      ...base,
      plan_comparison: {
        match_kind: 'different',
        matched_operator_count: 0,
        unmatched_operator_a_count: 3,
        unmatched_operator_b_count: 4,
      },
      operator_diffs: [],
      warnings: ['Plans are structurally different; operator-to-operator diff is unavailable.'],
    };
  }

  return {
    scenario: 'plans_equal',
    ...base,
    plan_comparison: {
      match_kind: 'structural',
      matched_operator_count: 3,
      unmatched_operator_a_count: 0,
      unmatched_operator_b_count: 0,
    },
    operator_diffs: [
      {
        operator_a: {
          id: 'scan-a',
          label: 'Scan orders',
          operator_type_name: 'Scan',
          plan_id: 'plan-a',
        },
        operator_b: {
          id: 'scan-b',
          label: 'Scan orders',
          operator_type_name: 'Scan',
          plan_id: 'plan-b',
        },
        stats: {
          duration_s: { a: 12, b: 10, delta: 2, percent_delta: 0.2 },
          input_rows: { a: 1000, b: 1200, delta: -200, percent_delta: -0.1666666667 },
          output_rows: { a: 900, b: 950, delta: -50, percent_delta: -0.0526315789 },
        },
      },
      {
        operator_a: {
          id: 'join-a',
          label: 'Join lineitem',
          operator_type_name: 'Join',
          plan_id: 'plan-a',
        },
        operator_b: {
          id: 'join-b',
          label: 'Join lineitem',
          operator_type_name: 'Join',
          plan_id: 'plan-b',
        },
        stats: {
          duration_s: { a: 24, b: 30, delta: -6, percent_delta: -0.2 },
          input_rows: { a: 900, b: 950, delta: -50, percent_delta: -0.0526315789 },
          output_rows: { a: 400, b: 380, delta: 20, percent_delta: 0.0526315789 },
        },
      },
      {
        operator_a: {
          id: 'agg-a',
          label: 'Aggregate',
          operator_type_name: 'Aggregate',
          plan_id: 'plan-a',
        },
        operator_b: {
          id: 'agg-b',
          label: 'Aggregate',
          operator_type_name: 'Aggregate',
          plan_id: 'plan-b',
        },
        stats: {
          duration_s: { a: 4, b: 4, delta: 0, percent_delta: 0 },
          input_rows: { a: 400, b: 380, delta: 20, percent_delta: 0.0526315789 },
          output_rows: { a: 20, b: 20, delta: 0, percent_delta: 0 },
        },
      },
    ],
  };
}

function vitePluginQueryProfileDiffMock(): Plugin {
  const diffPath = /^\/api\/engines\/[^/]+\/query-profile-diff(?:\?.*)?$/;
  return {
    name: 'vite-plugin-query-profile-diff-mock',
    configureServer(server) {
      if (!ENABLE_DIFF_MOCK_API) return;
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST' || !req.url || !diffPath.test(req.url)) {
          next();
          return;
        }
        void readRequestBody(req)
          .then(bodyText => {
            const body = JSON.parse(bodyText || '{}') as {
              query_a_id?: string;
              query_b_id?: string;
            };
            const response = createMockQueryProfileDiffResponse(
              body.query_a_id ?? 'query-a',
              body.query_b_id ?? 'query-b'
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
          })
          .catch(next);
      });
    },
    configurePreviewServer(server) {
      if (!ENABLE_DIFF_MOCK_API) return;
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== 'POST' || !req.url || !diffPath.test(req.url)) {
          next();
          return;
        }
        void readRequestBody(req)
          .then(bodyText => {
            const body = JSON.parse(bodyText || '{}') as {
              query_a_id?: string;
              query_b_id?: string;
            };
            const response = createMockQueryProfileDiffResponse(
              body.query_a_id ?? 'query-a',
              body.query_b_id ?? 'query-b'
            );
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(response));
          })
          .catch(next);
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vitePluginScriptPriority(),
    vitePluginQueryProfileDiffMock(),
    TanStackRouterVite({
      routeFileIgnorePattern: '.test.|.spec.',
    }),
    tailwindcss(),
    // Bundle analyzer - generates stats.html after build
    visualizer({
      filename: 'stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Split large dependencies into separate chunks for better caching
          'react-vendor': ['react', 'react-dom'],
          tanstack: ['@tanstack/react-query', '@tanstack/react-router'],
          xyflow: ['@xyflow/react'],
          // echarts uses tree-shaking via @/lib/echarts.ts custom build
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          // elkjs is handled separately via alias to bundled version
        },
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom', 'jotai', '@tanstack/react-query', '@tanstack/react-router'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      // TODO: Using ts bindings from quent for now this will need to change
      // to get bindings from webserver when we go that direction
      '~quent/types': path.resolve(__dirname, '../examples/simulator/server/ts-bindings'),
      // Force elkjs to use bundled version (avoids web-worker module resolution issues)
      elkjs: 'elkjs/lib/elk.bundled.js',
    },
  },
  optimizeDeps: {
    // Workspace packages must NOT be pre-bundled. Pre-bundling collapses each
    // package's source into a single optimized chunk in `node_modules/.vite/`,
    // which means saving any file under `packages/@quent/*/src/` triggers a
    // full page reload ("new dependencies optimized") instead of surgical HMR.
    // Excluding them keeps their source in Vite's on-demand transform pipeline
    // alongside `src/`, so React Fast Refresh works across package boundaries.
    exclude: ['@quent/components', '@quent/hooks', '@quent/client', '@quent/utils'],
    include: [
      // echarts-for-react is a CJS peer dep of @quent/components; must be pre-bundled
      // here so Vite converts it to ESM with a proper default export rather than
      // serving the raw module.exports object to the browser.
      'echarts-for-react',
    ],
  },
  server: {
    watch: {
      followSymlinks: true,
    },
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        configure: proxy => {
          proxy.on('proxyRes', proxyRes => {
            // Remove CORS headers from backend since proxy handles it
            delete proxyRes.headers['access-control-allow-origin'];
            delete proxyRes.headers['access-control-allow-credentials'];
          });
        },
      },
    },
  },
  preview: {
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        configure: proxy => {
          proxy.on('proxyRes', proxyRes => {
            delete proxyRes.headers['access-control-allow-origin'];
            delete proxyRes.headers['access-control-allow-credentials'];
          });
        },
      },
    },
  },
});

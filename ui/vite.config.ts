// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import path from 'path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { defineConfig, type PreviewServer, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import { visualizer } from 'rollup-plugin-visualizer';
import tailwindcss from '@tailwindcss/vite';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:8080';

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

interface TimelineConfig {
  num_bins: number;
  start: number;
  end: number;
}

interface BinnedSpanSec {
  span: {
    start: number;
    end: number;
  };
  bin_duration: number;
  num_bins: number;
}

interface SingleTimelineResponse {
  config: BinnedSpanSec;
  data:
    | {
        Binned: {
          config: BinnedSpanSec;
          capacities_values: Record<string, number[] | undefined>;
          long_fsms: unknown[];
        };
      }
    | {
        BinnedByState: {
          config: BinnedSpanSec;
          capacities_states_values: Record<
            string,
            Record<string, number[] | undefined> | undefined
          >;
          long_fsms: unknown[];
        };
      };
}

interface DiffTimelineRequest {
  timelines: Array<{
    engine_id: string;
    timeline: unknown;
  }>;
  delta_config: TimelineConfig;
}

interface DiffQueryRef {
  engine_id: string;
  query_id: string;
}

interface DiffRequest {
  baselineQuery: DiffQueryRef;
  comparisonQueries: DiffQueryRef[];
}

const QUERY_A_HIGHER_SERIES = 'Query A higher';
const QUERY_B_HIGHER_SERIES = 'Query B higher';

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

function toBinnedSpanSec(config: TimelineConfig): BinnedSpanSec {
  const numBins = Math.max(1, Math.trunc(Number(config.num_bins)));
  const start = Number(config.start);
  const end = Number(config.end);

  return {
    span: { start, end },
    bin_duration: end > start ? (end - start) / numBins : 0,
    num_bins: numBins,
  };
}

function timelineValueArrays(response: SingleTimelineResponse): number[][] {
  if ('Binned' in response.data) {
    return Object.values(response.data.Binned.capacities_values).filter(
      (values): values is number[] => Array.isArray(values)
    );
  }

  return Object.values(response.data.BinnedByState.capacities_states_values).flatMap(states =>
    Object.values(states ?? {}).filter((values): values is number[] => Array.isArray(values))
  );
}

function sampleAggregateAt(response: SingleTimelineResponse, targetSeconds: number): number {
  const { bin_duration: binDuration, span, num_bins: numBins } = response.config;
  if (binDuration <= 0 || targetSeconds < span.start) return 0;

  const index = Math.floor((targetSeconds - span.start) / binDuration);
  if (index < 0 || index >= numBins) return 0;

  return timelineValueArrays(response).reduce((sum, values) => sum + (values[index] ?? 0), 0);
}

async function fetchSingleTimelineFromTarget(
  engineId: string,
  request: unknown
): Promise<SingleTimelineResponse> {
  const response = await fetch(`${API_TARGET}/api/engines/${engineId}/timeline/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(`single timeline fetch failed: ${response.status} ${response.statusText}`);
  }

  return (await response.json()) as SingleTimelineResponse;
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function queryNameFromId(queryId: string): string {
  const parts = queryId.split('-');
  const suffix = parts[parts.length - 1];
  return suffix ? `Query ${suffix.toUpperCase()}` : queryId;
}

interface MockOperatorDiffSpec {
  id: string;
  label: string;
  operatorType: string;
  duration: [number, number];
  inputRows: [number, number];
  outputRows: [number, number];
}

const MOCK_OPERATOR_DIFF_SPECS: MockOperatorDiffSpec[] = [
  {
    id: 'scan-orders',
    label: 'Scan orders',
    operatorType: 'Scan',
    duration: [12, 10],
    inputRows: [0, 0],
    outputRows: [1_000_000, 1_200_000],
  },
  {
    id: 'filter-active',
    label: 'Filter active rows',
    operatorType: 'Filter',
    duration: [4, 5],
    inputRows: [1_000_000, 1_200_000],
    outputRows: [750_000, 820_000],
  },
  {
    id: 'project-columns',
    label: 'Project selected columns',
    operatorType: 'Project',
    duration: [2, 2.5],
    inputRows: [750_000, 820_000],
    outputRows: [750_000, 820_000],
  },
  {
    id: 'join-lineitem',
    label: 'Join lineitem',
    operatorType: 'Join',
    duration: [24, 30],
    inputRows: [750_000, 820_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'sort-revenue',
    label: 'Sort by revenue',
    operatorType: 'Sort',
    duration: [6, 8],
    inputRows: [400_000, 380_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'window-rank',
    label: 'Window rank',
    operatorType: 'Window',
    duration: [8, 7],
    inputRows: [400_000, 380_000],
    outputRows: [400_000, 380_000],
  },
  {
    id: 'aggregate-status',
    label: 'Aggregate by status',
    operatorType: 'Aggregate',
    duration: [4, 4],
    inputRows: [400_000, 380_000],
    outputRows: [20, 18],
  },
];

function buildMockDelta([baseline, comparison]: [number, number]) {
  const delta = baseline - comparison;
  return {
    stats: [baseline, comparison] as [number, number],
    delta,
    percent_delta: comparison === 0 ? null : delta / comparison,
  };
}

function adjustComparisonValue(value: number, competitorIndex: number, statIndex: number): number {
  if (value === 0) return 0;
  const direction = statIndex % 2 === 0 ? 1 : -1;
  return Number((value + direction * competitorIndex * Math.max(1, value * 0.08)).toFixed(3));
}

function buildMockOperatorDiffs(
  baselineQueryId: string,
  comparisonQueryId: string,
  competitorIndex: number
) {
  return MOCK_OPERATOR_DIFF_SPECS.map((spec, statIndex) => {
    const duration = [
      spec.duration[0],
      adjustComparisonValue(spec.duration[1], competitorIndex, statIndex),
    ] as [number, number];
    const inputRows = [
      spec.inputRows[0],
      adjustComparisonValue(spec.inputRows[1], competitorIndex, statIndex),
    ] as [number, number];
    const outputRows = [
      spec.outputRows[0],
      adjustComparisonValue(spec.outputRows[1], competitorIndex, statIndex),
    ] as [number, number];

    return {
      operators: [
        {
          id: `${spec.id}-${baselineQueryId}`,
          label: spec.label,
          operator_type_name: spec.operatorType,
          plan_id: `plan-${baselineQueryId}`,
        },
        {
          id: `${spec.id}-${comparisonQueryId}`,
          label: spec.label,
          operator_type_name: spec.operatorType,
          plan_id: `plan-${comparisonQueryId}`,
        },
      ],
      stats: {
        duration_s: buildMockDelta(duration),
        input_rows: buildMockDelta(inputRows),
        output_rows: buildMockDelta(outputRows),
      },
    };
  });
}

function makeQueryProfileDiffResponse(body: DiffRequest) {
  return {
    comparisonQueries: body.comparisonQueries.map((query, index) => {
      const baselineDuration = 40;
      const comparisonDuration = 44 + index * 3;
      return {
        compatibility: 'compatible',
        query: {
          id: query.query_id,
          engine_id: query.engine_id,
          engine_name: query.engine_id,
          instance_name: queryNameFromId(query.query_id),
          query_group_id: null,
          query_group_name: null,
        },
        stat_diffs: {
          duration: {
            stats: [baselineDuration, comparisonDuration],
            delta: baselineDuration - comparisonDuration,
            percent_delta:
              comparisonDuration === 0
                ? null
                : (baselineDuration - comparisonDuration) / comparisonDuration,
          },
        },
        operator_diffs: buildMockOperatorDiffs(body.baselineQuery.query_id, query.query_id, index),
      };
    }),
  };
}

function installQueryProfileDiffMock(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    if (req.method !== 'POST' || !req.url) {
      next();
      return;
    }

    const match = req.url.match(/^\/api\/query-profile-diff(?:\?|$)/);
    if (!match) {
      next();
      return;
    }

    try {
      const body = JSON.parse(await readRequestBody(req)) as DiffRequest;
      if (!body.baselineQuery?.query_id || body.comparisonQueries.length === 0) {
        throw new Error('query profile diff requires a baseline query and comparison queries');
      }

      writeJson(res, 200, makeQueryProfileDiffResponse(body));
    } catch (error) {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to mock query profile diff',
      });
    }
  });
}

function installTimelineDiffMock(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    if (req.method !== 'POST' || !req.url) {
      next();
      return;
    }

    const match = req.url.match(/^\/api\/timeline\/diff(?:\?|$)/);
    if (!match) {
      next();
      return;
    }

    try {
      const body = JSON.parse(await readRequestBody(req)) as DiffTimelineRequest;
      if (body.timelines.length < 2) {
        throw new Error('timeline diff requires at least two timeline requests');
      }

      const timelines = await Promise.all(
        body.timelines.map(({ engine_id: engineId, timeline }) =>
          fetchSingleTimelineFromTarget(engineId, timeline)
        )
      );
      const [queryA, queryB] = timelines;
      const deltaConfig = toBinnedSpanSec(body.delta_config);
      const queryAHigher: number[] = [];
      const queryBHigher: number[] = [];

      for (let index = 0; index < deltaConfig.num_bins; index += 1) {
        const timestamp = deltaConfig.span.start + index * deltaConfig.bin_duration;
        const delta = sampleAggregateAt(queryA, timestamp) - sampleAggregateAt(queryB, timestamp);
        queryAHigher.push(Math.max(delta, 0));
        queryBHigher.push(Math.max(-delta, 0));
      }

      writeJson(res, 200, {
        timelines,
        delta: {
          config: deltaConfig,
          data: {
            Binned: {
              config: deltaConfig,
              capacities_values: {
                [QUERY_A_HIGHER_SERIES]: queryAHigher,
                [QUERY_B_HIGHER_SERIES]: queryBHigher,
              },
              long_fsms: [],
            },
          },
        },
      });
    } catch (error) {
      writeJson(res, 500, {
        error: error instanceof Error ? error.message : 'Failed to mock timeline diff',
      });
    }
  });
}

function vitePluginTimelineDiffMock() {
  return {
    name: 'vite-plugin-timeline-diff-mock',
    configureServer: installTimelineDiffMock,
    configurePreviewServer: installTimelineDiffMock,
  };
}

function vitePluginQueryProfileDiffMock() {
  return {
    name: 'vite-plugin-query-profile-diff-mock',
    configureServer: installQueryProfileDiffMock,
    configurePreviewServer: installQueryProfileDiffMock,
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    vitePluginScriptPriority(),
    vitePluginQueryProfileDiffMock(),
    vitePluginTimelineDiffMock(),
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

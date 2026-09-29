// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  allowedWorkspaceDependencies,
  featurePackages,
  genericPackages,
  knownPackages,
} from './scripts/dependency-policy.mjs';

const packagePath = packageName => `^packages/@quent/${packageName}(?:/|$)`;
const workspacePackages = knownPackages;

const forbiddenPackageEdges = workspacePackages.flatMap(fromPackage =>
  workspacePackages
    .filter(
      toPackage =>
        fromPackage !== toPackage &&
        !(allowedWorkspaceDependencies[fromPackage] ?? []).includes(toPackage)
    )
    .map(toPackage => ({
      name: `not-${fromPackage}-to-${toPackage}`,
      severity: 'error',
      from: { path: packagePath(fromPackage) },
      to: { path: packagePath(toPackage) },
    }))
);

const crossPackageRelativeImports = workspacePackages.flatMap(fromPackage =>
  workspacePackages
    .filter(toPackage => fromPackage !== toPackage)
    .map(toPackage => ({
      name: `no-relative-${fromPackage}-to-${toPackage}`,
      severity: 'error',
      from: { path: packagePath(fromPackage) },
      to: {
        path: packagePath(toPackage),
        dependencyTypes: ['local', 'localmodule'],
      },
    }))
);

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {
        pathNot: '^src/lib/simulator[.]worker[.]ts$',
      },
      to: { couldNotResolve: true },
    },
    {
      name: 'no-non-package-json',
      severity: 'error',
      from: {
        pathNot: '[.]d[.]ts$',
      },
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'no-feature-to-app',
      severity: 'error',
      from: {
        path: featurePackages.map(packagePath),
      },
      to: { path: '^src/' },
    },
    {
      name: 'no-generic-to-feature',
      severity: 'error',
      from: {
        path: genericPackages.map(packagePath),
      },
      to: {
        path: featurePackages.map(packagePath),
      },
    },
    {
      name: 'no-viz-to-app',
      severity: 'error',
      from: { path: packagePath('viz') },
      to: { path: '^src/' },
    },
    {
      name: 'no-viz-core-to-higher-level',
      severity: 'error',
      from: { path: '^packages/@quent/viz/src/core/' },
      to: { path: '^packages/@quent/viz/src/(?:timeline|grouped-table)/' },
    },
    {
      name: 'no-viz-grouped-table-to-chart-code',
      severity: 'error',
      from: { path: '^packages/@quent/viz/src/grouped-table/' },
      to: { path: '^packages/@quent/viz/src/(?:core|timeline)/' },
    },
    {
      name: 'no-viz-timeline-to-grouped-table',
      severity: 'error',
      from: { path: '^packages/@quent/viz/src/timeline/' },
      to: { path: '^packages/@quent/viz/src/grouped-table/' },
    },
    ...forbiddenPackageEdges,
    ...crossPackageRelativeImports,
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['(^|/)dist/', '^src/routeTree[.]gen[.]ts$', '^generated/'],
    },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: 'specify',
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'types', 'default'],
    },
  },
};

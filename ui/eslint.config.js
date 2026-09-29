// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-plugin-prettier/recommended';
import {
  allowedWorkspaceDependencies,
  featurePackages,
  knownPackages,
} from './scripts/dependency-policy.mjs';

const workspacePackages = knownPackages;
const privatePackageImportRestriction = {
  group: ['@quent/*/src', '@quent/*/src/**'],
  message: 'Import another package through its public exports.',
};

const packageBoundaryConfigs = workspacePackages.map(packageName => {
  const allowedDependencies = new Set(allowedWorkspaceDependencies[packageName] ?? []);
  const disallowedImports = workspacePackages
    .filter(
      dependencyName => dependencyName !== packageName && !allowedDependencies.has(dependencyName)
    )
    .flatMap(dependencyName => [`@quent/${dependencyName}`, `@quent/${dependencyName}/**`]);
  const patterns = [
    privatePackageImportRestriction,
    {
      group: disallowedImports,
      message: `@quent/${packageName} cannot depend on this workspace package.`,
    },
  ];

  if (featurePackages.includes(packageName) || packageName === 'viz') {
    patterns.push({
      group: ['@/*', '../../../../src/*', '../../../../src/**', '../../../../../src/**'],
      message: 'Feature packages cannot import from the application shell.',
    });
  }

  return {
    files: [`packages/@quent/${packageName}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', { patterns }],
    },
  };
});

export default tseslint.config(
  {
    // `examples/*` are self-contained consumer apps with their own ESLint
    // toolchains (e.g. `examples/quent-dag-panel` uses `@grafana/eslint-config`
    // and is linted via its own `npm run lint`). The Grafana plugin's
    // `.config/` directory is also vendor-scaffolded and must not be modified.
    // Each example's own CI lints itself; we don't want the root workspace
    // lint to second-guess them with a different rule set.
    ignores: [
      'dist',
      'src/routeTree.gen.ts',
      'examples/**',
      '**/dist/**',
      '**/node_modules/**',
      'generated/ts-bindings/**',
      '.e2e-data/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'off',
      'react-refresh/only-export-components': 'off',
      'react-hooks/incompatible-library': 'off',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [privatePackageImportRestriction],
        },
      ],
    },
  },
  ...packageBoundaryConfigs,
  {
    ...prettier,
    rules: {
      ...prettier.rules,
      curly: ['error', 'all'],
    },
  }
);

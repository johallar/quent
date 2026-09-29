// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const genericPackages = ['client', 'components', 'hooks', 'utils'];

export const featurePackages = [
  'features',
  'fsm',
  'reference-tree',
  'resource',
  'query-engine-core',
  'query-plan',
  'query-engine-resource',
  'query-engine-data-flow',
  'nvtx',
];

export const futurePackages = ['viz'];

const generic = genericPackages;

export const allowedWorkspaceDependencies = {
  client: ['schema', 'utils'],
  components: ['client', 'hooks', 'utils'],
  hooks: ['client', 'utils'],
  utils: [],
  features: ['schema'],
  fsm: ['features', ...generic, 'viz'],
  'reference-tree': ['features', ...generic],
  resource: ['features', 'fsm', 'reference-tree', 'viz', ...generic],
  'query-engine-core': ['features', ...generic],
  'query-plan': ['features', 'query-engine-core', 'viz', ...generic],
  'query-engine-resource': ['features', 'query-engine-core', 'resource', ...generic],
  'query-engine-data-flow': ['features', 'query-plan', ...generic],
  nvtx: ['features', 'viz', ...generic],
  viz: [...generic],
};

export const knownPackages = [
  ...new Set([...genericPackages, ...featurePackages, ...futurePackages]),
];

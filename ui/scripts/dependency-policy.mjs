// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const genericPackages = ['client', 'components', 'features', 'hooks', 'utils'];

export const featurePackages = [
  'fsm',
  'entities',
  'entities-resource',
  'entities-query-plan',
  'reference-tree',
  'resource',
  'query-engine-core',
  'query-plan',
  'query-engine-resource',
  'query-engine-data-flow',
  'nvtx',
];

export const requiredPackageSkeletons = [
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
  client: ['utils'],
  components: ['client', 'hooks', 'utils'],
  hooks: ['client', 'utils'],
  utils: [],
  features: ['schema'],
  fsm: [...generic, 'viz'],
  entities: [...generic, 'viz'],
  'entities-resource': ['entities', 'resource', ...generic, 'viz'],
  'entities-query-plan': ['entities', 'query-plan', ...generic, 'viz'],
  'reference-tree': [...generic],
  resource: ['reference-tree', 'viz', ...generic],
  'query-engine-core': [...generic],
  'query-plan': ['query-engine-core', 'viz', ...generic],
  'query-engine-resource': ['query-engine-core', 'resource', ...generic],
  'query-engine-data-flow': ['query-plan', ...generic],
  nvtx: ['viz', ...generic],
  viz: [...generic],
};

export const knownPackages = [
  ...new Set([...genericPackages, ...featurePackages, ...futurePackages]),
];

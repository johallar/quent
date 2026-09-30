// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CAPABILITY_IDS,
  FEATURE_IDS,
  defineCapabilitySet,
  defineFeatureSet,
} from '@quent/features';

const {
  schemaFsm,
  schemaQueryPlan,
  schemaReferenceTree,
  schemaResource,
  serviceDataFlow,
  serviceEntityList,
  serviceNvtx,
  serviceQueryEngine,
  serviceResourceTimeline,
} = CAPABILITY_IDS;

const {
  entities,
  entitiesQueryPlan,
  entitiesResource,
  nvtx,
  queryEngineCore,
  queryEngineDataFlow,
  queryEngineResource,
  queryPlan,
  referenceTree,
  resource,
} = FEATURE_IDS;

export const simulatorFeatureSet = defineFeatureSet([
  {
    id: entities,
    requiresCapabilities: [schemaFsm, serviceEntityList],
  },
  {
    id: referenceTree,
    requiresCapabilities: [schemaReferenceTree],
  },
  {
    id: resource,
    requiresCapabilities: [schemaResource, serviceResourceTimeline],
    dependsOnFeatures: [referenceTree],
  },
  {
    id: entitiesResource,
    dependsOnFeatures: [entities, resource],
  },
  {
    id: queryEngineCore,
    requiresCapabilities: [serviceQueryEngine],
  },
  {
    id: queryEngineResource,
    dependsOnFeatures: [queryEngineCore, resource],
  },
  {
    id: queryPlan,
    requiresCapabilities: [schemaQueryPlan],
    dependsOnFeatures: [queryEngineCore],
  },
  {
    id: entitiesQueryPlan,
    dependsOnFeatures: [entities, queryPlan],
  },
  {
    id: queryEngineDataFlow,
    requiresCapabilities: [serviceDataFlow],
    dependsOnFeatures: [queryPlan],
  },
  {
    id: nvtx,
    requiresCapabilities: [serviceNvtx],
  },
]);

export const simulatorCapabilitySet = defineCapabilitySet(Object.values(CAPABILITY_IDS));

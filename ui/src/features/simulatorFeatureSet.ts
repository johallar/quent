// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import {
  CAPABILITY_IDS,
  FEATURE_IDS,
  defineCapabilitySet,
  defineFeatureSet,
} from '@quent/features';

export const simulatorFeatureSet = defineFeatureSet([
  {
    id: FEATURE_IDS.entities,
    requiresCapabilities: [CAPABILITY_IDS.schemaFsm, CAPABILITY_IDS.serviceEntityList],
  },
  {
    id: FEATURE_IDS.referenceTree,
    requiresCapabilities: [CAPABILITY_IDS.schemaReferenceTree],
  },
  {
    id: FEATURE_IDS.resource,
    requiresCapabilities: [CAPABILITY_IDS.schemaResource, CAPABILITY_IDS.serviceResourceTimeline],
    dependsOnFeatures: [FEATURE_IDS.referenceTree],
  },
  {
    id: FEATURE_IDS.entitiesResource,
    dependsOnFeatures: [FEATURE_IDS.entities, FEATURE_IDS.resource],
  },
  {
    id: FEATURE_IDS.queryEngineCore,
    requiresCapabilities: [CAPABILITY_IDS.serviceQueryEngine],
  },
  {
    id: FEATURE_IDS.queryEngineResource,
    dependsOnFeatures: [FEATURE_IDS.queryEngineCore, FEATURE_IDS.resource],
  },
  {
    id: FEATURE_IDS.queryPlan,
    requiresCapabilities: [CAPABILITY_IDS.schemaQueryPlan],
    dependsOnFeatures: [FEATURE_IDS.queryEngineCore],
  },
  {
    id: FEATURE_IDS.entitiesQueryPlan,
    dependsOnFeatures: [FEATURE_IDS.entities, FEATURE_IDS.queryPlan],
  },
  {
    id: FEATURE_IDS.queryEngineDataFlow,
    requiresCapabilities: [CAPABILITY_IDS.serviceDataFlow],
    dependsOnFeatures: [FEATURE_IDS.queryPlan],
  },
  {
    id: FEATURE_IDS.nvtx,
    requiresCapabilities: [CAPABILITY_IDS.serviceNvtx],
  },
]);

export const simulatorCapabilitySet = defineCapabilitySet(Object.values(CAPABILITY_IDS));

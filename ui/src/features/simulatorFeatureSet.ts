// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FEATURE_IDS, defineFeatureSet } from '@quent/features';

export const simulatorFeatureSet = defineFeatureSet([
  { id: FEATURE_IDS.queryEngineCore },
  { id: FEATURE_IDS.fsm },
  { id: FEATURE_IDS.referenceTree },
  {
    id: FEATURE_IDS.resource,
    dependencies: [FEATURE_IDS.fsm, FEATURE_IDS.referenceTree],
  },
  {
    id: FEATURE_IDS.queryEngineResource,
    dependencies: [FEATURE_IDS.queryEngineCore, FEATURE_IDS.resource],
  },
  {
    id: FEATURE_IDS.queryPlan,
    dependencies: [FEATURE_IDS.queryEngineCore],
  },
  {
    id: FEATURE_IDS.queryEngineDataFlow,
    dependencies: [FEATURE_IDS.queryPlan],
  },
  { id: FEATURE_IDS.nvtx },
]);

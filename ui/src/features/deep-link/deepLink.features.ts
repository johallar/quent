// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { DeepLinkFields } from './deepLink.fields';
import type { DeepLinkStateV3 } from './deepLink.schema';

export interface DeepLinkFeatureAvailability {
  queryPlan: boolean;
  dataFlow: boolean;
}

export function filterDeepLinkFieldsForFeatures(
  fields: DeepLinkFields,
  features: DeepLinkFeatureAvailability
): DeepLinkFields {
  return {
    ...fields,
    selection: features.queryPlan ? fields.selection : undefined,
    dag: features.queryPlan ? fields.dag : undefined,
    operatorTable: features.queryPlan ? fields.operatorTable : undefined,
    dataFlow: features.dataFlow ? fields.dataFlow : undefined,
  };
}

export function filterDeepLinkStateForFeatures(
  state: DeepLinkStateV3,
  features: DeepLinkFeatureAvailability
): DeepLinkStateV3 {
  const filtered = { ...state };
  if (!features.queryPlan) {
    delete filtered.selection;
    delete filtered.dag;
    delete filtered.operatorTable;
  }
  if (!features.dataFlow) {
    delete filtered.dataFlow;
  }
  return filtered;
}

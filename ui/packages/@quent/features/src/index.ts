// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export {
  CONTRIBUTION_SLOTS,
  FEATURE_IDS,
  createFeatureRegistry,
  defineFeatureSet,
} from './registry';
export type {
  BuiltInContributionSlots,
  BuiltInFeatureId,
  ContributionSlot,
  FeatureContribution,
  FeatureDefinition,
  FeatureId,
  FeatureRegistration,
  FeatureRegistry,
  FeatureSet,
  RegisteredContribution,
} from './registry';
export { resolveFeatureSetFromSchema } from './schemaCapabilities';
export type {
  FeatureResolutionDecision,
  FeatureResolutionSource,
  SchemaFeatureResolution,
  SchemaFeatureResolutionOptions,
} from './schemaCapabilities';

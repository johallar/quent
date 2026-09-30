// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export {
  CAPABILITY_IDS,
  FEATURE_IDS,
  capabilityId,
  createCapabilityRegistry,
  createFeatureRegistry,
  defineCapabilitySet,
  defineFeatureSet,
  featureId,
} from './registry';
export type {
  BuiltInCapabilityId,
  BuiltInFeatureId,
  CapabilityId,
  CapabilityRegistry,
  CapabilitySet,
  FeatureDefinition,
  FeatureId,
  FeatureRegistration,
  FeatureRegistry,
  FeatureSet,
  RegisteredContribution,
  UnavailableFeature,
} from './registry';
export { CONTRIBUTION_SLOTS } from './contributions';
export type {
  BuiltInContributionSlots,
  ContributionSlot,
  DataLoaderContext,
  DataLoaderContribution,
  DetailSectionContribution,
  DetailSectionRenderContext,
  FeatureContribution,
  FeatureRenderer,
  FeatureStateCodec,
  NavigationContribution,
  ProviderContribution,
  SidePanelContribution,
  SidePanelRenderContext,
  StateCodecContribution,
  TimelineRange,
  TimelineRowContribution,
  TimelineRowRenderContext,
} from './contributions';
export type {
  EntityContributionSlots,
  EntityDetailContribution,
  EntityDetailRenderContext,
  EntityFilterContribution,
  EntityFilterRenderContext,
  EntityRequestDecoratorContribution,
} from './entityContributions';

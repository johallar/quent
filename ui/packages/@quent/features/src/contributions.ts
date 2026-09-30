// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { ComponentType, PropsWithChildren, ReactNode } from 'react';

export const CONTRIBUTION_SLOTS = {
  navigation: 'navigation',
  sidePanel: 'side-panel',
  timelineRow: 'timeline-row',
  detailSection: 'detail-section',
  provider: 'provider',
  dataLoader: 'data-loader',
  stateCodec: 'state-codec',
} as const;

export type ContributionSlot = (typeof CONTRIBUTION_SLOTS)[keyof typeof CONTRIBUTION_SLOTS];

export interface FeatureContribution {
  readonly id: string;
  readonly order?: number;
}

export type FeatureRenderer<TContext = void> = (context: TContext) => ReactNode;

export interface NavigationContribution extends FeatureContribution {
  readonly label: string;
  readonly to: string;
}

export interface SidePanelRenderContext {
  readonly close: () => void;
}

export interface SidePanelContribution extends FeatureContribution {
  readonly title: string;
  readonly render: FeatureRenderer<SidePanelRenderContext>;
}

export interface TimelineRange {
  readonly startNs: bigint;
  readonly endNs: bigint;
}

export interface TimelineRowRenderContext {
  readonly range: TimelineRange;
}

export interface TimelineRowContribution extends FeatureContribution {
  readonly label: string;
  readonly render: FeatureRenderer<TimelineRowRenderContext>;
}

export interface DetailSectionRenderContext {
  readonly selection: unknown;
}

export interface DetailSectionContribution extends FeatureContribution {
  readonly title: string;
  readonly render: FeatureRenderer<DetailSectionRenderContext>;
}

export interface ProviderContribution extends FeatureContribution {
  readonly component: ComponentType<PropsWithChildren>;
}

export interface DataLoaderContext {
  readonly signal: AbortSignal;
}

export interface DataLoaderContribution extends FeatureContribution {
  readonly load: (context: DataLoaderContext) => Promise<void>;
}

export interface FeatureStateCodec<TState = unknown, TEncoded = unknown> {
  readonly encode: (state: TState) => TEncoded | undefined;
  readonly decode: (encoded: unknown) => TState | undefined;
}

export interface StateCodecContribution extends FeatureContribution {
  readonly field: string;
  readonly codec: FeatureStateCodec;
}

export interface BuiltInContributionSlots {
  readonly navigation: NavigationContribution;
  readonly 'side-panel': SidePanelContribution;
  readonly 'timeline-row': TimelineRowContribution;
  readonly 'detail-section': DetailSectionContribution;
  readonly provider: ProviderContribution;
  readonly 'data-loader': DataLoaderContribution;
  readonly 'state-codec': StateCodecContribution;
}

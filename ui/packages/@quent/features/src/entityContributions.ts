// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type { FeatureContribution, FeatureRenderer } from './contributions';

export interface EntityFilterRenderContext<TEntity> {
  readonly entities: readonly TEntity[];
}

export interface EntityFilterContribution<TEntity = unknown> extends FeatureContribution {
  readonly label: string;
  readonly matches: (entity: TEntity) => boolean;
  readonly renderControl?: FeatureRenderer<EntityFilterRenderContext<TEntity>>;
}

export interface EntityRequestDecoratorContribution<
  TRequest = unknown,
> extends FeatureContribution {
  readonly decorate: (request: TRequest) => TRequest;
}

export interface EntityDetailRenderContext<TEntity> {
  readonly entity: TEntity;
}

export interface EntityDetailContribution<TEntity = unknown> extends FeatureContribution {
  readonly title: string;
  readonly render: FeatureRenderer<EntityDetailRenderContext<TEntity>>;
}

export interface EntityContributionSlots<TEntity = unknown, TRequest = unknown> {
  readonly filter: EntityFilterContribution<TEntity>;
  readonly 'request-decorator': EntityRequestDecoratorContribution<TRequest>;
  readonly detail: EntityDetailContribution<TEntity>;
}

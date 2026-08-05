// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import type {
  Engine,
  EntityRef,
  Operator,
  Plan,
  Port,
  Query,
  QueryGroup,
  Resource,
  ResourceGroup,
  ResourceTypeDecl,
  Worker,
} from './generated';

export type EntityTypeValue =
  | Engine
  | Operator
  | Plan
  | Port
  | Query
  | QueryGroup
  | Resource
  | ResourceGroup
  | ResourceTypeDecl
  | Worker;

export type SingleEntity = Engine | Query | QueryGroup;

type KeysOfUnion<T> = T extends T ? keyof T : never;

export type EntityRefKey = KeysOfUnion<EntityRef>;

export const EntityTypeKey = {
  Resource: 'Resource',
  ResourceGroup: 'ResourceGroup',
} as const;

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { resolveNodeOpacity } from '../quent-views/query-plan/nodeOpacity';

export function getNodeOpacityClass(input: Parameters<typeof resolveNodeOpacity>[0]): string {
  const opacity = resolveNodeOpacity(input);
  return opacity === 'full' ? 'opacity-100' : opacity === 'faded' ? 'opacity-20' : 'opacity-35';
}

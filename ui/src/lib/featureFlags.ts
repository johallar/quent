// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

const DISABLED_ENV_VALUES = new Set(['0', 'false', 'no', 'off']);

export type FeatureFlag = 'QUERY_DIFF';

function readBooleanEnvFlag(value: string | boolean | undefined, defaultValue: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (value == null || value.length === 0) return defaultValue;
  return !DISABLED_ENV_VALUES.has(value.toLowerCase());
}

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  switch (flag) {
    case 'QUERY_DIFF':
      return readBooleanEnvFlag(import.meta.env.VITE_QUERY_DIFF, true);
  }
}

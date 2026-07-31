// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export const DEFAULT_LONG_ENTITY_THRESHOLD_SECONDS = 60;
export const MIN_LONG_ENTITY_THRESHOLD_SECONDS = 0.1;
export const MAX_LONG_ENTITY_THRESHOLD_SECONDS = 600;
export const LONG_ENTITY_THRESHOLD_STEP_SECONDS = 0.1;
export const DEFAULT_LONG_ENTITY_THRESHOLD_AUTO = false;

/** Clamp and snap a manual long-entity threshold to the supported range. */
export function clampLongEntityThresholdSeconds(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_LONG_ENTITY_THRESHOLD_SECONDS;

  const snapped =
    Math.round(value / LONG_ENTITY_THRESHOLD_STEP_SECONDS) * LONG_ENTITY_THRESHOLD_STEP_SECONDS;
  return Number(
    Math.min(
      MAX_LONG_ENTITY_THRESHOLD_SECONDS,
      Math.max(MIN_LONG_ENTITY_THRESHOLD_SECONDS, snapped)
    ).toFixed(1)
  );
}

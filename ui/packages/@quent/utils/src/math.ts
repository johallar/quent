// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalize logarithmically to [0, 1], with a neutral midpoint for invalid or
 * constant ranges. Signed log1p keeps zero and negative measurements defined.
 */
export function normalizeLogScale(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max) || max <= min) {
    return 0.5;
  }
  const clamped = clamp(value, min, max);
  if (clamped === min) {
    return 0;
  }
  if (clamped === max) {
    return 1;
  }
  const log = (n: number) => Math.sign(n) * Math.log1p(Math.abs(n));
  const low = log(min);
  const range = log(max) - low;
  return range > 0 ? clamp((log(clamped) - low) / range, 0, 1) : 0.5;
}

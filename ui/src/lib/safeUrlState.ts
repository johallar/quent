// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Runs `fn` and returns its result. If `fn` throws, logs a warning prefixed
 * with `[url-state/<label>]` and returns `fallback`.
 *
 * Used to harden every step of the URL persistence pipeline (decode, encode,
 * hydrate, navigate) so a single bad value can never break the app.
 */
export function safeRun<T>(label: string, fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch (err) {
    console.warn(`[url-state/${label}]`, err);
    return fallback;
  }
}

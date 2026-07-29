// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import type { OperatorTableRow } from './types';
import { operatorRowOverlapsWindow } from './utils';

function row(start: number, end: number): OperatorTableRow {
  return { activeSpan: { start, end } } as OperatorTableRow;
}

describe('operatorRowOverlapsWindow', () => {
  it('includes partial and containing overlaps', () => {
    expect(operatorRowOverlapsWindow(row(5, 15), { start: 10, end: 20 })).toBe(true);
    expect(operatorRowOverlapsWindow(row(0, 30), { start: 10, end: 20 })).toBe(true);
  });

  it('excludes adjacent, disjoint, and missing spans', () => {
    expect(operatorRowOverlapsWindow(row(0, 10), { start: 10, end: 20 })).toBe(false);
    expect(operatorRowOverlapsWindow(row(20, 30), { start: 10, end: 20 })).toBe(false);
    expect(
      operatorRowOverlapsWindow({ activeSpan: null } as OperatorTableRow, {
        start: 10,
        end: 20,
      })
    ).toBe(false);
  });
});

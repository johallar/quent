// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  escapeTooltipText,
  formatQueryDiffTimelineTooltipHtml,
  formatRelativePercent,
} from './QueryDiffTimelineTooltip.utils';

describe('formatRelativePercent', () => {
  it('formats small non-zero values with one decimal', () => {
    expect(formatRelativePercent(0.055)).toBe('5.5%');
  });

  it('formats larger values with no decimals', () => {
    expect(formatRelativePercent(0.25)).toBe('25%');
  });
});

describe('formatQueryDiffTimelineTooltipHtml', () => {
  it('includes baseline, comparison, delta, and direction', () => {
    const html = formatQueryDiffTimelineTooltipHtml(
      {
        label: 'Query B',
        relative: 0.25,
        signedDelta: 10,
        baseline: 40,
        comparison: 50,
        timestamp: 1_500,
        formatter: value => `${value}ms`,
      },
      { positive: '#0f0', negative: '#f00', neutral: '#888' }
    );

    expect(html).toContain('<strong>Query B</strong>');
    expect(html).toContain('Comparison higher');
    expect(html).toContain('Baseline: 40ms');
    expect(html).toContain('Comparison: 50ms');
    expect(html).toContain('Delta: <span');
    expect(html).toContain('10ms');
    expect(html).toContain('Time:');
  });

  it('escapes unsafe label text', () => {
    const html = formatQueryDiffTimelineTooltipHtml(
      {
        label: '<script>',
        relative: 0,
        signedDelta: 0,
        baseline: 0,
        comparison: 0,
        timestamp: 0,
        formatter: value => String(value),
      },
      { positive: '#0f0', negative: '#f00', neutral: '#888' }
    );

    expect(html).toContain(escapeTooltipText('<script>'));
    expect(html).not.toContain('<script>');
  });
});

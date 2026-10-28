// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import { askCommandRegistry, askUsage, getAskCommand } from './askCommands';

describe('ask command dispatcher', () => {
  it('registers analysis questions and specialized commands', () => {
    expect([...askCommandRegistry.keys()]).toEqual([
      'engines',
      'query-groups',
      'queries',
      'query-lifecycle',
      'query-structure',
      'operator-facts',
      'operator-statistics-summary',
      'longest-resource-users',
      'query-diff',
    ]);
    expect(askUsage).toContain('pnpm ask <command>');
    expect(askUsage).toContain('query-groups');
    expect(askUsage).toContain('query-lifecycle');
    expect(askUsage).toContain('query-structure');
    expect(askUsage).toContain('operator-facts');
    expect(askUsage).toContain('operator-statistics-summary');
    expect(askUsage).toContain('longest-resource-users');
    expect(askUsage).toContain('query-diff');
  });

  it('provides command-specific usage', () => {
    expect(getAskCommand('query-lifecycle').usage).toContain('pnpm ask query-lifecycle');
    expect(getAskCommand('query-structure').usage).toContain('pnpm ask query-structure');
    expect(getAskCommand('operator-facts').usage).toContain('pnpm ask operator-facts');
    expect(getAskCommand('operator-statistics-summary').usage).toContain(
      'pnpm ask operator-statistics-summary'
    );
    expect(getAskCommand('longest-resource-users').usage).toContain(
      'pnpm ask longest-resource-users'
    );
    expect(getAskCommand('query-diff').usage).toContain('pnpm ask query-diff');
  });

  it('allows interactive selection with JSON output', () => {
    const usage = getAskCommand('operator-facts').usage;

    expect(usage).toContain('--json');
    expect(usage).toContain('selection may still be interactive');
    expect(usage).not.toContain('never open interactive prompts');
  });

  it('rejects unknown commands with the supported command list', () => {
    expect(() => getAskCommand('unknown')).toThrow(
      'Supported commands: engines, query-groups, queries, query-lifecycle, query-structure, operator-facts, operator-statistics-summary, longest-resource-users, query-diff'
    );
  });
});

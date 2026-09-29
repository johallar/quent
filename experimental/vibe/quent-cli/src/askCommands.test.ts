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
      'longest-resource-users',
      'query-diff',
    ]);
    expect(askUsage).toContain('pnpm ask <command>');
    expect(askUsage).toContain('query-groups');
    expect(askUsage).toContain('longest-resource-users');
    expect(askUsage).toContain('query-diff');
  });

  it('provides command-specific usage', () => {
    expect(getAskCommand('longest-resource-users').usage).toContain(
      'pnpm ask longest-resource-users'
    );
    expect(getAskCommand('query-diff').usage).toContain('pnpm ask query-diff');
  });

  it('requires question selections explicitly in JSON mode', async () => {
    await expect(getAskCommand('longest-resource-users').run(['--json'])).rejects.toThrow(
      'JSON mode requires explicit --engine, --query, --resource'
    );
  });

  it('rejects unknown commands with the supported command list', () => {
    expect(() => getAskCommand('unknown')).toThrow(
      'Supported commands: engines, query-groups, queries, longest-resource-users, query-diff'
    );
  });
});

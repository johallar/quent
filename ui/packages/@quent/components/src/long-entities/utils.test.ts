// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { describe, it, expect } from 'vitest';
import type { FiniteStateMachine, FsmTransition } from '@quent/utils';
import { buildLongEntityEntries } from './utils';

function transition(
  name: string,
  timestamp: number,
  overrides: Partial<FsmTransition> = {}
): FsmTransition {
  return {
    name,
    timestamp,
    usages: [],
    attributes: [],
    derived_attributes: [],
    ...overrides,
  };
}

function makeFsm(
  id: string,
  transitions: FsmTransition[],
  overrides: Partial<FiniteStateMachine> = {}
): FiniteStateMachine {
  return {
    id,
    type_name: 'task',
    instance_name: '',
    transitions,
    ...overrides,
  };
}

describe('buildLongEntityEntries', () => {
  it('returns [] for no items', () => {
    expect(buildLongEntityEntries([], {}, 'light')).toEqual([]);
  });

  it('builds one segment per consecutive transition pair', () => {
    const fsm = makeFsm('e1', [
      transition('queueing', 0),
      transition('computing', 1),
      transition('exit', 3),
    ]);
    const [entry] = buildLongEntityEntries([fsm], {}, 'light');
    expect(entry.segments).toHaveLength(2);
    expect(entry.segments.map(s => s.stateName)).toEqual(['queueing', 'computing']);
    // seconds → elapsed milliseconds
    expect(entry.segments[0]).toMatchObject({ startMs: 0, endMs: 1000 });
    expect(entry.segments[1]).toMatchObject({ startMs: 1000, endMs: 3000 });
  });

  it('spans the bar from first to last transition', () => {
    const fsm = makeFsm('e1', [
      transition('a', 0.5),
      transition('b', 1.5),
      transition('exit', 2.5),
    ]);
    const [entry] = buildLongEntityEntries([fsm], {}, 'light');
    expect(entry.startMs).toBe(500);
    expect(entry.endMs).toBe(2500);
  });

  it('drops single-transition FSMs (no state span)', () => {
    const fsm = makeFsm('e1', [transition('a', 0)]);
    expect(buildLongEntityEntries([fsm], {}, 'light')).toEqual([]);
  });

  it('drops zero-duration segments', () => {
    const fsm = makeFsm('e1', [
      transition('a', 1),
      transition('b', 1), // zero duration → dropped
      transition('exit', 2),
    ]);
    const [entry] = buildLongEntityEntries([fsm], {}, 'light');
    expect(entry.segments).toHaveLength(1);
    expect(entry.segments[0].stateName).toBe('b');
  });

  it('drops entities whose only segments are zero-duration', () => {
    const fsm = makeFsm('e1', [transition('a', 1), transition('exit', 1)]);
    expect(buildLongEntityEntries([fsm], {}, 'light')).toEqual([]);
  });

  it('uses instance_name for the label, falling back to id', () => {
    const named = makeFsm('e1', [transition('a', 0), transition('exit', 1)], {
      instance_name: 'task-7',
    });
    const anon = makeFsm('e2', [transition('a', 0), transition('exit', 1)]);
    const [n, a] = buildLongEntityEntries([named, anon], {}, 'light');
    expect(n.label).toBe('task-7');
    expect(a.label).toBe('e2');
  });

  it('assigns a color to each segment', () => {
    const fsm = makeFsm('e1', [transition('a', 0), transition('exit', 1)]);
    const [entry] = buildLongEntityEntries([fsm], {}, 'light');
    expect(entry.segments[0].color).toMatch(/^#/);
  });

  it('carries transition attributes onto segments', () => {
    const fsm = makeFsm('e1', [
      transition('a', 0, {
        attributes: [{ key: 'bytes', value: { Int: 42 } } as unknown as never],
      }),
      transition('exit', 1),
    ]);
    const [entry] = buildLongEntityEntries([fsm], {}, 'light');
    expect(entry.segments[0].attributes).toHaveLength(1);
  });

  it('stacks non-overlapping entities onto the same row', () => {
    const a = makeFsm('a', [transition('s', 0), transition('exit', 1)]);
    const b = makeFsm('b', [transition('s', 2), transition('exit', 3)]);
    const entries = buildLongEntityEntries([a, b], {}, 'light');
    expect(entries.map(e => e.rowIndex).sort()).toEqual([0, 0]);
  });

  it('stacks overlapping entities onto different rows', () => {
    const a = makeFsm('a', [transition('s', 0), transition('exit', 10)]);
    const b = makeFsm('b', [transition('s', 2), transition('exit', 8)]);
    const entries = buildLongEntityEntries([a, b], {}, 'light');
    expect(new Set(entries.map(e => e.rowIndex)).size).toBe(2);
  });
});

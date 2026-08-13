// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { thinScrollbarClass, FsmCapacityChart, PointerTooltipPortal } from '@quent/components';
import type { PointerPosition } from '@quent/components';
import {
  formatDuration,
  formatDurationForWindow,
  formatBytes,
  getColorForKey,
  isBytesStat,
  unwrapTaggedValue,
} from '@quent/utils';
import type { EntityRef, FiniteStateMachine, QueryBundle } from '@quent/utils';
import { useTheme, THEME_DARK } from '@/contexts/ThemeContext';
import { ResourceUsageList } from './ResourceUsageList';
import { TransitionAttributes } from './TransitionAttributes';

interface EntityDetailPanelProps {
  fsm: FiniteStateMachine | null;
  resourceLabel: (id: string) => string;
  operatorLabel: (id: string) => string;
  stateColorFn?: (name: string) => string;
  queryBundle: QueryBundle<EntityRef>;
}

export function EntityDetailPanel({
  fsm,
  resourceLabel,
  operatorLabel,
  stateColorFn,
  queryBundle,
}: EntityDetailPanelProps) {
  const { theme } = useTheme();
  const paletteTheme = theme === THEME_DARK ? ('dark' as const) : ('light' as const);
  const [copied, setCopied] = useState(false);
  const [barTooltip, setBarTooltip] = useState<{ name: string; pct: number } | null>(null);
  const [barPointer, setBarPointer] = useState<PointerPosition | null>(null);

  if (!fsm) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Select an entity to view its states.
      </div>
    );
  }

  const firstTs = fsm.transitions[0]?.timestamp ?? 0;
  const lastTs = fsm.transitions[fsm.transitions.length - 1]?.timestamp ?? firstTs;
  const totalSpanMs = (lastTs - firstTs) * 1000;

  // Precompute per-transition durations (null for the final state)
  const durations = fsm.transitions.map((t, i) => {
    const next = fsm.transitions[i + 1];
    return next ? (next.timestamp - t.timestamp) * 1000 : null;
  });

  // Aggregate total time per state name (insertion order = first appearance)
  const stateTimeMs = new Map<string, number>();
  fsm.transitions.forEach((t, i) => {
    const d = durations[i];
    if (d != null) {
      stateTimeMs.set(t.name, (stateTimeMs.get(t.name) ?? 0) + d);
    }
  });

  // Find the state that consumed the most time
  let dominantState: { name: string; pct: number; color: string } | null = null;
  if (totalSpanMs > 0 && stateTimeMs.size > 0) {
    let maxMs = 0;
    let maxName = '';
    stateTimeMs.forEach((ms, name) => {
      if (ms > maxMs) {
        maxMs = ms;
        maxName = name;
      }
    });
    dominantState = {
      name: maxName,
      pct: (maxMs / totalSpanMs) * 100,
      color: stateColorFn ? stateColorFn(maxName) : getColorForKey(maxName, paletteTheme),
    };
  }

  function copyId() {
    void navigator.clipboard.writeText(fsm!.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Compact header: name + type badge on one line, UUID + copy on second */}
      <div className="shrink-0 border-b bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{fsm.instance_name}</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {fsm.type_name}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-1">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
            {fsm.id}
          </span>
          <button
            onClick={copyId}
            aria-label="Copy ID"
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
          </button>
        </div>
      </div>

      {/* Summary strip */}
      <div className="shrink-0 border-b bg-muted/30 px-3 py-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Total span</span>
          <span className="tabular-nums font-medium">{formatDuration(totalSpanMs)}</span>
        </div>
        {dominantState && (
          <div className="mt-0.5 flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Dominant state</span>
            <span className="font-medium" style={{ color: dominantState.color }}>
              {dominantState.name} · {dominantState.pct.toFixed(1)}%
            </span>
          </div>
        )}
        {totalSpanMs > 0 && stateTimeMs.size > 0 && (
          <div className="mt-2 flex h-2 w-full overflow-hidden rounded-full">
            {[...stateTimeMs.entries()].map(([name, ms]) => {
              const color = stateColorFn ? stateColorFn(name) : getColorForKey(name, paletteTheme);
              const pct = (ms / totalSpanMs) * 100;
              return (
                <div
                  key={name}
                  role="img"
                  aria-label={`${name}: ${pct.toFixed(1)}%`}
                  tabIndex={0}
                  style={{ width: `${pct}%`, backgroundColor: color }}
                  className="focus-visible:brightness-90"
                  onMouseEnter={e => {
                    setBarTooltip({ name, pct });
                    setBarPointer({ clientX: e.clientX, clientY: e.clientY });
                  }}
                  onMouseMove={e => setBarPointer({ clientX: e.clientX, clientY: e.clientY })}
                  onMouseLeave={() => {
                    setBarTooltip(null);
                    setBarPointer(null);
                  }}
                  onFocus={e => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setBarTooltip({ name, pct });
                    setBarPointer({ clientX: rect.left + rect.width / 2, clientY: rect.top });
                  }}
                  onBlur={() => {
                    setBarTooltip(null);
                    setBarPointer(null);
                  }}
                />
              );
            })}
          </div>
        )}
        <PointerTooltipPortal hover={barTooltip ? barPointer : null}>
          {barTooltip && (
            <div className="rounded bg-popover px-2 py-1.5 text-[11px] leading-tight text-foreground shadow-md">
              <span className="font-medium">{barTooltip.name}</span>
              <span className="ml-2 text-muted-foreground">{barTooltip.pct.toFixed(1)}%</span>
            </div>
          )}
        </PointerTooltipPortal>
      </div>

      <FsmCapacityChart
        transitions={fsm.transitions}
        isDark={theme === THEME_DARK}
        resourceLabel={resourceLabel}
      />

      <ol className={`min-h-0 flex-1 space-y-2 overflow-auto p-3 ${thinScrollbarClass}`}>
        {fsm.transitions.map((transition, index) => {
          const durationMs = durations[index] ?? null;
          const isBottleneck =
            durationMs != null && totalSpanMs > 0 && durationMs / totalSpanMs > 0.5;
          const stateColor = stateColorFn
            ? stateColorFn(transition.name)
            : getColorForKey(transition.name, paletteTheme);
          const pct =
            durationMs != null && totalSpanMs > 0
              ? Math.min(100, (durationMs / totalSpanMs) * 100)
              : null;

          return (
            <li
              key={`${index}-${transition.name}`}
              className="rounded border bg-card p-2"
              style={{ borderLeftColor: stateColor, borderLeftWidth: 3 }}
            >
              {/* State name + duration (prominent) + absolute timestamp (secondary) */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium">
                  <span className="text-muted-foreground">{index + 1}.</span> {transition.name}
                </span>
                <div className="flex shrink-0 flex-col items-end">
                  {durationMs != null && (
                    <span
                      className={`tabular-nums text-sm font-medium ${
                        isBottleneck ? 'text-orange-500 dark:text-orange-400' : ''
                      }`}
                    >
                      {formatDuration(durationMs)}
                    </span>
                  )}
                  <span className="tabular-nums text-xs text-muted-foreground">
                    @{formatDurationForWindow(transition.timestamp * 1000, totalSpanMs, 15)}
                  </span>
                </div>
              </div>

              {/* Proportional duration bar */}
              {pct != null && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: stateColor }}
                  />
                </div>
              )}

              <ResourceUsageList
                usages={transition.usages}
                resourceLabel={resourceLabel}
                queryBundle={queryBundle}
              />
              <TransitionAttributes
                attributes={transition.attributes}
                derivedAttributes={transition.derived_attributes}
                operatorLabel={operatorLabel}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Maximize2, Settings } from 'lucide-react';
import {
  useHideTasks,
  useSetHideTasks,
  useSetZoomRange,
  useSetDebouncedZoomRange,
  useDebouncedZoomRange,
  useLongEntityThresholdSeconds,
  useSetLongEntityThresholdSeconds,
  useLongEntityThresholdAuto,
  useSetLongEntityThresholdAuto,
} from '@quent/hooks';
import {
  MAX_LONG_ENTITY_THRESHOLD_SECONDS,
  MIN_LONG_ENTITY_THRESHOLD_SECONDS,
  LONG_ENTITY_THRESHOLD_STEP_SECONDS,
} from '@quent/utils';
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover';
import { Input } from '../ui/input';
import { getLongEntitiesThreshold } from '../lib/timeline.utils';
import { QueryToolbar } from './QueryToolbar';

/** Toolbar for the timeline view: shows active operator filter, zoom reset, and settings. */
export function TimelineToolbar({ durationSeconds }: { durationSeconds: number }) {
  const hideTasks = useHideTasks();
  const setHideTasks = useSetHideTasks();
  const setZoomRange = useSetZoomRange();
  const setDebouncedZoomRange = useSetDebouncedZoomRange();
  const debouncedZoomRange = useDebouncedZoomRange();
  const longEntityThresholdSeconds = useLongEntityThresholdSeconds();
  const setLongEntityThresholdSeconds = useSetLongEntityThresholdSeconds();
  const longEntityThresholdAuto = useLongEntityThresholdAuto();
  const setLongEntityThresholdAuto = useSetLongEntityThresholdAuto();
  const visibleWindowSeconds =
    debouncedZoomRange.end > debouncedZoomRange.start
      ? debouncedZoomRange.end - debouncedZoomRange.start
      : durationSeconds;
  const effectiveLongEntityThresholdSeconds = getLongEntitiesThreshold(visibleWindowSeconds, {
    auto: longEntityThresholdAuto,
    seconds: longEntityThresholdSeconds,
  });
  const formattedEffectiveThreshold = effectiveLongEntityThresholdSeconds.toLocaleString(
    undefined,
    { maximumFractionDigits: 3 }
  );

  const resetZoom = () => {
    const full = { start: 0, end: durationSeconds };
    setZoomRange(full);
    setDebouncedZoomRange(full);
  };

  return (
    <QueryToolbar>
      <button
        onClick={resetZoom}
        className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
        title="Reset zoom"
      >
        <Maximize2 className="h-3 w-3" />
        <span>Reset zoom</span>
      </button>

      <div className="h-3 w-px bg-border" />

      <Popover>
        <PopoverTrigger asChild>
          <button
            className="inline-flex items-center rounded-sm p-0.5 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
            title="Timeline settings"
          >
            <Settings className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 space-y-3 text-xs">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideTasks}
              onChange={e => setHideTasks(e.target.checked)}
              className="h-3 w-3 rounded-sm accent-primary cursor-pointer"
            />
            <span>Hide tasks</span>
          </label>
          <div className="border-t border-border pt-3">
            <label className="flex cursor-pointer items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={longEntityThresholdAuto}
                onChange={event => setLongEntityThresholdAuto(event.target.checked)}
                className="h-3 w-3 cursor-pointer rounded-sm accent-primary"
              />
              <span>Auto long entities threshold</span>
            </label>
          </div>
          <div
            className={longEntityThresholdAuto ? 'space-y-2 opacity-50' : 'space-y-2'}
            aria-disabled={longEntityThresholdAuto}
          >
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="long-entity-threshold">Long entities threshold</label>
              <div className="flex items-center gap-1">
                <Input
                  id="long-entity-threshold"
                  type="number"
                  min={MIN_LONG_ENTITY_THRESHOLD_SECONDS}
                  max={MAX_LONG_ENTITY_THRESHOLD_SECONDS}
                  step={LONG_ENTITY_THRESHOLD_STEP_SECONDS}
                  value={longEntityThresholdSeconds}
                  disabled={longEntityThresholdAuto}
                  onChange={event => {
                    const value = event.currentTarget.valueAsNumber;
                    if (Number.isFinite(value)) setLongEntityThresholdSeconds(value);
                  }}
                  className="h-7 w-20 px-2 py-1 text-xs"
                />
                <span className="text-muted-foreground">s</span>
              </div>
            </div>
            <input
              type="range"
              min={MIN_LONG_ENTITY_THRESHOLD_SECONDS}
              max={MAX_LONG_ENTITY_THRESHOLD_SECONDS}
              step={LONG_ENTITY_THRESHOLD_STEP_SECONDS}
              value={longEntityThresholdSeconds}
              disabled={longEntityThresholdAuto}
              onChange={event => setLongEntityThresholdSeconds(event.currentTarget.valueAsNumber)}
              aria-label="Long entities threshold in seconds"
              className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed"
            />
          </div>
          <p className="text-muted-foreground">
            Effective threshold: {formattedEffectiveThreshold} s
            {longEntityThresholdAuto ? ' at the current zoom.' : '.'}
          </p>
        </PopoverContent>
      </Popover>
    </QueryToolbar>
  );
}

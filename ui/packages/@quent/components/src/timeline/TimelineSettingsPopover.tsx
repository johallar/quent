// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Settings } from 'lucide-react';
import { useId } from 'react';
import {
  useLongEntityDensity,
  useSetLongEntityDensity,
  type LongEntityDensity,
} from '@quent/hooks';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

const DENSITY_STEPS: LongEntityDensity[] = ['less', 'balanced', 'more'];

export function TimelineSettingsPopover() {
  const density = useLongEntityDensity();
  const setDensity = useSetLongEntityDensity();
  const sliderId = useId();
  const value = DENSITY_STEPS.indexOf(density);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Timeline settings"
          className="inline-flex cursor-pointer items-center rounded-sm p-0.5 transition-colors hover:bg-accent hover:text-accent-foreground"
          title="Timeline settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <label htmlFor={sliderId} className="text-xs font-medium text-foreground">
          Entities
        </label>
        <input
          id={sliderId}
          type="range"
          min={0}
          max={DENSITY_STEPS.length - 1}
          step={1}
          value={value}
          aria-valuetext={density}
          onChange={event => {
            const nextDensity = DENSITY_STEPS[Number(event.target.value)];
            if (nextDensity) setDensity(nextDensity);
          }}
          className="mt-2 h-1.5 w-full cursor-pointer accent-primary"
        />
        <div aria-hidden className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Less</span>
          <span>Balanced</span>
          <span>More</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

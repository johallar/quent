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

const DENSITY_RANGE: readonly [LongEntityDensity, LongEntityDensity] = [1, 5];

export function TimelineSettingsPopover() {
  const density = useLongEntityDensity();
  const setDensity = useSetLongEntityDensity();
  const sliderId = useId();

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
          min={DENSITY_RANGE[0]}
          max={DENSITY_RANGE[1]}
          step={1}
          value={density}
          aria-valuetext={`${density} out of ${DENSITY_RANGE[1]}`}
          onChange={event => {
            const nextDensity = Number(event.target.value);
            if (
              Number.isInteger(nextDensity) &&
              nextDensity >= DENSITY_RANGE[0] &&
              nextDensity <= DENSITY_RANGE[1]
            ) {
              setDensity(nextDensity as LongEntityDensity);
            }
          }}
          className="mt-2 h-1.5 w-full cursor-pointer accent-primary"
        />
        <div aria-hidden className="mt-1 flex justify-between text-[10px] text-muted-foreground">
          <span>Less</span>
          <span>More</span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

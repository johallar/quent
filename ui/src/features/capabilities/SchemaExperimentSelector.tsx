// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { FlaskConical } from 'lucide-react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@quent/components';
import { SCHEMA_EXPERIMENTS, useSchemaExperiment } from './SchemaExperimentContext';

export function SchemaExperimentSelector() {
  const { experiment, selectExperiment } = useSchemaExperiment();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="max-w-56 gap-2"
          aria-label={`Schema experiment: ${experiment.label}`}
        >
          <FlaskConical className="size-4 shrink-0 text-primary" />
          <span className="hidden text-muted-foreground lg:inline">Schema</span>
          <span className="hidden truncate sm:inline">{experiment.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="max-h-[min(32rem,var(--radix-dropdown-menu-content-available-height))] w-80 overflow-y-auto"
      >
        <DropdownMenuLabel>
          <span className="block text-sm">Schema experiment</span>
          <span className="block text-xs font-normal text-muted-foreground">
            Recompose the current analysis from schema capabilities.
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={experiment.id}
          onValueChange={value => {
            const selected = SCHEMA_EXPERIMENTS.find(candidate => candidate.id === value);
            if (selected) {
              selectExperiment(selected.id);
            }
          }}
        >
          {SCHEMA_EXPERIMENTS.map(candidate => (
            <DropdownMenuRadioItem
              key={candidate.id}
              value={candidate.id}
              className="items-start py-2"
            >
              <span className="min-w-0">
                <span className="block font-medium text-foreground">{candidate.label}</span>
                <span className="block text-xs leading-4 text-muted-foreground">
                  {candidate.description}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

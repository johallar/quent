// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  SCHEMA_EXPERIMENTS,
  SchemaExperimentProvider,
  useSchemaExperiment,
} from './SchemaExperimentContext';

function ExperimentProbe() {
  const { experiment, selectExperiment } = useSchemaExperiment();
  return (
    <>
      <output>{experiment.id}</output>
      <button onClick={() => selectExperiment('resource-only')}>Select resources</button>
    </>
  );
}

describe('SchemaExperimentProvider', () => {
  it('switches the active schema variation in real time', () => {
    render(
      <SchemaExperimentProvider>
        <ExperimentProbe />
      </SchemaExperimentProvider>
    );

    expect(screen.getByText('query-plan-only')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Select resources' }));
    expect(screen.getByText('resource-only')).toBeInTheDocument();
  });

  it('offers each configured schema variation once', () => {
    expect(SCHEMA_EXPERIMENTS.map(experiment => experiment.id)).toEqual([
      'entities-only',
      'resource-only',
      'resource-query-plan',
      'query-plan-only',
      'query-plan-entities',
      'resource-definitions-only',
    ]);
  });
});

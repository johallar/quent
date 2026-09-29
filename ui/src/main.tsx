// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// Import the generated route tree
import { routeTree } from './routeTree.gen';
import { queryClient } from './lib/queryClient';
import {
  DEFAULT_SCHEMA_EXPERIMENT,
  SchemaExperimentProvider,
  useSchemaExperiment,
} from './features/capabilities';

import './index.css';

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { schemaExperiment: DEFAULT_SCHEMA_EXPERIMENT },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

function SchemaExperimentRouter() {
  const { experiment } = useSchemaExperiment();
  const previousExperimentId = React.useRef(experiment.id);

  React.useEffect(() => {
    if (previousExperimentId.current !== experiment.id) {
      previousExperimentId.current = experiment.id;
      void router.invalidate();
    }
  }, [experiment.id]);

  return <RouterProvider router={router} context={{ schemaExperiment: experiment }} />;
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SchemaExperimentProvider>
        <SchemaExperimentRouter />
      </SchemaExperimentProvider>
      {import.meta.env.VITE_DEBUG && !import.meta.env.TEST && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  </React.StrictMode>
);

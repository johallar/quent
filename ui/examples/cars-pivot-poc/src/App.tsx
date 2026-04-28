// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Provider as JotaiProvider } from 'jotai';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CarsPivotTable } from './CarsPivotTable';

// PivotedStatTable reads node color palette from a Jotai atom and looks up
// formatters/colors via theme context. Both QueryClient and Theme are
// provided here even though this POC has no network calls — it keeps the
// component drop-in compatible with the main Quent UI.
const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: Infinity, refetchOnWindowFocus: false } },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <JotaiProvider>
        <ThemeProvider>
          <div className="h-screen flex flex-col bg-background text-foreground">
            <header className="shrink-0 flex items-center justify-between px-4 py-3 border-b bg-card">
              <div>
                <h1 className="text-lg font-semibold">Cars Pivot Table — POC</h1>
                <p className="text-xs text-muted-foreground">
                  Generic, non-domain-specific pivot table over the Kaggle car_price_dataset schema.
                </p>
              </div>
              <ThemeToggle />
            </header>
            <main className="flex-1 min-h-0">
              <CarsPivotTable />
            </main>
          </div>
        </ThemeProvider>
      </JotaiProvider>
    </QueryClientProvider>
  );
}

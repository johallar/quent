// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  /** Short identifier included in the console.error log line for grep-ability. */
  label: string;
  children: ReactNode;
  /** Rendered when the boundary catches an error. Defaults to `null` (no UI). */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Minimal class-based error boundary used as a defensive wrapper around
 * subtrees whose failure must not bring down the rest of the app (e.g. URL
 * persistence sync). Caught errors are logged with a `[url-state/boundary:*]`
 * prefix and the boundary renders `fallback` (or `null`) instead of `children`.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`[url-state/boundary:${this.props.label}]`, error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

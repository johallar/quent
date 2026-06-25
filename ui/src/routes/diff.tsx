// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { isFeatureEnabled } from '@/lib/featureFlags';

export const Route = createFileRoute('/diff')({
  beforeLoad: () => {
    if (!isFeatureEnabled('QUERY_DIFF')) {
      throw redirect({ to: '/profile' });
    }
  },
  component: DiffLayout,
});

function DiffLayout() {
  return <Outlet />;
}

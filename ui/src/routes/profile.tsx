// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/profile')({
  component: ProfileLayout,
});

function ProfileLayout() {
  return (
    <div className="h-[calc(100vh-4rem)] overflow-x-hidden overflow-y-auto">
      <Outlet />
    </div>
  );
}

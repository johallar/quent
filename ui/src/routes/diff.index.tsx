// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { DiffSelectionPage } from '@/pages/DiffSelectionPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/diff/')({
  component: DiffIndex,
});

function DiffIndex() {
  return <DiffSelectionPage />;
}

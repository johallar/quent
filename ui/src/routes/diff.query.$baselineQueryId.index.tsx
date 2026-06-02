// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { createFileRoute } from '@tanstack/react-router';
import { DiffSelectionPage } from '@/pages/DiffSelectionPage';

export const Route = createFileRoute('/diff/query/$baselineQueryId/')({
  component: DiffBaselineOnly,
});

function DiffBaselineOnly() {
  const { baselineQueryId } = Route.useParams();
  return <DiffSelectionPage initialBaselineQueryId={baselineQueryId} />;
}

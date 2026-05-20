// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { DiffSelectionPage, parseComparisonQueryIds } from '@/pages/DiffSelectionPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/diff/query/$baselineQueryId/compare/$comparisonQueryIds')({
  component: DiffComparison,
});

function DiffComparison() {
  const { baselineQueryId, comparisonQueryIds } = Route.useParams();
  return (
    <DiffSelectionPage
      initialBaselineQueryId={baselineQueryId}
      initialComparisonQueryIds={parseComparisonQueryIds(comparisonQueryIds)}
    />
  );
}

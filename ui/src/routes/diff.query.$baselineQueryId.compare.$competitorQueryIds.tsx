// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { DiffSelectionPage, parseCompetitorQueryIds } from '@/pages/DiffSelectionPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/diff/query/$baselineQueryId/compare/$competitorQueryIds')({
  component: DiffComparison,
});

function DiffComparison() {
  const { baselineQueryId, competitorQueryIds } = Route.useParams();
  return (
    <DiffSelectionPage
      initialBaselineQueryId={baselineQueryId}
      initialCompetitorQueryIds={parseCompetitorQueryIds(competitorQueryIds)}
    />
  );
}

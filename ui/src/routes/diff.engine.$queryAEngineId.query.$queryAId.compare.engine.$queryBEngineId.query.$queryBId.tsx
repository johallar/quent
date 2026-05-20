// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { DiffSelectionPage } from '@/pages/DiffSelectionPage';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/diff/engine/$queryAEngineId/query/$queryAId/compare/engine/$queryBEngineId/query/$queryBId'
)({
  component: DiffComparison,
});

function DiffComparison() {
  const { queryAEngineId, queryAId, queryBEngineId, queryBId } = Route.useParams();
  return (
    <DiffSelectionPage
      initialQueryAEngineId={queryAEngineId}
      initialQueryAId={queryAId}
      initialQueryBEngineId={queryBEngineId}
      initialQueryBId={queryBId}
    />
  );
}

// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { expect, test } from '@playwright/test';

// The e2e fixture (see start-e2e-server.sh) seeds exactly one engine, one
// query group, and one query ("test-query"), so the profiles table has a
// single row.
const SEEDED_QUERY_NAME = 'test-query';

test('profile search lists one profile and opens its plan, timeline, and operators', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Quent UI');
  await expect(page.getByRole('heading', { name: 'Search Profiles' })).toBeVisible();

  // The aggregated table surfaces exactly the one seeded profile.
  const table = page.getByRole('table');
  const rows = table.locator('tbody tr');
  await expect(rows).toHaveCount(1, { timeout: 15_000 });
  const row = rows.first();
  await expect(row.getByText(SEEDED_QUERY_NAME)).toBeVisible();

  // Selecting the row opens its profile view (redirects to the timeline tab).
  await row.click();
  await expect(page).toHaveURL(/\/profile\/engine\/[^/]+\/query\/[^/]+\/timeline/, {
    timeout: 15_000,
  });

  // The DAG (React Flow query plan) renders in the left panel.
  await expect(page.getByRole('tab', { name: 'Query Plan' })).toBeVisible();
  await expect(page.locator('.react-flow__node').first()).toBeVisible({ timeout: 15_000 });

  // The timeline view renders in the right panel: its toolbar and the resource
  // tree column header are present.
  await expect(page.getByRole('link', { name: 'Timeline' })).toBeVisible();
  await expect(page.getByText('Reset zoom')).toBeVisible();
  await expect(page.getByText('Resource', { exact: true }).first()).toBeVisible();

  // Switching to the Operators tab renders the operator pivot table.
  await page.getByRole('link', { name: 'Operators' }).click();
  await expect(page).toHaveURL(/\/profile\/engine\/[^/]+\/query\/[^/]+\/operators/, {
    timeout: 15_000,
  });
  await expect(page.getByText('Worker / Plan').first()).toBeVisible({ timeout: 15_000 });
});

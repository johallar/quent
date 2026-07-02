// SPDX-FileCopyrightText: Copyright (c) 2026 NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { expect, test } from '@playwright/test';
import { API_ENDPOINTS, waitForRequestsSettled } from './helpers';

const ENGINE_ID = '00000000-0000-0000-0000-000000000001';
const QUERY_ID = '00000000-0000-0000-0000-000000000004';
const TIMELINE_URL = `/profile/engine/${ENGINE_ID}/query/${QUERY_ID}/timeline`;

test('loads the query profiler page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('Quent UI');
  await expect(page.getByRole('heading', { name: 'Query Profiler' })).toBeVisible();
  await expect(page.getByText('Select an engine, coordinator, and query')).toBeVisible();

  await page.getByRole('combobox').first().click();
  await expect(page.getByRole('option', { name: 'test-engine' })).toBeVisible();
  await page.getByRole('option', { name: 'test-engine' }).click();

  await page.getByRole('combobox').nth(1).click();
  await expect(page.getByRole('option', { name: 'test-group' })).toBeVisible();
  await page.getByRole('option', { name: 'test-group' }).click();

  await page.getByRole('combobox').nth(2).click();
  await expect(page.getByRole('option', { name: 'test-query' })).toBeVisible();
});

test('pan-zooms the first timeline row and matches golden', async ({ page }) => {
  await page.goto(TIMELINE_URL);

  const firstRow = page.locator('div[role="tree"] [data-index="0"]').first();
  await expect(firstRow).toBeVisible();
  // Chart is rendered as SVG; wait until it's mounted before interacting.
  await expect(firstRow.locator('svg').first()).toBeVisible();

  await page.waitForLoadState('networkidle');

  const box = await firstRow.boundingBox();
  if (!box) throw new Error('First timeline row has no bounding box');
  // Aim at the usage-column half of the row, where the timeline chart lives.
  const wheelX = box.x + box.width * 0.7;
  const wheelY = box.y + box.height / 2;

  // Install listener BEFORE zooming so the debounced fetch(es) can't slip past.
  const bulkSettled = waitForRequestsSettled(page, API_ENDPOINTS.bulkTimelines);

  // Timeline rows require shift+wheel to zoom (see Timeline.tsx dataZoom config).
  // Wheel many times so we hit the built-in minSpan clamp regardless of duration.
  await page.mouse.move(wheelX, wheelY);
  await page.keyboard.down('Shift');
  try {
    for (let i = 0; i < 120; i++) {
      await page.mouse.wheel(0, -400);
    }
  } finally {
    await page.keyboard.up('Shift');
  }

  await bulkSettled;
  await page.mouse.move(0, 0);
  await expect(firstRow).toHaveScreenshot('first-timeline-row-zoomed.png', {
    animations: 'disabled',
    maxDiffPixelRatio: 0.02,
  });
});

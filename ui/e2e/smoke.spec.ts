// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { expect, test, type Page } from '@playwright/test';

const ENGINE_ID = '00000000-0000-0000-0000-000000000001';
const QUERY_ID = '00000000-0000-0000-0000-000000000004';
const QUERY_PATH = `/profile/engine/${ENGINE_ID}/query/${QUERY_ID}`;

interface CapturedErrors {
  ui: string[];
  backend: string[];
}

function isBackendRequest(url: string): boolean {
  const pathname = new URL(url).pathname;
  return pathname === '/api' || pathname.startsWith('/api/');
}

function captureErrors(page: Page): CapturedErrors {
  const errors: CapturedErrors = { ui: [], backend: [] };

  page.on('pageerror', error => errors.ui.push(`Uncaught exception: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error') {
      errors.ui.push(`Console error: ${message.text()}`);
    }
  });
  page.on('response', response => {
    if (isBackendRequest(response.url()) && !response.ok()) {
      errors.backend.push(
        `${response.request().method()} ${response.url()} returned ${response.status()}`
      );
    }
  });
  page.on('requestfailed', request => {
    if (isBackendRequest(request.url())) {
      errors.backend.push(
        `${request.method()} ${request.url()} failed: ${request.failure()?.errorText ?? 'unknown error'}`
      );
    }
  });

  return errors;
}

async function expectNoErrors(page: Page, errors: CapturedErrors) {
  await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0);
  expect(errors.ui, 'Expected no UI errors').toEqual([]);
  expect(errors.backend, 'Expected no backend HTTP errors').toEqual([]);
}

test('smoke tests the query profiler routes', async ({ page }) => {
  const errors = captureErrors(page);
  const response = await page.goto('/');

  expect(response?.ok()).toBe(true);

  await expect(page).toHaveTitle('Quent UI');
  await expect(page.getByRole('heading', { name: 'Query Profiler' })).toBeVisible();
  await expect(page.getByText('Select an engine, coordinator, and query')).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectNoErrors(page, errors);

  await page.getByRole('combobox').first().click();
  await expect(page.getByRole('option', { name: 'test-engine' })).toBeVisible();
  await page.getByRole('option', { name: 'test-engine' }).click();

  await page.getByRole('combobox').nth(1).click();
  await expect(page.getByRole('option', { name: 'test-group' })).toBeVisible();
  await page.getByRole('option', { name: 'test-group' }).click();

  await page.getByRole('combobox').nth(2).click();
  await expect(page.getByRole('option', { name: 'test-query' })).toBeVisible();
  await page.getByRole('option', { name: 'test-query' }).click();

  await expect(page).toHaveURL(new RegExp(`${QUERY_PATH}/timeline$`));
  await expect(page.getByText('Resource', { exact: true }).first()).toBeVisible();
  await page.waitForLoadState('networkidle');
  await expectNoErrors(page, errors);

  const routes = [
    {
      name: 'timeline',
      path: `${QUERY_PATH}/timeline`,
      ready: () => page.getByText('Resource', { exact: true }).first(),
    },
    {
      name: 'operators',
      path: `${QUERY_PATH}/operators`,
      ready: () =>
        page.getByText(/Select a plan on the left to view operators|Worker \/ Plan/).first(),
    },
    {
      name: 'entities',
      path: `${QUERY_PATH}/entities`,
      ready: () => page.getByRole('columnheader', { name: 'Instance' }),
    },
  ];

  for (const route of routes) {
    await test.step(`loads the ${route.name} route directly`, async () => {
      const routeResponse = await page.goto(route.path);

      expect(routeResponse?.ok()).toBe(true);
      await expect(page).toHaveURL(new RegExp(`${route.path}$`));
      await expect(route.ready()).toBeVisible();
      await page.waitForLoadState('networkidle');
      await expectNoErrors(page, errors);
    });
  }
});

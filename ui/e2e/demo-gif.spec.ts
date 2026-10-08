// SPDX-FileCopyrightText: Copyright (c) 2026, NVIDIA CORPORATION & AFFILIATES. All rights reserved.
// SPDX-License-Identifier: Apache-2.0

import { expect, type Locator, type Page, test } from '@playwright/test';

const ENGINE_ID = '01a07b4c-86ab-7971-97c1-24879c41910e';
const QUERY_ID = '01a07b4c-86ab-7971-97c1-28ffb10dde0d';
const QUERY_PATH = `/#/profile/engine/${ENGINE_ID}/query/${QUERY_ID}`;
const IS_RECORDING = process.env.PLAYWRIGHT_DEMO_RECORD === '1';

async function beat(page: Page, recordingMs = 800) {
  await page.waitForTimeout(IS_RECORDING ? recordingMs : 50);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: IS_RECORDING ? 24 : 4 });
  await page.mouse.up();
}

async function zoomDagAndPanUp(page: Page) {
  const pane = page.locator('.react-flow__pane');
  const box = await pane.boundingBox();
  expect(box).not.toBeNull();

  const focus = {
    x: box!.x + box!.width * 0.28,
    y: box!.y + box!.height * 0.72,
  };
  await page.mouse.move(focus.x, focus.y);
  await page.mouse.wheel(0, -700);
  await beat(page);

  await drag(
    page,
    { x: box!.x + box!.width * 0.45, y: box!.y + box!.height * 0.7 },
    { x: box!.x + box!.width * 0.45, y: box!.y + box!.height * 0.35 }
  );
}

async function scrubPlayhead(page: Page) {
  const playhead = page.getByRole('slider', { name: 'Data flow playhead' });
  const track = page.getByTestId('dag-playhead');
  const playheadBox = await playhead.boundingBox();
  const trackBox = await track.boundingBox();
  expect(playheadBox).not.toBeNull();
  expect(trackBox).not.toBeNull();

  const y = playheadBox!.y + playheadBox!.height / 2;
  const x = playheadBox!.x + playheadBox!.width / 2;
  const distance = trackBox!.width * 0.22;
  await drag(page, { x, y }, { x: x + distance, y });
  await beat(page, 500);

  const movedBox = await playhead.boundingBox();
  expect(movedBox).not.toBeNull();
  await drag(
    page,
    { x: movedBox!.x + movedBox!.width / 2, y },
    { x: Math.max(trackBox!.x, movedBox!.x - distance * 0.75), y }
  );
}

async function zoomTimeline(page: Page, targetFraction: number) {
  const controller = page.getByTestId('timeline-controller');
  const box = await controller.boundingBox();
  expect(box).not.toBeNull();

  const initial = await controller.evaluate(element => ({
    start: Number(element.getAttribute('data-zoom-start')),
    end: Number(element.getAttribute('data-zoom-end')),
  }));
  const initialSpan = initial.end - initial.start;
  const targetSpan = initialSpan * targetFraction;

  await page.mouse.move(box!.x + box!.width * 0.42, box!.y + box!.height * 0.55);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const span = await controller.evaluate(
      element =>
        Number(element.getAttribute('data-zoom-end')) -
        Number(element.getAttribute('data-zoom-start'))
    );
    if (span <= targetSpan) {
      break;
    }
    await page.mouse.wheel(0, -420);
    await page.waitForTimeout(IS_RECORDING ? 90 : 20);
  }

  await expect
    .poll(async () =>
      controller.evaluate(
        element =>
          Number(element.getAttribute('data-zoom-end')) -
          Number(element.getAttribute('data-zoom-start'))
      )
    )
    .toBeLessThanOrEqual(targetSpan * 1.15);
}

async function openTimelineEntity(page: Page) {
  const gantt = page.locator('[data-long-entities-gantt]').first();
  await expect(gantt).toBeVisible();
  const close = page.getByRole('button', { name: 'Close' });

  const tryOpen = async () => {
    const box = await gantt.boundingBox();
    expect(box).not.toBeNull();
    const shapes = gantt.locator('svg path, svg rect');
    for (let index = 0; index < Math.min(await shapes.count(), 80); index += 1) {
      const shapeBox = await shapes.nth(index).boundingBox();
      if (shapeBox && shapeBox.width > 3 && shapeBox.height > 3) {
        await page.mouse.click(shapeBox.x + shapeBox.width / 2, shapeBox.y + shapeBox.height / 2);
        if (await close.isVisible()) {
          return true;
        }
      }
    }
    for (const yFraction of [0.25, 0.45, 0.65]) {
      for (const xFraction of [0.42, 0.3, 0.55, 0.7, 0.18, 0.82]) {
        await page.mouse.click(
          box!.x + box!.width * xFraction,
          box!.y + Math.min(box!.height - 4, box!.height * yFraction)
        );
        if (await close.isVisible()) {
          return true;
        }
      }
    }
    return false;
  };

  if (!(await tryOpen())) {
    await page.getByRole('button', { name: 'Reset zoom' }).click();
    await beat(page);
    if (!(await tryOpen())) {
      throw new Error('No entity segment was clickable in the generated simulator run');
    }
  }
  return close;
}

async function selectOperatorType(page: Page, type: string) {
  const node = page
    .locator('.react-flow__node')
    .filter({ hasText: new RegExp(`\\d+:${type}`, 'i') })
    .first();
  await expect(node).toBeAttached();
  await node.dispatchEvent('click');
  await beat(page);
}

async function hoverStatHeaders(page: Page) {
  const headers = page.getByRole('columnheader').filter({ hasText: /duration|input|output/i });
  await expect(headers.first()).toBeVisible();

  const nodeSurface = page.locator('.react-flow__node > div > div').first();
  const initialColor = await nodeSurface.evaluate(
    element => getComputedStyle(element).backgroundColor
  );
  let observedHeatmap = false;
  for (let index = 0; index < Math.min(await headers.count(), 3); index += 1) {
    const header = headers.nth(index);
    await header.hover();
    await beat(page, 700);
    const color = await nodeSurface.evaluate(element => getComputedStyle(element).backgroundColor);
    observedHeatmap ||= color !== initialColor;
  }
  expect(observedHeatmap).toBe(true);
}

async function selectOnlyRequestedGroupFacets(toolbar: Locator) {
  const facets = toolbar.getByRole('button');
  for (let index = 0; index < (await facets.count()); index += 1) {
    const facet = facets.nth(index);
    const name = (await facet.innerText()).replace(/\s+/g, ' ').trim();
    const shouldBePressed = /Worker \/ Plan/i.test(name) || /logical Operator Type/i.test(name);
    const isPressed = (await facet.getAttribute('aria-pressed')) === 'true';
    if (isPressed !== shouldBePressed) {
      await facet.click();
    }
  }
}

test('exercises and records the README demo flow with generated simulator data', async ({
  page,
}) => {
  await page.goto(`${QUERY_PATH}/timeline`);
  await expect(page.locator('.react-flow__node').first()).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Data flow playhead' })).toBeVisible();
  await beat(page, 1_200);

  await zoomDagAndPanUp(page);
  const play = page.getByRole('button', { name: 'Play data flow' });
  await play.click();
  await expect(page.getByRole('button', { name: 'Pause data flow' })).toBeVisible();
  await beat(page, 1_800);

  const pane = page.locator('.react-flow__pane');
  const paneBox = await pane.boundingBox();
  expect(paneBox).not.toBeNull();
  await drag(
    page,
    { x: paneBox!.x + paneBox!.width * 0.5, y: paneBox!.y + paneBox!.height * 0.7 },
    { x: paneBox!.x + paneBox!.width * 0.5, y: paneBox!.y + paneBox!.height * 0.35 }
  );
  await beat(page, 1_200);

  await page.getByRole('button', { name: 'Pause data flow' }).click();
  await expect(play).toBeVisible();
  await scrubPlayhead(page);
  await beat(page);

  await selectOperatorType(page, 'Join');
  await selectOperatorType(page, 'Project');
  const detailsToggle = page.getByRole('button', { name: 'Toggle operator details' });
  await expect(detailsToggle).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'Stats' })).toBeVisible();

  const details = page.locator('[role="tabpanel"][data-state="active"]');
  await details.hover();
  await page.mouse.wheel(0, 500);
  await beat(page, 1_200);

  await page.locator('[role="tree"] .chevron-icon[data-open="false"]').first().click();
  await expect(page.locator('[data-long-entities-gantt]').first()).toBeVisible();
  await zoomTimeline(page, 0.08);
  await beat(page, 1_000);
  await zoomTimeline(page, 0.25);
  await beat(page, 1_000);

  const closeEntity = await openTimelineEntity(page);
  await expect(page.getByText('Entity details', { exact: true })).toBeVisible();
  await beat(page);
  await closeEntity.click();
  await expect(page.getByText('Entity details', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Clear all filters' }).click();
  await expect(page.getByRole('button', { name: 'Clear all filters' })).toHaveCount(0);
  await beat(page);

  await page.getByRole('link', { name: 'Operators' }).click();
  const groupToolbar = page.getByText('Group by:', { exact: true }).locator('..');
  await expect(groupToolbar).toBeVisible();
  await selectOnlyRequestedGroupFacets(groupToolbar);
  await expect(groupToolbar.getByRole('button', { name: /Worker \/ Plan/i })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(
    groupToolbar.getByRole('button', { name: /logical\s+Operator Type/i })
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(groupToolbar.getByRole('button', { pressed: true })).toHaveCount(2);
  await hoverStatHeaders(page);

  await page.getByRole('link', { name: 'Entities' }).click();
  const minUsage = page.getByRole('spinbutton', { name: 'Min usage (s)' });
  await minUsage.fill('0.021');
  await minUsage.press('Enter');
  await beat(page);
  const minUsageSlider = page
    .getByRole('group', { name: 'Min usage (s) slider' })
    .getByRole('slider');
  const maxUsage = Number(await minUsageSlider.getAttribute('aria-valuemax'));
  if (maxUsage < 0.021) {
    await minUsage.fill((maxUsage * 0.8).toFixed(4));
    await minUsage.press('Enter');
  }

  const operator = page.getByRole('combobox', { name: 'Operator' });
  await operator.click();
  const joinOption = page.getByRole('option').filter({ hasText: /Join/i }).first();
  await expect(joinOption).toBeVisible();
  await joinOption.click();
  await page.keyboard.press('Escape');

  const entityRow = page.locator('tbody tr').first();
  await expect(entityRow).toBeVisible();
  await entityRow.click();
  await expect(page.getByRole('button', { name: 'Copy ID' })).toBeVisible();
  await beat(page, 1_500);
});

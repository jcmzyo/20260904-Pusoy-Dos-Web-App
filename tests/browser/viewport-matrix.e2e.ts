import { expect, test } from '@playwright/test';
import {
  SUPPORTED_LANDSCAPE_VIEWPORTS,
  SUPPORTED_PORTRAIT_VIEWPORTS,
  VIEWPORT_MATRIX,
  findViewport,
  guidanceCases,
} from './viewportMatrix';
import type { GuidanceCase, ViewportSpec } from './viewportMatrix';

// The visible heading at load depends on the frozen matrix case (ui-ux.md §14, §19.6.2): every supported
// case - landscape and, since M5-T02, portrait - shows the ordinary Home screen whatever the pointer type,
// and every unsupported case shows the guidance its pointer type can follow. The default Playwright context
// is a fine-pointer desktop browser; the touch (coarse-pointer) cases run in their own `hasTouch` group
// below (`hasTouch: true` is what flips the CSS `pointer: coarse` media feature Chromium reports).
function loadTest(spec: ViewportSpec, pointer: string, heading: string) {
  test(`app loads without error at ${spec.name} (${spec.width}x${spec.height}, ${pointer} pointer)`, async ({ page }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle('Pusoy Dos');
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

function guidanceTest({ spec, pointer, heading }: GuidanceCase) {
  test(`${spec.name} (${spec.width}x${spec.height}, ${pointer} pointer) shows "${heading}" instead of gameplay`, async ({ page }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    // Exactly one kind of guidance, and no way into gameplay.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('button', { name: 'Start Game' })).toHaveCount(0);
  });
}

for (const spec of VIEWPORT_MATRIX) {
  if (spec.category === 'supported') loadTest(spec, 'fine', 'Pusoy Dos');
}
for (const guidanceCase of guidanceCases('fine')) {
  loadTest(guidanceCase.spec, 'fine', guidanceCase.heading);
  guidanceTest(guidanceCase);
}

test.describe('touch-capable (phone/tablet, coarse-pointer) context', () => {
  test.use({ hasTouch: true });

  test('the touch context really reports a coarse primary pointer', async ({ page }) => {
    await page.goto('/');
    expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(true);
  });

  for (const spec of VIEWPORT_MATRIX) {
    if (spec.category === 'supported' && spec.pointers.includes('coarse')) loadTest(spec, 'coarse', 'Pusoy Dos');
  }
  for (const guidanceCase of guidanceCases('coarse')) guidanceTest(guidanceCase);
});

test('the default desktop context really reports a fine primary pointer', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => window.matchMedia('(pointer: coarse)').matches)).toBe(false);
});

// Pixel-level overlap/clipping/fit verification of the landscape table lives in
// `responsive-hardening.e2e.ts` (M4-T14). This check only confirms a Session can be started and the table
// hierarchy's core elements (all four seats and the Discard Pile button) are actually visible, not just
// present, at every supported viewport - including supported portrait, where the composition the table
// uses is reported on its wrapper (`data-layout`, ui-ux.md §19.6.2).
for (const viewport of [...SUPPORTED_LANDSCAPE_VIEWPORTS, ...SUPPORTED_PORTRAIT_VIEWPORTS]) {
  test(`Game Table core elements are visible at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
    await expect(page.locator('[data-layout]')).toHaveAttribute(
      'data-layout',
      viewport.orientation === 'landscape' ? 'landscape' : `portrait-${viewport.portraitClass}`,
    );
    await expect(page.getByRole('region', { name: 'You panel' })).toBeVisible();
    await expect(page.getByRole('region', { name: /^(West|North|East) panel$/ })).toHaveCount(3);
    for (const name of ['West', 'North', 'East']) {
      await expect(page.getByRole('region', { name: `${name} panel` })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Check Discard Pile', exact: true })).toBeVisible();
  });
}

// Regression for a reported UI bug: West/East bot hands previously overlapped horizontally and
// spilled past the table's left/right border at narrower supported viewports. Cards now stack
// lengthwise (vertically) on the outer edge with player details toward center (ui-ux.md §5), so
// this verifies the card stack's own layout box stays within the table's horizontal bounds. Landscape
// only: every portrait class is excluded until M5-T03 delivers the portrait opponent layout (ui-ux.md
// §19.6.3: phone portrait drops the card fan, tablet portrait keeps the per-seat Play trail), and M5-T03
// must add portrait geometry checks in its place.
for (const viewport of SUPPORTED_LANDSCAPE_VIEWPORTS) {
  test(`West/East card stacks stay within the table border at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    const table = page.getByRole('region', { name: 'Game Table' });
    const tableBox = await table.boundingBox();
    if (!tableBox) throw new Error('Game Table region has no layout box.');
    for (const name of ['West', 'East']) {
      const seat = page.getByRole('region', { name: `${name} panel` }).locator('xpath=..');
      const botHand = seat.locator('> [aria-hidden="true"]').first();
      const box = await botHand.boundingBox();
      if (!box) throw new Error(`${name}'s bot hand has no layout box.`);
      expect(box.x).toBeGreaterThanOrEqual(tableBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1);
    }
  });
}

// A portrait-shaped desktop window at or above 360x560 is supported portrait, not "resize" (ui-ux.md
// §19.6.2 supersedes M4's all-portrait rejection); below the minimum it still gets resize guidance and is
// never told to rotate.
test('a portrait-shaped desktop window is playable at or above the portrait minimum and told to resize below it', async ({ page }) => {
  const supported = findViewport('portrait-phone-390');
  const below = findViewport('portrait-below-min-width');
  await page.setViewportSize({ width: supported.width, height: supported.height });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
  await page.setViewportSize({ width: below.width, height: below.height });
  await expect(page.getByRole('heading', { name: 'Resize your window to continue', exact: true })).toBeVisible();
  await expect(page.getByText('Rotate your device to continue')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Start Game' })).toHaveCount(0);
});

// Leave Game confirmation (M4-T11; ui-ux.md §10): cancelling keeps the Session, confirming returns to
// Home. A real browser round-trip through the actual Close(×)/Escape-equivalent Stay button and the
// destructive Leave button, complementing the faster Vitest/RTL coverage in SessionTable.test.tsx.
test('Leave Game: Stay keeps the Session, Yes/Leave Game returns to Home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();

  await page.getByRole('button', { name: 'Leave Game', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();

  await page.getByRole('button', { name: 'Leave Game', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, Leave Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
});

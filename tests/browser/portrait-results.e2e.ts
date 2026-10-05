import { expect, test } from '@playwright/test';
import { VIEWPORT_MATRIX } from './viewportMatrix';

for (const spec of VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported' && entry.orientation === 'portrait')) {
  test(`portrait reveal and deliberate result continuation at ${spec.name}`, async ({ page }) => {
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.goto('/tests/browser/fixtures/portrait-results.html');
    const skip = page.getByRole('button', { name: 'Skip reveal', exact: true });
    await expect(skip).toBeVisible();
    const revealed = page.locator('[class*="revealedHand"]');
    const geometry = await revealed.evaluate((element) => {
      const cards = Array.from(element.children).map((card) => card.getBoundingClientRect());
      return { count: cards.length, fits: cards.every((card) => card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight), exposure: cards.slice(1).map((card, index) => card.left - cards[index]!.left), text: getComputedStyle(element.querySelector('[class*="corner"]')!).fontSize };
    });
    expect(geometry.count).toBeGreaterThan(1);
    expect(geometry.fits).toBe(true);
    expect(geometry.exposure.every((width) => width >= 24)).toBe(true);
    expect(parseFloat(geometry.text)).toBeGreaterThanOrEqual(14);
    await skip.click();
    const dialog = page.getByRole('dialog', { name: 'Round 1 Result' });
    const heading = dialog.getByRole('heading');
    await expect(heading).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(dialog).toBeVisible();
    await expect(revealed).toBeAttached();
    const bounds = await dialog.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(spec.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(spec.height);
    await page.keyboard.press('Tab');
    const next = dialog.getByRole('button', { name: 'Next Round' });
    await expect(next).toBeFocused();
    const action = (await next.boundingBox())!;
    expect(action.width).toBeGreaterThanOrEqual(44);
    expect(action.height).toBeGreaterThanOrEqual(44);
    expect(action.y + action.height).toBeLessThanOrEqual(spec.height);
    await page.keyboard.press('Tab');
    await expect(next).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox', { name: 'Your hand' }).locator('[tabindex="0"]')).toBeFocused();
    await expect(dialog).toHaveCount(0);
  });
}

test('live reduced motion retains visible points and requires Next Round', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/tests/browser/fixtures/portrait-results.html');
  await page.getByRole('button', { name: 'Skip reveal', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Round 1 Result' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(dialog.getByRole('cell', { name: '+5', exact: true })).toBeVisible();
  await expect(dialog.getByRole('columnheader', { name: 'Round', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect(dialog.getByRole('cell', { name: '+5', exact: true })).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[class*="tableDimmed"]')).toHaveCSS('transition-duration', '0s');
  await dialog.getByRole('button', { name: 'Next Round' }).click();
  const card = page.getByRole('option').first();
  await card.click({ position: { x: 12, y: 40 } });
  await expect(card).toHaveAttribute('aria-selected', 'true');
  const motion = await card.evaluate((element) => ({ transition: getComputedStyle(element).transitionDuration, lift: getComputedStyle(element).translate }));
  expect(motion.transition).toBe('0s');
  expect(parseFloat(motion.lift.split(' ')[1]!)).toBeLessThanOrEqual(-16);
});

test.describe('touch portrait reveals', () => {
  test.use({ hasTouch: true, isMobile: true });
  for (const seat of ['west', 'north', 'east']) {
    for (const height of [560, 844]) {
      test(`${seat} stays readable at 360x${height}`, async ({ page }) => {
        await page.setViewportSize({ width: 360, height });
        await page.goto(`/tests/browser/fixtures/portrait-results.html?seat=${seat}`);
        await expect(page.getByRole('button', { name: 'Skip reveal', exact: true })).toBeVisible();
        const geometry = await page.locator('[class*="revealedHand"]').evaluate((element) => {
          const cards = Array.from(element.children).map((card) => card.getBoundingClientRect());
          return { count: cards.length, fits: cards.every((card) => card.left >= 0 && card.right <= innerWidth), exposures: cards.slice(1).map((card, index) => card.left - cards[index]!.left) };
        });
        expect(geometry.count).toBeGreaterThan(1);
        expect(geometry.fits).toBe(true);
        expect(geometry.exposures.every((width) => width >= 24)).toBe(true);
        await page.getByRole('button', { name: 'Skip reveal', exact: true }).tap();
        await expect(page.getByRole('dialog', { name: 'Round 1 Result' })).toBeVisible();
      });
    }
  }
});

test('reduced-motion Round 5 automatically reaches Summary with heading focus and contained navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/tests/browser/fixtures/portrait-results.html?final');
  const skip = page.getByRole('button', { name: 'Skip reveal', exact: true });
  await expect(page.getByRole('dialog').or(skip)).toBeVisible();
  if (await skip.count()) await skip.click();
  const summary = page.getByRole('dialog', { name: 'Session Summary', exact: true });
  await expect(summary).toBeVisible();
  await expect(summary.getByRole('heading')).toBeFocused();
  for (const name of ['Event Log', 'Home', 'Play Again', 'Event Log']) {
    await page.keyboard.press('Tab');
    await expect(summary.getByRole('button', { name, exact: true })).toBeFocused();
  }
  await page.keyboard.press('Enter');
  await page.keyboard.press('Escape');
  await expect(summary.getByRole('button', { name: 'Event Log', exact: true })).toBeFocused();
});

import { expect, test } from '@playwright/test';
import { findViewport } from './viewportMatrix';
import { waitForYourTurn } from './turnHelpers';

for (const name of ['portrait-phone-minimum', 'laptop']) {
  test(`reduced-motion thinking uses static dots at ${name}`, async ({ page }) => {
    const spec = findViewport(name);
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.clock.install();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?e2eSeed=1');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await page.getByRole('button', { name: /^Starting Round/ }).click();
    const thinking = page.getByRole('status', { name: 'East is deciding' });
    await expect(thinking).toHaveText('...');
    await expect(thinking).toHaveCSS('animation-name', 'none');
    await page.clock.runFor(100);
    await expect(thinking).toHaveText('...');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await expect(thinking).toHaveText('');
    await expect(thinking).not.toHaveCSS('animation-name', 'none');
  });
}

for (const name of ['portrait-phone-minimum', 'portrait-phone-ios-toolbar', 'portrait-tablet-768', 'portrait-square', 'large-phone-landscape', 'laptop']) {
  const spec = findViewport(name);
  for (const reducedMotion of ['reduce', 'no-preference'] as const) {
    test(`Round scores are centered at ${name}, ${reducedMotion}`, async ({ page }) => {
      await page.setViewportSize({ width: spec.width, height: spec.height });
      await page.emulateMedia({ reducedMotion });
      await page.goto('/tests/browser/fixtures/portrait-results.html');
      await page.getByRole('button', { name: 'Skip reveal', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Round 1 Result' });
      await expect(dialog.getByRole('heading')).toBeFocused();
      await page.keyboard.press('Enter');
      const offsets = await dialog.locator('tbody td:not(:first-child)').evaluateAll((cells) => cells.filter((cell) => getComputedStyle(cell).visibility !== 'hidden').map((cell) => {
        const box = cell.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(cell);
        const text = range.getBoundingClientRect();
        return Math.abs(text.x + text.width / 2 - box.x - box.width / 2);
      }));
      expect(offsets.length).toBeGreaterThanOrEqual(4);
      expect(Math.max(...offsets)).toBeLessThan(1);
    });
  }
}

test('long Summary names keep the title and actions visible at minimum portrait height', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/tests/browser/fixtures/portrait-dialogs.html?summary&longNames');
  const dialog = page.getByRole('dialog', { name: 'Session Summary', exact: true });
  await expect(dialog).toBeVisible();
  const box = (await dialog.boundingBox())!;
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.y + box.height).toBeLessThanOrEqual(552);
  for (const name of ['Event Log', 'Home', 'Play Again']) {
    const button = dialog.getByRole('button', { name, exact: true });
    await expect(button).toBeInViewport({ ratio: 1 });
    await page.keyboard.press('Tab');
    await expect(button).toBeFocused();
  }
  const body = dialog.getByRole('region', { name: 'Session results' });
  await page.keyboard.press('End');
  await expect(dialog.getByRole('table').last().getByRole('row').last()).toBeInViewport({ ratio: 1 });
  await expect(dialog.getByRole('heading')).toBeInViewport({ ratio: 1 });
  await page.keyboard.press('Home');
  expect(await body.evaluate((element) => element.scrollTop)).toBe(0);
  await body.hover();
  await page.mouse.wheel(0, 600);
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || window.scrollY !== 0)).toBe(false);
});

test.describe('mobile viewport interruptions', () => {
  test.use({ hasTouch: true, isMobile: true });

  test('toolbar height changes retain selected order and an open history dialog through the minimum', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/?e2eSeed=1');
    expect(await page.locator('meta[name="viewport"]').getAttribute('content')).not.toContain('viewport-fit=cover');
    await page.getByRole('button', { name: 'Start Game', exact: true }).tap();
    await waitForYourTurn(page);
    await page.getByRole('option').last().tap();
    await page.getByRole('button', { name: 'Sort Suit', exact: true }).tap();
    const state = () => page.locator('[data-card-key]').evaluateAll((cards) => cards.map((card) => [card.getAttribute('data-card-key'), card.getAttribute('aria-selected')]));
    const before = await state();
    await page.getByRole('button', { name: 'Event Log', exact: true }).tap();
    const log = page.getByRole('dialog', { name: 'Event Log' });
    const history = await log.textContent();
    for (const height of [560, 553, 667]) {
      await page.setViewportSize({ width: 375, height });
      if (height < 560) {
        await expect(page.getByRole('heading', { name: 'This screen is too small to play' })).toBeFocused();
        await page.keyboard.press('Escape');
      } else {
        await expect(log).toBeVisible();
        expect(await log.textContent()).toBe(history);
        const box = (await log.boundingBox())!;
        expect(box.y).toBeGreaterThanOrEqual(8);
        expect(box.y + box.height).toBeLessThanOrEqual(height - 8);
      }
      expect(await state()).toEqual(before);
    }
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: 'Event Log', exact: true })).toBeFocused();
    await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true');
  });

  test('portrait result dialogs respect emulated nonzero safe insets', async ({ page, context }) => {
    await page.setViewportSize({ width: 390, height: 664 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 44, bottom: 34, left: 12, right: 12 } });
    for (const path of ['/tests/browser/fixtures/portrait-dialogs.html?summary&longNames', '/tests/browser/fixtures/portrait-results.html']) {
      await page.goto(path);
      const reveal = page.getByRole('button', { name: 'Skip reveal', exact: true });
      if (path.includes('portrait-results')) await reveal.tap();
      const dialog = page.getByRole('dialog', { name: /Session Summary|Round 1 Result/ });
      await expect(dialog).toBeVisible();
      const box = (await dialog.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(12);
      expect(box.x + box.width).toBeLessThanOrEqual(378);
      expect(box.y).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(630);
      for (const button of await dialog.getByRole('button').all()) await expect(button).toBeInViewport({ ratio: 1 });
    }
  });
});

test('portrait-to-landscape resize cancels a selected-card drag without changing order or selection', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/?e2eSeed=1');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await waitForYourTurn(page);
  const card = page.getByRole('option').first();
  await card.click({ position: { x: 12, y: 40 } });
  const state = () => page.locator('[data-card-key]').evaluateAll((cards) => cards.map((element) => [element.getAttribute('data-card-key'), element.getAttribute('aria-selected')]));
  const before = await state();
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + 12, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 120, box.y + box.height / 2, { steps: 6 });
  await expect(card).toHaveAttribute('style', /translateX/);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(card).not.toHaveAttribute('style', /translateX/);
  await page.mouse.up();
  expect(await state()).toEqual(before);
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'landscape');
});

for (const name of ['portrait-phone-minimum', 'laptop']) {
  test(`result text, controls and focus contrast remain readable at ${name}`, async ({ page }) => {
    const spec = findViewport(name);
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    for (const path of ['/tests/browser/fixtures/portrait-results.html', '/tests/browser/fixtures/portrait-dialogs.html?summary']) {
      await page.goto(path);
      if (path.includes('portrait-results')) {
        await page.getByRole('button', { name: 'Skip reveal', exact: true }).focus();
        await page.keyboard.press('Enter');
      }
      const dialog = page.getByRole('dialog', { name: /Session Summary|Round 1 Result/ });
      await expect(dialog.getByRole('heading')).toBeFocused();
      const checkContrast = async () => {
        const failures = await dialog.evaluate((panel) => {
          const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
          const blend = (front: number[], back: number[]) => back.map((value, index) => front[index]! * (front[3] ?? 1) + value * (1 - (front[3] ?? 1)));
          const background = (element: Element | null): number[] => {
            if (!element) return [255, 255, 255];
            const color = rgb(getComputedStyle(element).backgroundColor);
            return color[3] === undefined || color[3] === 1 ? color.slice(0, 3) : blend(color, background(element.parentElement));
          };
          const luminance = (color: number[]) => color.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
          const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
          const failures: string[] = [];
          for (const element of panel.querySelectorAll('*')) {
            const style = getComputedStyle(element);
            if (style.visibility === 'hidden' || element.getClientRects().length === 0) continue;
            if (Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
              const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700);
              if (ratio(rgb(style.color), background(element)) < (large ? 3 : 4.5)) failures.push(`text: ${element.textContent}`);
            }
            if (element.matches('button') && ratio(rgb(style.borderTopColor), background(element.parentElement)) < 3) failures.push(`border: ${element.textContent}`);
            if (element.matches(':focus-visible') && (style.outlineStyle !== 'solid' || parseFloat(style.outlineWidth) < 2 || ratio(rgb(style.outlineColor), background(element.parentElement)) < 3)) failures.push(`focus: ${element.textContent}`);
          }
          return failures;
        });
        expect(failures).toEqual([]);
      };
      await checkContrast();
      for (const button of await dialog.getByRole('button').all()) {
        await page.keyboard.press('Tab');
        await expect(button).toBeFocused();
        expect(await button.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
        await button.hover();
        await checkContrast();
        await page.mouse.down();
        await checkContrast();
        await page.mouse.move(0, 0);
        await page.mouse.up();
      }
    }
  });
}

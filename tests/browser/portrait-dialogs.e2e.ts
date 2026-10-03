import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { VIEWPORT_MATRIX, findViewport } from './viewportMatrix';
import { waitForYourTurn } from './turnHelpers';

async function paintedFocusRing(page: Page, target: Locator, declaredStyle?: { width: number; offset: number; color: number[] }) {
  const rect = (await target.boundingBox())!;
  const style = declaredStyle ?? await target.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { width: parseFloat(computed.outlineWidth), offset: parseFloat(computed.outlineOffset),
      color: computed.outlineColor.match(/[\d.]+/g)!.slice(0, 3).map(Number) };
  });
  const margin = Math.max(0, style.offset + style.width) + 1;
  const clip = { x: Math.max(0, Math.floor(rect.x - margin)), y: Math.max(0, Math.floor(rect.y - margin)),
    width: Math.ceil(rect.width + 2 * margin), height: Math.ceil(rect.height + 2 * margin) };
  const screenshot = await page.screenshot({ clip, scale: 'css' });
  const count = await page.evaluate(async ({ png, rect, clip, style }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    const left = rect.x - clip.x - style.offset, top = rect.y - clip.y - style.offset;
    const right = left + rect.width + 2 * style.offset, bottom = top + rect.height + 2 * style.offset;
    let count = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const px = x + 0.5, py = y + 0.5;
        // Allow one raster pixel at fractional CSS edges, as in the hand focus probe.
        if (px < left - style.width - 1 || px > right + style.width + 1 || py < top - style.width - 1 || py > bottom + style.width + 1) continue;
        if (px >= left + 1 && px <= right - 1 && py >= top + 1 && py <= bottom - 1) continue;
        const offset = (y * image.width + x) * 4;
        if (style.color.every((channel, index) => Math.abs(data[offset + index]! - channel) <= 8)) count++;
      }
    }
    return count;
  }, { png: screenshot.toString('base64'), rect, clip, style });
  const minimum = Math.floor(0.7 * (2 * style.width * (rect.width + rect.height + 4 * style.offset) + 4 * style.width ** 2));
  return { count, minimum, screenshot, style };
}

async function expectPaintedFocusRing(page: Page, target: Locator) {
  expect(await target.evaluate((element) => element.matches(':focus-visible'))).toBe(true);
  expect(await target.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
  const ring = await paintedFocusRing(page, target);
  expect(ring.style.width).toBeGreaterThanOrEqual(2);
  expect(ring.minimum).toBeGreaterThan(0);
  expect(ring.count, 'painted pixels in the declared outline band').toBeGreaterThanOrEqual(ring.minimum);
  return ring;
}

async function expectDialogFit(page: Page, title: string) {
  const dialog = page.getByRole('dialog', { name: title, exact: true });
  const violations = await dialog.evaluate((panel) => {
    const failures: string[] = [];
    const rect = panel.getBoundingClientRect();
    if (rect.height > innerHeight - 16 || rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) failures.push('panel outside viewport');
    for (const element of panel.querySelectorAll<HTMLElement>('*')) {
      if (element.scrollWidth > element.clientWidth + 1) failures.push(`horizontal overflow: ${element.className}`);
      if (Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) && parseFloat(getComputedStyle(element).fontSize) < 14) failures.push(`small text: ${element.textContent}`);
    }
    for (const button of panel.querySelectorAll('button')) {
      const box = button.getBoundingClientRect();
      if (box.width < 44 || box.height < 44) failures.push(`small target: ${button.textContent}`);
      // Reserve the full 3px outline + 3px offset, including the known Leave bottom/right clipping case.
      if (box.left - 6 < rect.left || box.right + 6 > rect.right || box.bottom + 6 > rect.bottom) failures.push(`clipped focus: ${button.textContent}`);
      if (!button.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2))) failures.push(`covered button: ${button.textContent}`);
    }
    return failures;
  });
  expect(violations).toEqual([]);
}

for (const spec of VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported')) {
  for (const pointer of spec.pointers) {
    test.describe(`${spec.name} ${pointer}`, () => {
      test.use({ viewport: { width: spec.width, height: spec.height }, hasTouch: pointer === 'coarse', isMobile: pointer === 'coarse' });
      test('history and Leave fit, keep focus inside, and return it to their opener', async ({ page }) => {
        await page.goto('/tests/browser/fixtures/portrait-dialogs.html');
        for (const title of ['Event Log', 'Discard Pile', 'Leave Game']) {
          const opener = page.getByRole('button', { name: title, exact: true });
          await opener.focus();
          await page.keyboard.press('Enter');
          const body = page.getByRole('region', { name: `${title} content` });
          const initialFocus = title === 'Leave Game' ? page.getByRole('button', { name: 'Stay', exact: true })
            : title === 'Event Log' ? page.getByRole('list', { name: 'Session event history' }).getByRole('listitem').last() : body;
          await expect(initialFocus).toBeFocused();
          await expectDialogFit(page, title);
          await expectPaintedFocusRing(page, initialFocus);
          for (const key of ['Tab', 'Shift+Tab']) {
            for (let step = 0; step < 5; step++) {
              await page.keyboard.press(key);
              expect(await page.getByRole('dialog').evaluate((element) => element.contains(document.activeElement))).toBe(true);
              const focused = page.getByRole('dialog').locator(':focus');
              expect(await focused.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe('solid');
              if (key === 'Tab' && step < 2) await expectPaintedFocusRing(page, focused);
            }
          }
          await page.keyboard.press('Escape');
          await expect(page.getByRole('dialog')).toHaveCount(0);
          await expect(opener).toBeFocused();
        }
      });
    });
  }
}

test('minimum portrait history highlights individual events, scrolls them into view, and keeps title/close fixed', async ({ page }) => {
  const spec = findViewport('portrait-phone-minimum');
  await page.setViewportSize({ width: spec.width, height: spec.height });
  await page.goto('/tests/browser/fixtures/portrait-dialogs.html');
  await page.getByRole('button', { name: 'Event Log', exact: true }).focus();
  await page.keyboard.press('Enter');
  const body = page.getByRole('region', { name: 'Event Log content' });
  const close = page.getByRole('button', { name: 'Close Event Log' });
  const closeBox = await close.boundingBox();
  const events = page.getByRole('list', { name: 'Session event history' }).getByRole('listitem');
  await expect(events.last()).toBeFocused();
  expect(await body.evaluate((element) => element.tabIndex)).toBe(-1);
  expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await body.evaluate((element) => Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop))).toBeLessThan(2);
  await page.keyboard.press('Home');
  await expect(events.first()).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(0);
  await page.keyboard.press('ArrowDown');
  await expect(events.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await expect(events.first()).toBeFocused();
  await page.keyboard.press('End');
  await expect(events.last()).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expectPaintedFocusRing(page, events.last());
  expect(await close.boundingBox()).toEqual(closeBox);
  await page.mouse.move(1, 1);
  await page.mouse.wheel(0, 1200);
  expect(await page.evaluate(() => ({ x: scrollX, y: scrollY, overflow: document.body.style.overflow }))).toEqual({ x: 0, y: 0, overflow: 'hidden' });
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
});

test('Tab exits a focused middle event directly to Close and other entries are not Tab stops', async ({ page }) => {
  await page.goto('/tests/browser/fixtures/portrait-dialogs.html');
  await page.getByRole('button', { name: 'Event Log', exact: true }).focus();
  await page.keyboard.press('Enter');
  const events = page.getByRole('list', { name: 'Session event history' }).getByRole('listitem');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await expect(events.nth(1)).toBeFocused();
  expect(await events.evaluateAll((entries) => entries.map((entry) => entry.tabIndex))).toEqual(
    Array.from({ length: await events.count() }, (_, index) => index === 1 ? 0 : -1));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close Event Log' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(events.nth(1)).toBeFocused();
});

test('painted focus probes reject neutralized outlines for history and both Leave buttons', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/tests/browser/fixtures/portrait-dialogs.html');
  for (const title of ['Event Log', 'Discard Pile', 'Leave Game']) {
    await page.getByRole('button', { name: title, exact: true }).focus();
    await page.keyboard.press('Enter');
    const targets = title === 'Event Log' ? [page.getByRole('listitem').last()]
      : title === 'Discard Pile' ? [page.getByRole('region', { name: 'Discard Pile content' })]
        : [page.getByRole('button', { name: 'Stay', exact: true }), page.getByRole('button', { name: 'Yes, Leave Game' })];
    for (const [index, target] of targets.entries()) {
      if (index > 0) await page.keyboard.press('Tab');
      const painted = await expectPaintedFocusRing(page, target);
      await target.evaluate((element) => element.style.setProperty('outline-style', 'none', 'important'));
      const neutralized = await paintedFocusRing(page, target, painted.style);
      expect(neutralized.count, 'neutralizing the outline must fail the same pixel threshold').toBeLessThan(painted.minimum);
      expect(neutralized.count).toBeLessThan(painted.count * 0.1);
      await testInfo.attach(`${title}-${index}-painted`, { body: painted.screenshot, contentType: 'image/png' });
      await testInfo.attach(`${title}-${index}-neutralized`, { body: neutralized.screenshot, contentType: 'image/png' });
      await target.evaluate((element) => element.style.removeProperty('outline-style'));
    }
    await page.keyboard.press('Escape');
  }
});

test('dialog text, controls, and focus meet contrast thresholds in resting and hovered states', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await page.goto('/tests/browser/fixtures/portrait-dialogs.html');
  for (const title of ['Event Log', 'Discard Pile', 'Leave Game']) {
    await page.getByRole('button', { name: title, exact: true }).click();
    const dialog = page.getByRole('dialog', { name: title, exact: true });
    for (let hovered = -1; hovered < await dialog.getByRole('button').count(); hovered++) {
      if (hovered >= 0) await dialog.getByRole('button').nth(hovered).hover();
      const failures = await dialog.evaluate((panel) => {
        const rgb = (value: string) => value.match(/[\d.]+/g)!.map(Number);
        const blend = (front: number[], back: number[]) => back.map((value, index) => front[index]! * (front[3] ?? 1) + value * (1 - (front[3] ?? 1)));
        const background = (element: Element | null): number[] => element ? blend(rgb(getComputedStyle(element).backgroundColor), background(element.parentElement)) : [255, 255, 255];
        const luminance = (color: number[]) => color.map((value) => value / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
        const ratio = (a: number[], b: number[]) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05);
        const failures: string[] = [];
        for (const element of panel.querySelectorAll('*')) {
          const style = getComputedStyle(element);
          if (Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim())) {
            const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.66 && parseFloat(style.fontWeight) >= 700);
            if (ratio(rgb(style.color), background(element)) < (large ? 3 : 4.5)) failures.push(`text: ${element.textContent}`);
          }
          if (element.matches('button') && ratio(rgb(style.borderTopColor), background(element.parentElement)) < 3) failures.push(`border: ${element.textContent}`);
          if (element === document.activeElement && ratio(rgb(style.outlineColor), background(element.parentElement)) < 3) failures.push('focus');
        }
        return failures;
      });
      expect(failures).toEqual([]);
    }
    await page.keyboard.press('Escape');
  }
});

for (const turn of ['human', 'bot']) {
  test(`Leave during a pending ${turn} Turn cancels safely or abandons the run`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 560 });
    await page.goto('/?e2eSeed=1');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Starting Round/ })).toHaveCount(0);
    if (turn === 'human') await waitForYourTurn(page);
    else await expect(page.getByLabel(/^(West|North|East) is deciding$/)).toHaveCount(1);
    const opener = page.getByRole('button', { name: 'Leave Game', exact: true });
    const table = page.getByRole('region', { name: 'Game Table' });
    const before = await table.textContent();
    const hand = await page.locator('[data-card-key]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-card-key')));
    await opener.click();
    await page.waitForTimeout(2500);
    expect(await table.textContent()).toBe(before);
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    expect(await page.locator('[data-card-key]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-card-key')))).toEqual(hand);
    await opener.click();
    await page.getByRole('button', { name: 'Yes, Leave Game' }).click();
    await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
    await page.waitForTimeout(2500);
    await expect(page.getByRole('region', { name: 'Game Table' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByText('Basic · Round 1 of 5')).toBeVisible();
  });
}

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { findViewport, SUPPORTED_PORTRAIT_VIEWPORTS } from './viewportMatrix';
import { waitForYourTurn } from './turnHelpers';

async function start(page: Page) {
  await page.goto('/?e2eSeed=1');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await waitForYourTurn(page);
  await expect(page.getByRole('option')).toHaveCount(13);
}

async function keys(page: Page) {
  return page.getByRole('option').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-card-key')));
}

async function paintedFocusRing(page: Page, target: Locator) {
  await target.evaluate(async (element) => { await Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)); });
  const face = target.getByRole('img');
  const rect = (await face.boundingBox())!;
  const clip = { x: Math.max(0, Math.floor(rect.x) - 4), y: Math.max(0, Math.floor(rect.y) - 4), width: Math.ceil(rect.width) + 8, height: Math.ceil(rect.height) + 8 };
  const screenshot = await page.screenshot({ clip, scale: 'css' });
  const style = await face.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { width: parseFloat(computed.outlineWidth), scale: element.getBoundingClientRect().width / (element as HTMLElement).offsetWidth };
  });
  const pixels = await page.evaluate(async ({ png, rect, clip, style }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const data = context.getImageData(0, 0, image.width, image.height).data;
    const ring = [23, 43, 36];
    const left = rect.x - clip.x, top = rect.y - clip.y;
    const right = left + rect.width, bottom = top + rect.height;
    const thickness = style.width * style.scale;
    const solidThickness = Math.max(1, Math.floor(thickness));
    const sides: boolean[][] = [[], [], [], []];
    let count = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const edge = [Math.abs(x + 0.5 - left) <= thickness + 1, Math.abs(x + 0.5 - right) <= thickness + 1,
          Math.abs(y + 0.5 - top) <= thickness + 1, Math.abs(y + 0.5 - bottom) <= thickness + 1];
        if (x + 0.5 < left - 1 || x + 0.5 > right + 1 || y + 0.5 < top - 1 || y + 0.5 > bottom + 1 || !edge.some(Boolean)) continue;
        const offset = (y * image.width + x) * 4;
        if (!ring.every((channel, index) => Math.abs(data[offset + index]! - channel) <= 8)) continue;
        count++;
        edge.forEach((matches, side) => { if (matches) sides[side]![side < 2 ? y : x] = true; });
      }
    }
    const runs = sides.map((side) => {
      let longest = 0, current = 0;
      for (let index = 0; index < side.length; index++) {
        current = side[index] ? current + 1 : 0;
        longest = Math.max(longest, current);
      }
      return longest;
    });
    const luminance = (color: number[]) => color.map((n) => n / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i]!, 0);
    const adjacent = [[left + thickness + 1, (top + bottom) / 2], [right - thickness - 1, (top + bottom) / 2],
      [(left + right) / 2, top + thickness + 1], [(left + right) / 2, bottom - thickness - 1]];
    const contrasts = adjacent.map(([x, y]) => {
      const offset = (Math.floor(y!) * image.width + Math.floor(x!)) * 4;
      const a = luminance(ring), b = luminance([data[offset]!, data[offset + 1]!, data[offset + 2]!]);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    return { count, runs, minimum: Math.floor(0.75 * (2 * solidThickness * (rect.width + rect.height) - 4 * solidThickness ** 2)),
      contrast: Math.min(...contrasts) };
  }, { png: screenshot.toString('base64'), rect, clip, style });
  return { ...pixels, screenshot, rect, width: style.width };
}

async function expectPaintedFocusRing(page: Page, target: Locator) {
  const ring = await paintedFocusRing(page, target);
  expect(ring.width).toBeGreaterThanOrEqual(2);
  expect(ring.count, 'painted focus-ring pixels').toBeGreaterThanOrEqual(ring.minimum);
  for (const [side, run] of ring.runs.entries()) {
    expect(run, `contiguous focus band on side ${side}`).toBeGreaterThanOrEqual((side < 2 ? ring.rect.height : ring.rect.width) * 0.65);
  }
  expect(ring.contrast).toBeGreaterThanOrEqual(3);
  return ring;
}

for (const spec of [...SUPPORTED_PORTRAIT_VIEWPORTS, findViewport('large-phone-landscape')]) {
  for (const pointer of spec.pointers ?? ['fine']) {
    test.describe(`${spec.name} ${pointer} hand`, () => {
      test.use({ viewport: { width: spec.width, height: spec.height }, hasTouch: pointer === 'coarse', isMobile: pointer === 'coarse' });
      test('all thirteen exposed faces select independently and the strip below a raised neighbor targets the visible card', async ({ page }) => {
        await start(page);
        const cards = page.getByRole('option');
        const before = await keys(page);
        const rects = await cards.evaluateAll((elements) => elements.map((element) => {
          const r = element.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }));
        for (let index = 0; index < 13; index++) {
          const rect = rects[index]!;
          const exposed = index === 12 ? rect.width : rects[index + 1]!.x - rect.x;
          expect(exposed).toBeGreaterThanOrEqual((spec.orientation === 'portrait' ? 24 : 28) - 0.1);
          expect(rect.width / rect.height).toBeCloseTo(5 / 7, 2);
          expect(rect.y).toBeCloseTo(rects[0]!.y, 1);
          const x = rect.x + exposed / 2;
          const y = rect.y + rect.height / 2;
          if (pointer === 'coarse') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
          await expect(cards.nth(index)).toHaveAttribute('aria-selected', 'true');
          await expect.poll(async () => rect.y - (await cards.nth(index).boundingBox())!.y).toBeGreaterThanOrEqual(spec.orientation === 'portrait' ? 16 : 8);
          if (pointer === 'coarse') await page.touchscreen.tap(x, y - 18); else await page.mouse.click(x, y - 18);
          await expect(cards.nth(index)).toHaveAttribute('aria-selected', 'false');
        }
        expect(await keys(page)).toEqual(before);
        const neighbor = rects[1]!;
        const exposed = rects[2]!.x - neighbor.x;
        const tap = async (x: number, y: number) => {
          if (pointer === 'coarse') await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
        };
        await tap(neighbor.x + exposed / 2, neighbor.y + neighbor.height / 2);
        await expect.poll(async () => neighbor.y - (await cards.nth(1).boundingBox())!.y).toBeGreaterThan(8);
        const overlap = rects[0]!.x + rects[0]!.width - neighbor.x;
        await tap(neighbor.x + overlap / 2, neighbor.y + neighbor.height - 3);
        await expect(cards.nth(0)).toHaveAttribute('aria-selected', 'true');
        await expect(cards.nth(1)).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByText('← → choose · Space select · Shift+← → move')).not.toBeVisible();
      });
    });
  }
}

for (const name of [...SUPPORTED_PORTRAIT_VIEWPORTS.map((spec) => spec.name), 'large-phone-landscape']) {
  test(`${name}: keyboard identity, hint fit, focus outline and sort Tab stops`, async ({ page }) => {
    const spec = findViewport(name);
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await start(page);
    await page.getByRole('button', { name: 'Leave Game', exact: true }).focus();
    await page.keyboard.press('Tab');
    const card = page.getByRole('option').first();
    const key = await card.getAttribute('data-card-key');
    const target = page.locator(`[data-card-key="${key}"]`);
    await expect(target).toBeFocused();
    const before = await keys(page);
    await page.keyboard.press('Space');
    await page.keyboard.press('Shift+End');
    expect((await keys(page)).at(-1)).toBe(key);
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Shift+Home');
    expect(await keys(page)).toEqual(before);
    const hint = page.getByText('← → choose · Space select · Shift+← → move');
    await expect(hint).toBeVisible();
    const fit = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, vw: innerWidth, vh: innerHeight }));
    expect(fit.width).toBeLessThanOrEqual(fit.vw);
    expect(fit.height).toBeLessThanOrEqual(fit.vh);
    const hintBox = (await hint.boundingBox())!;
    const sortBox = (await page.getByRole('button', { name: 'Sort Rank' }).boundingBox())!;
    const rowBox = (await page.getByRole('listbox').boundingBox())!;
    expect(hintBox.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
    expect(hintBox.y + hintBox.height).toBeLessThanOrEqual(sortBox.y);
    for (const name of ['Event Log', 'Check Discard Pile', 'Leave Game', 'Sort Rank', 'Sort Suit', 'Pass', 'Play']) {
      const box = (await page.getByRole('button', { name, exact: true }).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(spec.width);
      expect(box.y + box.height).toBeLessThanOrEqual(spec.height);
    }
    await expectPaintedFocusRing(page, target);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Sort Rank' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    await expect(target).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(target).toBeFocused();
    await expect(target).toHaveAttribute('aria-selected', 'true');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(await target.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe('0s');
    await expect(target).toHaveAttribute('aria-selected', 'true');
  });
}

test('focus pixel probe distinguishes the shipped face ring from the occluded ancestor ring', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 560 });
  await start(page);
  await page.getByRole('button', { name: 'Leave Game', exact: true }).focus();
  await page.keyboard.press('Tab');
  const target = page.getByRole('option').first();
  const shipped = await expectPaintedFocusRing(page, target);
  await target.getByRole('img').evaluate((face) => {
    (face as HTMLElement).style.outline = '3px solid #172b24';
    (face as HTMLElement).style.outlineOffset = '-3px';
  });
  const control = await expectPaintedFocusRing(page, target);
  await target.evaluate((element) => {
    const slot = element as HTMLElement;
    slot.style.outline = '3px solid #172b24';
    slot.style.outlineOffset = '-3px';
    (slot.querySelector('[role="img"]') as HTMLElement).style.outlineColor = 'transparent';
  });
  const occluded = await paintedFocusRing(page, target);
  expect(occluded.count).toBeLessThan(shipped.minimum);
  await testInfo.attach('shipped-focus-ring', { body: shipped.screenshot, contentType: 'image/png' });
  await testInfo.attach('control-face-ring', { body: control.screenshot, contentType: 'image/png' });
  console.log(`Focus pixels: shipped=${shipped.count}, face control=${control.count}, occluded ancestor=${occluded.count}; minimum=${shipped.minimum}; contrast=${shipped.contrast.toFixed(2)}:1`);
});

for (const pointer of ['mouse', 'touch'] as const) {
  test.describe(`${pointer} bounded portrait drag`, () => {
    test.use({ viewport: { width: 360, height: 560 }, hasTouch: pointer === 'touch', isMobile: pointer === 'touch' });
    test('moves first, middle, last and selected cards while preserving selection; touch jitter stays a tap', async ({ page }) => {
      await start(page);
      const cdp = await page.context().newCDPSession(page);
      const down = async (x: number, y: number) => {
        if (pointer === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
        else { await page.mouse.move(x, y); await page.mouse.down(); }
      };
      const move = async (x: number, y: number) => {
        if (pointer === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        else await page.mouse.move(x, y);
      };
      const up = async () => {
        if (pointer === 'touch') await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); else await page.mouse.up();
      };
      const initial = await keys(page);
      const selected = page.locator(`[data-card-key="${initial[0]}"]`);
      const box = (await selected.boundingBox())!;
      await down(box.x + 8, box.y + box.height / 2);
      if (pointer === 'touch') await move(box.x + 18, box.y + box.height / 2);
      await up();
      await expect(selected).toHaveAttribute('aria-selected', 'true');
      expect(await keys(page)).toEqual(initial);
      for (const [from, to] of [[0, 12], [6, 0], [12, 0], [0, 6]]) {
        const before = await keys(page);
        const card = page.getByRole('option').nth(from!);
        const key = before[from!]!;
        const current = page.locator(`[data-card-key="${key}"]`);
        const startBox = (await card.boundingBox())!;
        const row = (await page.getByRole('listbox').boundingBox())!;
        const destination = (await page.getByRole('option').nth(to!).boundingBox())!;
        const x = to === 0 ? row.x - 100 : to === 12 ? row.x + row.width + 100 : destination.x + destination.width / 2;
        await down(startBox.x + 8, startBox.y + startBox.height / 2);
        await move(x, startBox.y + startBox.height / 2);
        const moved = (await current.boundingBox())!;
        expect(moved.x).toBeGreaterThanOrEqual(row.x - 1);
        expect(moved.x + moved.width).toBeLessThanOrEqual(row.x + row.width + 1);
        await up();
        expect(await keys(page)).not.toEqual(before);
        expect([...(await keys(page))].sort()).toEqual([...initial].sort());
        await expect(selected).toHaveAttribute('aria-selected', 'true');
        await expect(page.getByRole('option', { selected: true })).toHaveCount(1);
      }
      await cdp.detach();
    });
  });
}

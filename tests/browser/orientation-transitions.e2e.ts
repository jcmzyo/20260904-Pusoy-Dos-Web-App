import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { findViewport } from './viewportMatrix';
import type { ViewportSpec } from './viewportMatrix';
import { waitForYourTurn } from './turnHelpers';

/**
 * Real-browser coverage for M5-T02's transition contract (ui-ux.md §19.6.2; testing-simulation.md "Frozen
 * M5 acceptance matrix", Transition cases): supported portrait <-> supported landscape, and supported ->
 * unsupported -> supported, while a human Turn is pending, while a bot Turn is pending, and while an
 * overlay is open - each keeping the same run, pending Turn, selection, display order, and open overlay,
 * with no Session reset, no hidden advancement while unsupported, and no duplicated commit afterwards.
 * Plus a resize during an active drag, which must cancel the drag with the order unchanged.
 *
 * "Same run" is read from state the table renders: the Round header, the four seats' public panels, the
 * center hand to beat, and the human's own hand. Those panels stay in the DOM (hidden and inert) behind an
 * unsupported notice, so they can be read while it is showing too. Seeded through main.tsx's dev-only
 * `?e2eSeed=` hook so the deal, and therefore every Turn order below, is reproducible.
 */

const E2E_SEED = 8;

const PORTRAIT_PHONE = findViewport('portrait-phone-390');
const PHONE_LANDSCAPE = findViewport('large-phone-landscape');
const PORTRAIT_TABLET = findViewport('portrait-tablet-768');
const TABLET_LANDSCAPE = findViewport('tablet-landscape');
// Coarse-pointer guidance for this size is "This screen is too small to play" (no orientation fits).
const TOO_SMALL = findViewport('undersized-landscape');

/** How long an unsupported interruption is held: comfortably longer than a bot's own Turn delay, so any
 *  progression that was not actually paused would show up as a changed fingerprint. */
const HELD_UNSUPPORTED_MS = 2_500;

async function resizeTo(page: Page, spec: ViewportSpec) {
  await page.setViewportSize({ width: spec.width, height: spec.height });
}

async function startGameAt(page: Page, spec: ViewportSpec) {
  await resizeTo(page, spec);
  await page.goto(`/?e2eSeed=${E2E_SEED}`);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Starting Round/ })).toHaveCount(0);
}

/** The public game facts on the table: Round, each seat's count, score, Turn, and status, and the center hand.
 *  Read as facts rather than raw panel text, because the same facts are laid out differently per composition
 *  (ui-ux.md §19.6.3: the phone-portrait panel puts count and score on separate lines and drops the Play trail). */
async function progressFingerprint(page: Page): Promise<string> {
  return page.evaluate(() => {
    const parts: string[] = [];
    parts.push(document.querySelector('header p')?.textContent ?? '');
    for (const panel of document.querySelectorAll('[aria-label$=" panel"]')) {
      const text = panel.textContent ?? '';
      const facts = [/(\d+) cards?/, /(\d+) pts/, /DONE(?: · \w+)?|PASS|Turn/].map((pattern) => text.match(pattern)?.[0] ?? '');
      parts.push(`${panel.getAttribute('aria-label')}|${panel.getAttribute('aria-current')}|${facts.join('|')}`);
    }
    const center = document.querySelector('[aria-label="Current hand to beat"]');
    parts.push(center?.querySelector('p')?.textContent ?? '');
    parts.push(Array.from(center?.querySelectorAll('[role="img"]') ?? []).map((card) => card.getAttribute('aria-label')).join(','));
    return parts.join('\n');
  });
}

async function handState(page: Page) {
  return page.evaluate(() => ({
    order: Array.from(document.querySelectorAll('[data-card-key]')).map((slot) => slot.getAttribute('data-card-key')),
    selected: Array.from(document.querySelectorAll('[data-card-key][data-selected="true"]')).map((slot) => slot.getAttribute('data-card-key')),
  }));
}

async function expectComposition(page: Page, composition: string) {
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', composition);
}

async function expectTooSmallNotice(page: Page) {
  const heading = page.getByRole('heading', { name: 'This screen is too small to play', exact: true });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole('region', { name: 'Game Table' })).toHaveCount(0);
}

/** Holds the unsupported state and proves nothing advanced behind it. */
async function expectNoAdvancementWhileHeld(page: Page) {
  const atStart = await progressFingerprint(page);
  await page.waitForTimeout(HELD_UNSUPPORTED_MS);
  expect(await progressFingerprint(page), 'progress behind the unsupported notice').toBe(atStart);
}

/** Entries in the whole-Session Event Log that the human made. Opens and closes the log (which pauses and
 *  resumes progression the same way it always does). */
async function humanEventCount(page: Page): Promise<number> {
  await page.getByRole('button', { name: 'Event Log', exact: true }).click();
  const log = page.getByRole('list', { name: 'Session event history' });
  await expect(log).toBeVisible();
  const count = await log.locator('li').evaluateAll((items) => items.filter((item) => item.textContent?.trim().startsWith('You ')).length);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toHaveCount(0);
  return count;
}

test.describe('touch device (coarse pointer) rotation and undersizing', () => {
  test.use({ hasTouch: true });

  test('a pending human Turn keeps its hand, selection, and Turn across rotations and an undersized interruption, then commits exactly once', async ({ page }) => {
    await startGameAt(page, PORTRAIT_PHONE);
    await expectComposition(page, 'portrait-phone');
    await waitForYourTurn(page);

    const slots = page.getByRole('listbox', { name: 'Your hand' }).locator('[data-card-key]');
    await slots.last().click();
    const before = await handState(page);
    expect(before.selected).toHaveLength(1);
    const humanEventsBefore = await humanEventCount(page);
    const fingerprint = await progressFingerprint(page);

    for (const [spec, composition] of [[PHONE_LANDSCAPE, 'landscape'], [PORTRAIT_PHONE, 'portrait-phone']] as const) {
      await resizeTo(page, spec);
      await expectComposition(page, composition);
      expect(await handState(page)).toEqual(before);
      expect(await progressFingerprint(page)).toBe(fingerprint);
      await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true');
      await expect(page.getByRole('button', { name: /^Starting Round/ })).toHaveCount(0);
    }

    await resizeTo(page, TOO_SMALL);
    await expectTooSmallNotice(page);
    await expectNoAdvancementWhileHeld(page);
    expect(await progressFingerprint(page)).toBe(fingerprint);

    await resizeTo(page, PORTRAIT_PHONE);
    await expectComposition(page, 'portrait-phone');
    expect(await handState(page)).toEqual(before);
    expect(await progressFingerprint(page)).toBe(fingerprint);
    await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true');

    // One action after all of that commits exactly one human event: nothing was queued up or replayed.
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    if (await pass.isEnabled()) {
      await pass.click();
    } else {
      // Opening / free lead: lead a single card (3♣ when this is the Opening, which the Engine requires).
      await slots.last().click();
      const lead = (await handState(page)).order.includes('3-clubs') ? slots.and(page.locator('[data-card-key="3-clubs"]')) : slots.last();
      await lead.click({ position: { x: 4, y: 12 } });
      await page.getByRole('button', { name: 'Play', exact: true }).click();
    }
    await expect(page.getByRole('region', { name: 'You panel' })).not.toHaveAttribute('aria-current', 'true');
    expect(await humanEventCount(page)).toBe(humanEventsBefore + 1);
  });

  test('a pending bot Turn does not advance while undersized, and progression resumes once supported again', async ({ page }) => {
    await startGameAt(page, TABLET_LANDSCAPE);
    // Wait for a bot to be the current Turn.
    await expect(page.getByLabel(/^(West|North|East) is deciding$/)).toHaveCount(1, { timeout: 20_000 });
    const round = await page.locator('header p').textContent();
    const hand = await handState(page);

    await resizeTo(page, PORTRAIT_TABLET);
    await expectComposition(page, 'portrait-tablet');
    expect(await handState(page)).toEqual(hand);

    await resizeTo(page, TOO_SMALL);
    await expectTooSmallNotice(page);
    await expectNoAdvancementWhileHeld(page);
    const heldFingerprint = await progressFingerprint(page);

    await resizeTo(page, TABLET_LANDSCAPE);
    await expectComposition(page, 'landscape');
    await expect(page.locator('header p')).toHaveText(round ?? '');
    // Resumed from the same point: progression moves on from exactly what was held (the bot acts).
    await expect.poll(() => progressFingerprint(page), { timeout: 20_000 }).not.toBe(heldFingerprint);
  });

  test('an open overlay survives rotation and an undersized interruption, and recovery does not release its pause', async ({ page }) => {
    await startGameAt(page, PHONE_LANDSCAPE);
    const hand = await handState(page);
    await page.getByRole('button', { name: 'Event Log', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Event Log' });
    await expect(dialog).toBeVisible();
    const fingerprint = await progressFingerprint(page);

    await resizeTo(page, PORTRAIT_PHONE);
    await expect(dialog).toBeVisible();
    await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', 'portrait-phone');

    await resizeTo(page, TOO_SMALL);
    await expectTooSmallNotice(page);
    await expect(dialog).toHaveCount(0);
    // Escape reaches nothing behind the notice: it must not close the overlay the person cannot see.
    await page.keyboard.press('Escape');

    await resizeTo(page, PORTRAIT_PHONE);
    await expect(dialog).toBeVisible();
    // The overlay's own pause is still held after recovery.
    await page.waitForTimeout(HELD_UNSUPPORTED_MS);
    expect(await progressFingerprint(page)).toBe(fingerprint);
    expect(await handState(page)).toEqual(hand);
    await expect(page.getByRole('button', { name: /^Starting Round/ })).toHaveCount(0);
  });

  test('the notice takes focus and gives it back to the previously focused control on recovery', async ({ page }) => {
    await startGameAt(page, PORTRAIT_PHONE);
    const discard = page.getByRole('button', { name: 'Check Discard Pile', exact: true });
    await discard.focus();
    await expect(discard).toBeFocused();

    await resizeTo(page, TOO_SMALL);
    await expectTooSmallNotice(page);

    await resizeTo(page, PHONE_LANDSCAPE);
    await expectComposition(page, 'landscape');
    await expect(discard).toBeFocused();
  });
});

test('a resize during an active drag cancels it: nothing is dropped, the order is unchanged, and no card is selected', async ({ page }) => {
  await startGameAt(page, findViewport('laptop'));
  const slots = page.getByRole('listbox', { name: 'Your hand' }).locator('[data-card-key]');
  await expect(slots).toHaveCount(13);
  const before = await handState(page);

  const box = (await slots.nth(0).boundingBox())!;
  const startX = box.x + 6;
  const y = box.y + box.height / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  await page.mouse.move(startX + 60, y, { steps: 6 });
  await page.mouse.move(startX + 160, y, { steps: 6 });
  await expect(slots.nth(0)).toHaveAttribute('style', /translateX/);

  await resizeTo(page, findViewport('windowed-desktop'));
  await expect(slots.nth(0)).not.toHaveAttribute('style', /translateX/);
  // Keeps moving and releases where a completed drag would have dropped it several places along.
  await page.mouse.move(startX + 200, y, { steps: 4 });
  await page.mouse.up();

  expect(await handState(page)).toEqual(before);
  // The next ordinary click still selects normally (the cancelled gesture swallowed nothing extra).
  await slots.last().click();
  expect((await handState(page)).selected).toEqual([before.order[before.order.length - 1]]);
});

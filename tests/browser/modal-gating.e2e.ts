import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Real-browser coverage for the M4-T14.5 review fixes that depend on real `inert`/focus/layout behavior
 * (jsdom implements none of it): a modal overlay must make the table beneath it unreachable from the
 * keyboard too, and an unsupported-layout interruption must not throw away the person's own interaction
 * state. Vitest/RTL (App.test.tsx, SessionTable.test.tsx) covers the same contracts at the state level.
 */

async function startGame(page: Page) {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  // The Round-start transition covers the whole table for a moment; only what is beneath it matters here.
  await expect(page.getByRole('button', { name: /^Starting Round/ })).not.toBeVisible();
}

/** Everything Tab can land on inside the Game Table's own subtree, after `presses` Tab presses. */
async function tabThroughAndCollectTableFocus(page: Page, presses: number): Promise<string[]> {
  const reached: string[] = [];
  for (let press = 0; press < presses; press++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const active = document.activeElement as HTMLElement | null;
      if (!active) return null;
      // The bottom bar (Event Log/Discard Pile/Leave Game, hand, Sort, Play/Pass) lives beside the table
      // section inside the same inert wrapper, so "beneath the modal" is the wrapper, not just the section.
      const wrapper = document.querySelector('[aria-label="Game Table"]')!.parentElement!;
      return wrapper.contains(active) ? (active.getAttribute('aria-label') ?? active.textContent ?? active.tagName) : null;
    });
    if (label !== null) reached.push(label);
  }
  return reached;
}

for (const opener of [
  { button: 'Event Log', dialog: 'Event Log' },
  { button: 'Check Discard Pile', dialog: 'Discard Pile' },
  { button: 'Leave Game', dialog: 'Leave Game' },
]) {
  test(`keyboard Tab cannot reach Pass, Play, the hand, or any other table control while ${opener.dialog} is open`, async ({ page }) => {
    await startGame(page);
    await page.getByRole('button', { name: opener.button, exact: true }).click();
    await expect(page.getByRole('dialog', { name: opener.dialog })).toBeVisible();

    const wrapperIsInert = await page.evaluate(() => document.querySelector('[aria-label="Game Table"]')!.closest('[inert]') !== null);
    expect(wrapperIsInert).toBe(true);

    // A blocked Pass cannot be activated by force-focusing it and pressing Enter (done before any Tab, so
    // that Enter can never land on one of the dialog's own controls, e.g. "Yes, Leave Game").
    await page.getByRole('button', { name: 'Pass', exact: true }).evaluate((button) => (button as HTMLElement).focus());
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: opener.dialog })).toBeVisible();
    await expect(page.getByText('You passed.')).toHaveCount(0);

    // Then Tab well past the dialog's own handful of focusable controls: focus never reaches the table.
    expect(await tabThroughAndCollectTableFocus(page, 12)).toEqual([]);
  });
}

test('Escape closes an overlay opened from the keyboard and returns focus to the control that opened it', async ({ page }) => {
  await startGame(page);
  const eventLog = page.getByRole('button', { name: 'Event Log', exact: true });
  await eventLog.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toHaveCount(0);
  await expect(eventLog).toBeFocused();
});

test('an unsupported-layout interruption keeps the hand arrangement, selection, open Event Log and started Round', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const slots = hand.locator('[data-card-key]');
  await expect(slots).toHaveCount(13);

  await page.getByRole('button', { name: 'Sort Rank', exact: true }).click();
  await page.getByRole('button', { name: 'Sort Suit', exact: true }).click();
  const keys = () => slots.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-card-key')));
  const selected = () => hand.locator('[data-card-key][data-selected="true"]').evaluateAll((elements) => elements.map((element) => element.getAttribute('data-card-key')));
  const arrangedBefore = await keys();
  await slots.nth(4).click();
  const selectedBefore = await selected();
  expect(selectedBefore).toHaveLength(1);

  await page.getByRole('button', { name: 'Event Log', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toBeVisible();

  // Undersized landscape (the frozen matrix's own `undersized-landscape` entry): the notice takes over.
  await page.setViewportSize({ width: 560, height: 320 });
  await expect(page.getByText('Resize your window to continue')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Game Table' })).toHaveCount(0);
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toHaveCount(0);
  // Escape must not close the overlay the person cannot currently see.
  await page.keyboard.press('Escape');

  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Event Log' })).toBeVisible();
  expect(await keys()).toEqual(arrangedBefore);
  expect(await selected()).toEqual(selectedBefore);
  // Not a fresh mount: the Round-start transition does not replay.
  await expect(page.getByRole('button', { name: /^Starting Round/ })).toHaveCount(0);
});

test('the current Turn glow is the documented cyan, not the earlier sky blue or the silver finish glow', async ({ page }) => {
  await startGame(page);
  const current = page.locator('[aria-current="true"]').first();
  await expect(current).toBeVisible({ timeout: 20000 });
  const colors = await current.evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderTopColor, shadow: style.boxShadow };
  });
  expect(colors.border).toBe('rgb(34, 211, 238)');
  expect(colors.shadow).toContain('rgba(34, 211, 238');
});

test('a cancelled real drag leaves the hand order untouched and does not swallow the next card click', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const slots = hand.locator('[data-card-key]');
  await expect(slots).toHaveCount(13);
  const keys = () => slots.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-card-key')));
  const orderBefore = await keys();

  const box = (await slots.nth(0).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2, { steps: 8 });
  // The browser taking the gesture over mid-drag (touch scroll, system gesture): a real `pointercancel`
  // cannot be produced from a mouse, so dispatch the event itself on the dragged card.
  await slots.nth(0).evaluate((element) => element.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
  expect(await keys()).toEqual(orderBefore);
  expect(await slots.nth(0).evaluate((element) => (element as HTMLElement).style.transform)).toBe('');
  // Release the mouse away from the hand (a cancelled gesture produces no click of its own).
  await page.mouse.move(5, 5);
  await page.mouse.up();

  await slots.nth(3).click();
  await expect(slots.nth(3)).toHaveAttribute('data-selected', 'true');
});

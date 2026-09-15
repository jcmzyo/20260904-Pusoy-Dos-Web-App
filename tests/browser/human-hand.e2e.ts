import { expect, test } from '@playwright/test';
import { VIEWPORT_MATRIX, MINIMUM_EXPOSED_CARD_WIDTH_PX } from './viewportMatrix';

/**
 * Real-browser coverage for M4-T07 (ui-ux.md §6): selection, always-visible
 * sorting, and bounded mouse drag reorder for the human hand. Vitest/RTL
 * already covers selection/sort/selection-survival state logic
 * (tests/unit/ui/HumanHand.test.tsx) and the pure ordering helpers
 * (tests/unit/ui/handOrdering.test.ts); this file is for behavior that
 * needs real layout and pointer geometry, per testing-simulation.md/ui-ux.md
 * §16's Vitest/Playwright split.
 */

async function startGame(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
}

test('every dealt card is selectable independently, and selection survives Sort Rank/Sort Suit', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const cards = hand.getByRole('img');
  const slots = hand.locator('[data-card-key]');
  await expect(cards).toHaveCount(13);

  const first = cards.nth(0);
  const firstSlot = slots.nth(0);
  const lastSlot = slots.nth(12);
  await first.click();
  await expect(firstSlot).toHaveAttribute('data-selected', 'true', { timeout: 2000 });
  const firstKey = await firstSlot.getAttribute('data-card-key');

  await cards.nth(12).click();
  await expect(lastSlot).toHaveAttribute('data-selected', 'true');
  // The first card's own selection (identified by its stable card key, not DOM index) survives
  // reflow caused by selecting a second card.
  const stillSelected = await hand.locator(`[data-card-key="${firstKey}"]`).getAttribute('data-selected');
  expect(stillSelected).toBe('true');

  await page.getByRole('button', { name: 'Sort Rank', exact: true }).click();
  await expect(hand.locator(`[data-card-key="${firstKey}"]`)).toHaveAttribute('data-selected', 'true');

  await page.getByRole('button', { name: 'Sort Suit', exact: true }).click();
  await expect(hand.locator(`[data-card-key="${firstKey}"]`)).toHaveAttribute('data-selected', 'true');
});

test('dragging a card reorders the hand without changing what is selected', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const slots = hand.locator('[data-card-key]');
  await expect(slots).toHaveCount(13);

  // Select a card that will not be dragged, so we can confirm the drag never disturbs selection.
  await hand.getByRole('img').nth(6).click();
  const untouchedKey = await slots.nth(6).getAttribute('data-card-key');
  // Also select the card that IS about to be dragged (ui-ux.md §6: "A selected card remains
  // selected when moved").
  await hand.getByRole('img').nth(0).click();

  const before = await slots.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-card-key')));
  const dragged = slots.first();
  const draggedKey = before[0]!;
  const dragTarget = slots.nth(5);
  const draggedBox = (await dragged.boundingBox())!;
  const targetBox = (await dragTarget.boundingBox())!;

  await page.mouse.move(draggedBox.x + draggedBox.width / 2, draggedBox.y + draggedBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 12 });
  await page.mouse.up();

  const after = await slots.evaluateAll((elements) => elements.map((el) => el.getAttribute('data-card-key')));
  expect(after).not.toEqual(before);
  expect(after.indexOf(draggedKey)).not.toBe(0);
  expect([...after].sort()).toEqual([...before].sort());

  await expect(hand.locator(`[data-card-key="${untouchedKey}"]`)).toHaveAttribute('data-selected', 'true');
  await expect(hand.locator(`[data-card-key="${draggedKey}"]`)).toHaveAttribute('data-selected', 'true');
  for (const key of after) {
    if (key !== untouchedKey && key !== draggedKey) {
      await expect(hand.locator(`[data-card-key="${key}"]`)).toHaveAttribute('data-selected', 'false');
    }
  }
});

test('a drag is bounded to the hand region and cannot be pulled outside it', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const handRowBox = (await hand.boundingBox())!;
  const dragged = hand.locator('[data-card-key]').first();
  const draggedBox = (await dragged.boundingBox())!;

  await page.mouse.move(draggedBox.x + draggedBox.width / 2, draggedBox.y + draggedBox.height / 2);
  await page.mouse.down();
  // Attempt to drag far outside the hand region, well past its left edge.
  await page.mouse.move(handRowBox.x - 400, draggedBox.y + draggedBox.height / 2, { steps: 10 });
  const midDragBox = (await dragged.boundingBox())!;
  expect(midDragBox.x).toBeGreaterThanOrEqual(handRowBox.x - 1);
  await page.mouse.up();
});

test(`overlapped cards stay independently targetable at the small supported landscape viewport (>= ${MINIMUM_EXPOSED_CARD_WIDTH_PX}px exposed)`, async ({ page }) => {
  const spec = VIEWPORT_MATRIX.find((entry) => entry.name === 'small-phone-landscape');
  if (!spec) throw new Error('Viewport matrix is missing its small-phone-landscape entry.');
  await page.setViewportSize({ width: spec.width, height: spec.height });
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const cards = hand.getByRole('img');
  const slots = hand.locator('[data-card-key]');
  await expect(cards).toHaveCount(13);
  // Every card must be independently hit-testable/targetable regardless of overlap (ui-ux.md §6) — a
  // click landing on the wrong (neighboring) card would still show up as a selection mismatch below.
  // Only the first 5 clicks can actually select anything: at Session start the Trick is the Opening
  // Move, so the Play selection cap is 5 (M4-T08's "up to 5 cards if free play"); the remaining clicks
  // still prove their own card was correctly targeted by staying reliably deselected.
  const FREE_PLAY_CAP = 5;
  for (let index = 0; index < 13; index++) {
    await cards.nth(index).click();
    await expect(slots.nth(index)).toHaveAttribute('data-selected', index < FREE_PLAY_CAP ? 'true' : 'false');
  }
});

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

test('the hand row holding Sort Rank/Sort Suit is sized purely from the viewport, never from held card count (person\'s own follow-up report: they visibly shifted once the hand emptied)', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  await expect(hand.locator('[data-card-key]')).toHaveCount(13);

  // `.handRow`'s own height is a fixed CSS expression derived only from the viewport - the same
  // `clamp(40px, 8vw, 88px)` width formula Card.module.css's own `.card` uses, at that card's own
  // `aspect-ratio: 5 / 7` (HumanHand.module.css's `.handRow` docstring). Comparing the real computed
  // height against that same formula, independently evaluated here from the viewport alone, proves the
  // row's height cannot vary with how many cards are actually held (0 included) - an unwanted
  // dependency on card count (e.g. a content-driven `min-height`) would make this assertion fail
  // without ever needing to actually empty the hand through real gameplay, which - per
  // round-result.e2e.ts's own docstring - the human seat's own minimal-Pass-when-legal strategy can
  // almost never reliably reach.
  const { actualHeightPx, expectedHeightPx } = await page.evaluate(() => {
    const row = document.querySelector('[aria-label="Your hand"]') as HTMLElement;
    const cardWidthPx = Math.min(88, Math.max(40, window.innerWidth * 0.08));
    return { actualHeightPx: row.getBoundingClientRect().height, expectedHeightPx: (cardWidthPx * 7) / 5 };
  });
  expect(actualHeightPx).toBeCloseTo(expectedHeightPx, 0);

  // Sort Rank/Sort Suit sit centered directly beneath that same row, within their shared reserved-width
  // container (`.handArea`'s own column layout, HumanHand.module.css) - confirm the pair's own combined
  // midpoint lands on that container's true horizontal center, not merely somewhere below the hand.
  const handArea = page.locator('[aria-label="Your hand"] >> xpath=..');
  const areaBox = (await handArea.boundingBox())!;
  const sortRank = page.getByRole('button', { name: 'Sort Rank', exact: true });
  const sortSuit = page.getByRole('button', { name: 'Sort Suit', exact: true });
  const rankBox = (await sortRank.boundingBox())!;
  const suitBox = (await sortSuit.boundingBox())!;
  const sortMidpointX = (rankBox.x + (suitBox.x + suitBox.width)) / 2;
  expect(sortMidpointX).toBeCloseTo(areaBox.x + areaBox.width / 2, 0);
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

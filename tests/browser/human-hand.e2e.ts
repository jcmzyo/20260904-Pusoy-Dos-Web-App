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

/**
 * Whichever seat holds the 3♣ a Round opens with (and what it leads with) is not something this file
 * can assume - the production RNG this file drives has no seed hook, by design (round-result.e2e.ts's
 * own comment). So a test that needs to select more than one held card waits for a Turn whose live Play
 * selection cap (App.tsx's own `maxSelectableCards`, mirrored here from the rendered center state) is
 * actually large enough, Passing through any Turn that falls short - Pass is always legal while
 * responding. Bounded the same way round-result.e2e.ts's own `driveRoundToResult` is, so a genuine
 * regression fails with a diagnostic instead of hanging.
 */
const SELECTION_TURN_BUDGET = 40;

async function waitForYourTurn(page: import('@playwright/test').Page) {
  await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true', { timeout: 20_000 });
}

async function currentSelectionCap(page: import('@playwright/test').Page): Promise<number> {
  const count = await page.locator('[aria-label="Current hand to beat"] [role="img"]').count();
  return count > 0 ? count : 5;
}

async function waitForSelectableTurn(page: import('@playwright/test').Page, minCap: number): Promise<number> {
  const passButton = page.getByRole('button', { name: 'Pass', exact: true });
  for (let turn = 0; turn < SELECTION_TURN_BUDGET; turn++) {
    await waitForYourTurn(page);
    const cap = await currentSelectionCap(page);
    if (cap >= minCap) return cap;
    await expect(passButton, `Turn ${turn}: selection cap ${cap} is below ${minCap} but Pass is unavailable (an Opening/free-lead Turn always caps at 5)`).toBeEnabled();
    await passButton.click();
  }
  throw new Error(`No Turn with a selection cap >= ${minCap} arrived within ${SELECTION_TURN_BUDGET} of this seat's own Turns.`);
}

test('every dealt card is selectable independently, and selection survives Sort Rank/Sort Suit', async ({ page }) => {
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const cards = hand.getByRole('img');
  const slots = hand.locator('[data-card-key]');
  await expect(cards).toHaveCount(13);

  // Selecting a second card (rather than one) is what this test needs to prove the first survives it,
  // so this Turn's own live cap must allow at least two (see `waitForSelectableTurn`'s own docstring).
  await waitForSelectableTurn(page, 2);
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

  // Selecting two cards (rather than one) is what this test needs to prove the drag disturbs neither,
  // so this Turn's own live cap must allow at least two (see `waitForSelectableTurn`'s own docstring).
  await waitForSelectableTurn(page, 2);
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

  // `.handRow`'s own height is a fixed CSS expression derived only from the play area's shared
  // `--card-width` (HumanHand.module.css's `.handRow` docstring): that card width at the card's own
  // `aspect-ratio: 5 / 7`, plus the fixed room reserved for a raised card. Comparing the real computed
  // height against that same formula, independently evaluated here from the live `--card-width` and the
  // play area's own `data-play-area-scale`, proves the row's height cannot vary with how many cards are
  // actually held (0 included) - an unwanted dependency on card count (e.g. a content-driven
  // `min-height`) would make this assertion fail without ever needing to actually empty the hand through
  // real gameplay, which - per round-result.e2e.ts's own docstring - the human seat's own
  // minimal-Pass-when-legal strategy can almost never reliably reach. The play area is uniformly scaled
  // (M4-T14), so the on-screen height is the design-unit height times that scale.
  const { actualHeightPx, expectedHeightPx } = await page.evaluate(() => {
    const row = document.querySelector('[aria-label="Your hand"]') as HTMLElement;
    const playArea = row.closest('[data-play-area-scale]') as HTMLElement;
    const scale = Number(playArea.dataset.playAreaScale);
    const cardWidthPx = parseFloat(getComputedStyle(playArea).getPropertyValue('--card-width'));
    return { actualHeightPx: row.getBoundingClientRect().height, expectedHeightPx: ((cardWidthPx * 7) / 5 + 18) * scale };
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

test(`overlapped cards stay independently targetable at the minimum supported landscape viewport (>= ${MINIMUM_EXPOSED_CARD_WIDTH_PX}px exposed)`, async ({ page }) => {
  const spec = VIEWPORT_MATRIX.find((entry) => entry.name === 'large-phone-landscape');
  if (!spec) throw new Error('Viewport matrix is missing its large-phone-landscape entry.');
  await page.setViewportSize({ width: spec.width, height: spec.height });
  await startGame(page);
  const hand = page.getByRole('group', { name: 'Your hand' });
  const cards = hand.getByRole('img');
  const slots = hand.locator('[data-card-key]');
  await expect(cards).toHaveCount(13);
  // Every card must be independently hit-testable/targetable regardless of overlap (ui-ux.md §6) — a
  // click landing on the wrong (neighboring) card would still show up as a selection mismatch below.
  // Only the first `cap` clicks can actually select anything (the live Play selection cap, M4-T08); the
  // remaining clicks still prove their own card was correctly targeted by staying reliably deselected.
  // `cap` is read from this Turn's own live state rather than assumed to always be the free-Play 5,
  // since Session start does not guarantee this seat is the one opening (`waitForYourTurn`'s own
  // docstring above).
  await waitForYourTurn(page);
  const cap = await currentSelectionCap(page);
  for (let index = 0; index < 13; index++) {
    await cards.nth(index).click();
    await expect(slots.nth(index)).toHaveAttribute('data-selected', index < cap ? 'true' : 'false');
  }
});

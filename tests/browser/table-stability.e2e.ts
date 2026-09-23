import { expect, test } from '@playwright/test';

// Regression for a reported UI bug: the table's own bordered box grew and shrank as bot hands were
// played down during a Round (most visibly West/East's card stack, which used to shrink from a 13-card
// stack down toward nothing) - reported as "the main table border also changes size...kinda trippy"
// (round-5 follow-up). Every seat's own reserved footprint (App.module.css's `.botHand`/`.panel`,
// PlayerPanel.module.css's `.panel`) is now sized for its own worst case and held constant, so the
// table's box should stay the same size before and after several Turns actually elapse.
test('the table\'s own bounding box does not resize as a Round is played (round-5 follow-up)', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  const table = page.getByRole('region', { name: 'Game Table' });
  await expect(table).toBeVisible();
  const initialBox = await table.boundingBox();
  if (!initialBox) throw new Error('Game Table region has no layout box.');

  // Let automatic bot Turns play out for a few seconds (the production ~0.8s-per-Turn pacing, ui-ux.md
  // §8); if a human Turn arrives, the table's own box is already expected to be stable by then, so no
  // further interaction is needed either way.
  await page.waitForTimeout(7200);

  const laterBox = await table.boundingBox();
  if (!laterBox) throw new Error('Game Table region has no layout box after play.');
  expect(Math.round(laterBox.width)).toBe(Math.round(initialBox.width));
  expect(Math.round(laterBox.height)).toBe(Math.round(initialBox.height));
});

// Follow-up question: "did the seat panel adjust size when glowing, or is it just an optical illusion?"
// PlayerPanel.module.css's glow classes (`.glowGold`/`.glowSilver`/`.glowBronze`/`.glowTurn`) only ever
// change `border-color` (the base `.panel` rule already reserves a constant 2px transparent border) and
// add a `box-shadow`, which paints outside the box without occupying layout space - neither should move
// the box's own dimensions. This applies that same border-color/box-shadow combination directly (rather
// than needing to actually reach a finish/Turn state in a live game, which the DONE/placement glow in
// particular could take a full Round to reach) and confirms the panel's own layout box is unaffected.
test('a seat panel does not resize when it gains its finish/turn glow', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  const panel = page.getByRole('region', { name: 'You panel' });
  await expect(panel).toBeVisible();
  const before = await panel.boundingBox();
  if (!before) throw new Error('Panel has no layout box.');

  await panel.evaluate((el) => {
    (el as HTMLElement).style.borderColor = '#ffd54a';
    (el as HTMLElement).style.boxShadow = '0 0 0 3px rgba(255, 213, 74, 0.6), 0 0 16px 4px rgba(255, 213, 74, 0.5)';
  });

  const after = await panel.boundingBox();
  if (!after) throw new Error('Panel has no layout box after applying the glow style.');
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});

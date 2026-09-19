import { expect, test } from '@playwright/test';
import { VIEWPORT_MATRIX } from './viewportMatrix';

// The visible heading at load depends on the viewport's own category (M4-T11; ui-ux.md §14): "supported"
// shows the ordinary Home screen, while the two unsupported categories now correctly show rotate/resize
// guidance instead - before M4-T11 implemented that guidance, every category rendered the same Home
// screen, which is what this per-category expectation replaces. This loop runs in the default
// (non-touch, fine-pointer) Playwright context - i.e. an ordinary desktop browser resized small - so
// the portrait-shaped entry's own expectation is resize guidance too (M4-T11 follow-up: a desktop
// monitor cannot be physically rotated); the touch-context rotate-guidance path has its own dedicated
// tests below.
const EXPECTED_HEADING: Record<(typeof VIEWPORT_MATRIX)[number]['category'], string> = {
  supported: 'Pusoy Dos',
  'unsupported-portrait': 'Resize your window to continue',
  'unsupported-undersized': 'Resize your window to continue',
};

for (const viewport of VIEWPORT_MATRIX) {
  test(`app loads without error at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const response = await page.goto('/');
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle('Pusoy Dos');
    await expect(page.getByRole('heading', { name: EXPECTED_HEADING[viewport.category], exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

// Pixel-level overlap/clipping verification across this matrix is M4-T14 (Full Responsive
// Hardening). This check only confirms the M4-T06 table hierarchy's core elements (all four
// seats and the Discard Pile button) are actually visible, not just present, at every viewport
// this milestone currently supports.
for (const viewport of VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported')) {
  test(`Game Table core elements are visible at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'You panel' })).toBeVisible();
    await expect(page.getByRole('region', { name: /^(West|North|East) panel$/ })).toHaveCount(3);
    for (const name of ['West', 'North', 'East']) {
      await expect(page.getByRole('region', { name: `${name} panel` })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Check Discard Pile', exact: true })).toBeVisible();
  });
}

// Regression for a reported UI bug: West/East bot hands previously overlapped horizontally and
// spilled past the table's left/right border at narrower supported viewports. Cards now stack
// lengthwise (vertically) on the outer edge with player details toward center (ui-ux.md §5), so
// this verifies the card stack's own layout box stays within the table's horizontal bounds.
for (const viewport of VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported')) {
  test(`West/East card stacks stay within the table border at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    // Known gap, not yet fixed (M4-T13 UI refinement follow-up, person's own decision 2026-09-19):
    // at this one viewport, West/East's own seat content (bot-hand column + gap + PlayerPanel's own
    // fixed 168px width, §5.7) needs 236px but the table's West/East grid columns only guarantee a
    // 96px floor (App.module.css's own `grid-template-columns`), so the seat overflows the table's
    // border by ~20px. The obvious fix (widening that floor to 236px) was tried and rejected - it
    // trades this for a worse regression, the table itself then overflowing the 667px viewport (a
    // horizontal scrollbar at a viewport ui-ux.md §14 lists as supported without one). A real fix
    // needs the proportional viewport-scaling logic §14 already calls for, which is M4-T14's own
    // scope ("Full Responsive Hardening") - tracked there, not fixed here, per the person's own
    // explicit instruction not to pull that work forward into this cleanup round.
    test.fixme(viewport.name === 'small-phone-landscape', 'Known gap tracked for M4-T14 - see comment above.');
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    const table = page.getByRole('region', { name: 'Game Table' });
    const tableBox = await table.boundingBox();
    if (!tableBox) throw new Error('Game Table region has no layout box.');
    for (const name of ['West', 'East']) {
      const seat = page.getByRole('region', { name: `${name} panel` }).locator('xpath=..');
      const botHand = seat.locator('> [aria-hidden="true"]').first();
      const box = await botHand.boundingBox();
      if (!box) throw new Error(`${name}'s bot hand has no layout box.`);
      expect(box.x).toBeGreaterThanOrEqual(tableBox.x - 1);
      expect(box.x + box.width).toBeLessThanOrEqual(tableBox.x + tableBox.width + 1);
    }
  });
}

// Rotate/resize guidance (M4-T11: Leave Confirmation and Unsupported-Layout Pause).
test(
  'undersized landscape viewport shows resize guidance instead of gameplay (M4-T11)',
  async ({ page }) => {
    const spec = VIEWPORT_MATRIX.find((entry) => entry.category === 'unsupported-undersized');
    if (!spec) throw new Error('Viewport matrix is missing its undersized-landscape entry.');
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.goto('/');
    await expect(page.getByText(/resize/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).not.toBeVisible();
  },
);

// A portrait-shaped viewport in the default (non-touch, fine-pointer) context - an ordinary desktop
// browser window resized small - gets the same resize guidance rather than an impossible "rotate your
// device" instruction, since nobody can physically rotate a desktop monitor (M4-T11 follow-up).
test(
  'a portrait-shaped desktop browser window shows resize guidance, not rotate, since it cannot be physically rotated (M4-T11 follow-up)',
  async ({ page }) => {
    const spec = VIEWPORT_MATRIX.find((entry) => entry.category === 'unsupported-portrait');
    if (!spec) throw new Error('Viewport matrix is missing its portrait-unsupported entry.');
    await page.setViewportSize({ width: spec.width, height: spec.height });
    await page.goto('/');
    await expect(page.getByText('Resize your window to continue')).toBeVisible();
    await expect(page.getByText('Rotate your device to continue')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Start Game' })).not.toBeVisible();
  },
);

// The rotate-guidance path only applies to a touch/coarse-pointer context - an actual phone or tablet,
// the only kind of device someone can physically rotate (M4-T11 follow-up). `hasTouch: true` is what
// flips the CSS `pointer: coarse` media feature Chromium reports, mirroring a real touch device.
test.describe('touch-capable (phone/tablet) context', () => {
  test.use({ hasTouch: true });

  test(
    'portrait viewport shows rotate guidance instead of gameplay (M4-T11)',
    async ({ page }) => {
      const spec = VIEWPORT_MATRIX.find((entry) => entry.category === 'unsupported-portrait');
      if (!spec) throw new Error('Viewport matrix is missing its portrait-unsupported entry.');
      await page.setViewportSize({ width: spec.width, height: spec.height });
      await page.goto('/');
      await expect(page.getByText('Rotate your device to continue')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Game' })).not.toBeVisible();
    },
  );

  // Returning to a supported viewport mid-Session restores the same Session rather than losing it
  // (M4-T11; ui-ux.md §14: "returning to landscape restores coherent state").
  test(
    'returning from a portrait viewport to a supported one resumes the same live Session',
    async ({ page }) => {
      const supported = VIEWPORT_MATRIX.find((entry) => entry.name === 'large-phone-landscape');
      const portrait = VIEWPORT_MATRIX.find((entry) => entry.category === 'unsupported-portrait');
      if (!supported || !portrait) throw new Error('Viewport matrix is missing a required entry.');
      await page.setViewportSize({ width: supported.width, height: supported.height });
      await page.goto('/');
      await page.getByRole('button', { name: 'Start Game', exact: true }).click();
      await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
      await expect(page.getByText('Basic · Round 1 of 5')).toBeVisible();

      await page.setViewportSize({ width: portrait.width, height: portrait.height });
      await expect(page.getByText('Rotate your device to continue')).toBeVisible();
      await expect(page.getByRole('region', { name: 'Game Table' })).not.toBeVisible();

      await page.setViewportSize({ width: supported.width, height: supported.height });
      await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
      await expect(page.getByText('Basic · Round 1 of 5')).toBeVisible();
    },
  );
});

// Leave Game confirmation (M4-T11; ui-ux.md §10): cancelling keeps the Session, confirming returns to
// Home. A real browser round-trip through the actual Close(×)/Escape-equivalent Stay button and the
// destructive Leave button, complementing the faster Vitest/RTL coverage in SessionTable.test.tsx.
test('Leave Game: Stay keeps the Session, Yes/Leave Game returns to Home', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();

  await page.getByRole('button', { name: 'Leave Game', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Leave Game' })).toBeVisible();
  await page.getByRole('button', { name: 'Stay', exact: true }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();

  await page.getByRole('button', { name: 'Leave Game', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, Leave Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
});

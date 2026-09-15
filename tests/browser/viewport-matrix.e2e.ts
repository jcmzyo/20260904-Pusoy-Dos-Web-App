import { expect, test } from '@playwright/test';
import { VIEWPORT_MATRIX } from './viewportMatrix';

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
    await expect(page.getByRole('heading', { name: 'Pusoy Dos', exact: true })).toBeVisible();
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
    await expect(page.getByRole('button', { name: 'Discard Pile', exact: true })).toBeVisible();
  });
}

// Rotate/resize guidance does not exist yet; M4-T11 (Leave Confirmation and
// Unsupported-Layout Pause) implements it. These assertions are registered now,
// as fixme, so the M4-T04 responsive contract records the required behavior
// and the pending checks are not silently forgotten once the guidance UI exists.
test.fixme(
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

test.fixme(
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

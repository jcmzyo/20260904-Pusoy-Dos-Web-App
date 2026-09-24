import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Whichever seat holds the 3♣ a Round opens with (and what it leads with) is not something a browser
 * test can assume - the production RNG these files drive has no seed hook, by design
 * (round-result.e2e.ts's own comment). So a test that needs to select more than one held card waits for
 * a Turn whose live Play selection cap (App.tsx's own `maxSelectableCards`, mirrored here from the
 * rendered center state) is actually large enough, Passing through any Turn that falls short - Pass is
 * always legal while responding. Bounded the same way round-result.e2e.ts's own `driveRoundToResult` is,
 * so a genuine regression fails with a diagnostic instead of hanging.
 *
 * Shared by human-hand.e2e.ts and responsive-hardening.e2e.ts, the two files whose own selection-cap
 * assumptions this fixes (M4-T14.5 flaky-test follow-up).
 */
const SELECTION_TURN_BUDGET = 40;

export async function waitForYourTurn(page: Page) {
  await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true', { timeout: 20_000 });
}

export async function currentSelectionCap(page: Page): Promise<number> {
  const count = await page.locator('[aria-label="Current hand to beat"] [role="img"]').count();
  return count > 0 ? count : 5;
}

export async function waitForSelectableTurn(page: Page, minCap: number): Promise<number> {
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

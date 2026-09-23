import { expect, test } from '@playwright/test';

/**
 * Real-browser coverage for M4-T12 (ui-ux.md §11-§12): the specific concerns Vitest/RTL's jsdom
 * environment cannot meaningfully verify - real CSS (`filter`/`pointer-events`) actually rendered on the
 * dimmed completed table, and a real pointer click on the reveal's own full-screen skip control not also
 * reaching whatever sits beneath it. Game-state-level coverage (rank-sorted reveal cards, authoritative
 * scores, tie-stable/settle reorder sequence, R1-R4 vs R5 continuation wording) is already exhaustively
 * covered deterministically, via a seeded Engine RNG, by
 * `tests/integration/ui/session-table-round-result.test.tsx` - that determinism is only available
 * in-process; the production entry point this file drives (`npm run dev`) otherwise has no seed hook by
 * design (M4-T01: no speculative configuration surface beyond Basic/four players). `E2E_SEED` below
 * (M4-P1 review finding: the deterministic browser acceptance suite was missing) opts into main.tsx's own
 * dev-server-only `?e2eSeed=` hook instead - a genuinely random deal was otherwise never reproducible, and
 * the reveal-then-skip path below could only ever be exercised opportunistically.
 *
 * `driveRoundToResult` below always Passes while responding (canonically legal regardless of held cards)
 * and leads the single lowest-value legal card only when forced to open/free-lead. Under `E2E_SEED`, this
 * exact strategy is known (scripts/find-e2e-seed.mjs) to make West - a bot - finish 4th in Round 1, so the
 * reveal (`isRevealing`, shown only for a *bot's* 4th-place hand, App.tsx) and its own "Skip reveal"
 * control are unconditionally exercised below, rather than only when an unseeded deal happened to produce
 * a bot's own 4th-place finish.
 *
 * Also drives a genuine second Round to completion after the first "Next Round" click (see the bottom
 * of the single test below) - regression coverage for a real reported bug where nothing ever advanced
 * again past Round 1 in the actual browser. The same seed's own second deal (verified by the same
 * simulation script) reaches its own Round Result well inside `TURN_BUDGET` too, with South itself
 * finishing 4th there - no reveal is asserted for that second Round, only that it completes.
 */

// Reproducible deal (M4-P1 review finding) - main.tsx's dev-server-only `?e2eSeed=` hook, verified via
// scripts/find-e2e-seed.mjs to make a bot finish 4th in Round 1 under this file's own human strategy.
const E2E_SEED = 8;

const TURN_BUDGET = 300;

/**
 * A single atomic in-browser read of every fact `driveRoundToResult` decides on, so that fact and the
 * decision made from it can never straddle two separate Playwright round-trips (each a genuine
 * yield back to the browser's own event loop, across which the SPA keeps running). Reading
 * "is it still my Turn" and "is Pass enabled" as two separate locator calls let a real, correctly-
 * ordered gap between them - the deliberate macrotask boundary `GameRunner.commitWhenSubmissionAllowed`
 * now crosses on every Turn (M4-P1 review finding, escalated) - land between the two, so the first read
 * could observe this seat's own Turn while the second, a moment later, already reflected a different one.
 * Bundling both into one `page.waitForFunction` predicate removes that window entirely: whichever Turn is
 * live when the predicate finally returns is the exact one every field below describes.
 */
type TurnDecision =
  | { readonly kind: 'dialog' }
  | { readonly kind: 'skipReveal' }
  | { readonly kind: 'pass' }
  | { readonly kind: 'lead'; readonly opening: boolean };

async function waitForTurnDecision(page: import('@playwright/test').Page): Promise<TurnDecision> {
  const handle = await page.waitForFunction(
    () => {
      if (document.querySelector('[role="dialog"]') !== null) return { kind: 'dialog' };
      if (document.querySelector('[aria-label="Skip reveal"]') !== null) return { kind: 'skipReveal' };
      const panel = document.querySelector('[aria-label="You panel"]');
      if (panel?.getAttribute('aria-current') !== 'true') return null;
      const passButton = document.querySelector('button[aria-label="Pass"]') as HTMLButtonElement | null;
      if (passButton !== null && !passButton.disabled) return { kind: 'pass' };
      const opening = document.querySelector('[aria-label="Current hand to beat"] p')?.textContent?.includes('OPENING') ?? false;
      return { kind: 'lead', opening };
    },
    { timeout: 20_000 },
  );
  return handle.jsonValue() as Promise<TurnDecision>;
}

/**
 * Blocks until this seat's own just-submitted Move has actually left it (`GameRunner.submitResponse`
 * committed and `SessionPresentation` published the result) - the Round ending or another Turn genuinely
 * starting elsewhere. A `click()` resolving is only the browser dispatching the click event; the resulting
 * Engine commit runs on the far side of `GameRunner.commitWhenSubmissionAllowed`'s own deliberate macrotask
 * boundary (M4-P1 review finding, escalated), so without this wait the very next `waitForTurnDecision` call
 * below could poll before that commit lands and re-observe this exact same, already-acted-on Turn - the
 * Engine never lets this same seat's own Turn immediately recur (at least one other seat's own Turn always
 * comes between two of this seat's own), so waiting for the "no longer my Turn" edge is always safe here.
 */
async function waitForTurnToRelease(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const panel = document.querySelector('[aria-label="You panel"]');
      const isYourTurn = panel?.getAttribute('aria-current') === 'true';
      const dialogOpen = document.querySelector('[role="dialog"]') !== null;
      return !isYourTurn || dialogOpen;
    },
    { timeout: 20_000 },
  );
}

/** Drives the human seat through an entire Round with the minimal legal strategy described above,
 *  stopping as soon as the Round Result overlay is open (`revealSkipped: true` if a bot's own 4th-place
 *  reveal appeared and was skipped along the way to get there). */
async function driveRoundToResult(page: import('@playwright/test').Page): Promise<{ revealSkipped: boolean }> {
  const passButton = page.getByRole('button', { name: 'Pass', exact: true });
  const playButton = page.getByRole('button', { name: 'Play', exact: true });
  const dialog = page.getByRole('dialog');
  const skipReveal = page.getByRole('button', { name: 'Skip reveal', exact: true });
  const hand = page.getByRole('group', { name: 'Your hand' });

  for (let turn = 0; turn < TURN_BUDGET; turn++) {
    const decision = await waitForTurnDecision(page);

    if (decision.kind === 'dialog') return { revealSkipped: false };
    if (decision.kind === 'skipReveal') {
      await skipReveal.click();
      await expect(dialog).toBeVisible();
      return { revealSkipped: true };
    }

    if (decision.kind === 'pass') {
      await passButton.click();
    } else {
      // Forced to lead (opening or free lead): a single card is always a structurally legal Play, and
      // during the opening specifically it is human's Turn at all only because the deal gave this seat
      // the 3♣ (the Engine's own opening-Turn invariant), so that single card always satisfies "must
      // include 3♣" too.
      if (decision.opening) {
        await hand.getByRole('img', { name: '3 of Clubs', exact: true }).click();
      } else {
        await hand.getByRole('img').first().click();
      }
      await expect(playButton).toBeEnabled();
      await playButton.click();
    }
    await waitForTurnToRelease(page);
  }
  throw new Error(`Round did not reach its Result overlay within ${TURN_BUDGET} human decisions.`);
}

test('the Round Result overlay is a real, non-dismissible dialog over a genuinely dimmed and inert completed table (M4-T12; ui-ux.md §12)', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(`/?e2eSeed=${E2E_SEED}`);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();

  const roundLabel = page.getByText(/^Basic · Round \d of 5$/);
  const roundTextBeforeResult = await roundLabel.textContent();
  const { revealSkipped } = await driveRoundToResult(page);

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-label', /^Round \d Result$/);

  // Unconditional under E2E_SEED (M4-P1 review finding): this deal is known to make West finish 4th in
  // Round 1, so the reveal-then-skip path is always exercised here, not merely opportunistically.
  expect(revealSkipped, 'Round 1 must reach the Round Result overlay via a bot\'s own 4th-place reveal under this deterministic deal.').toBe(true);
  // A skip must have reached only the Round Result overlay - never also invoking "Next Round"/"View
  // Session Results" underneath it in the very same click (ui-ux.md §11: "the same input must not
  // accidentally activate the next result action"). The Round number is still the pre-result one; only
  // the explicit continuation button (exercised below) is ever allowed to advance it.
  await expect(roundLabel).toHaveText(roundTextBeforeResult ?? '');

  // Real CSS actually computed on the table beneath the overlay - `pointer-events: none` and the
  // brightness/saturate dimming (App.module.css's `.tableDimmed`) are both real-rendering concerns a
  // jsdom-based RTL test cannot meaningfully assert (App.tsx/App.module.css, M4-T12).
  const tableRegion = page.getByRole('region', { name: 'Game Table' });
  const dimmedWrapper = tableRegion.locator('xpath=..');
  await expect(dimmedWrapper).toHaveCSS('pointer-events', 'none');
  await expect(dimmedWrapper).not.toHaveCSS('filter', 'none');

  // A real pointer click at the Pass button's own on-screen position, forced past Playwright's own
  // actionability guard (which would otherwise itself refuse the click as non-interactable) - proves the
  // dimmed table is truly inert to a genuine click, not merely visually implied. Pass is only ever
  // rendered enabled while responding; forcing the click through and finding the dialog and Round number
  // both unchanged either way (whether or not Pass happened to be enabled at this exact instant) shows
  // the click never reached a live control.
  const passButton = page.getByRole('button', { name: 'Pass', exact: true });
  await passButton.click({ force: true }).catch(() => {});
  await expect(dialog).toBeVisible();

  // Escape/backdrop click never dismisses this overlay (RoundResultOverlay's own non-dismissible
  // contract) - only ever skips its own scoring animation to the settled state.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();

  const continueButton = page.getByRole('button', { name: /^(Next Round|View Session Results)$/ });
  await expect(continueButton).toBeVisible({ timeout: 10_000 });
  const isFinalRound = (await continueButton.textContent())?.includes('View Session Results') ?? false;
  await continueButton.click();
  await expect(dialog).not.toBeVisible();

  if (!isFinalRound) {
    // Explicit continuation actually continued (not merely closed the dialog): the Round number
    // advanced, and the table's own dimming/inertness lifted.
    await expect(roundLabel).not.toHaveText(roundTextBeforeResult ?? '');
    await expect(dimmedWrapper).not.toHaveCSS('pointer-events', 'none');

    // Regression coverage for the reported bug: a bot holding 3♣ at the start of Round 2 got stuck
    // indefinitely (SessionPresentation's background driveTurns loop exited for good the instant Round 1
    // ended and nothing ever restarted it once "Next Round" started a new one). Driving all the way
    // through a second Round here, in a real browser, over the exact same "Next Round" transition the
    // person actually hit, is the strongest available proof this stays fixed - a jsdom/RTL test cannot
    // hang the way the real reported symptom did (a bot's Turn spinner frozen forever).
    await driveRoundToResult(page);
    await expect(dialog).toBeVisible();
  }
});

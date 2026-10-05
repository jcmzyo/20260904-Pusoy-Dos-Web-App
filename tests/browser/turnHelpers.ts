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

/**
 * Blocks until this seat's own just-submitted Move has actually left it - the Round ending or another
 * Turn genuinely starting elsewhere. A `click()` resolving is only the browser dispatching the click
 * event; the resulting Engine commit runs on the far side of `GameRunner.commitWhenSubmissionAllowed`'s
 * own deliberate macrotask boundary (M4-P1 review finding, escalated - a real `MessageChannel` round-trip,
 * not gated by this test's own fake clock), so without this wait the loop's very next atomic `evaluate()`
 * below could run before that commit lands and re-observe this exact same, already-acted-on Turn - the
 * Engine never lets this same seat's own Turn immediately recur, so waiting for the "no longer my Turn"
 * edge is always safe here.
 */
async function waitForTurnToRelease(page: Page): Promise<void> {
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

/**
 * Drives the human seat through Rounds with the same minimal legal strategy round-result.e2e.ts uses
 * (always Pass while responding; lead the first card only when forced to), but under Playwright's fake
 * clock so the bots' 800ms presentation pauses, the reveal, and the scoring stages are fast-forwarded
 * instead of waited out in real time - this is what makes reaching Round Result *and* a five-Round
 * Session Summary affordable across the whole matrix. Stops at the current Round's settled Result
 * (`'roundResult'`), or after clicking through every "Next Round" until Session Summary is showing
 * (`'sessionSummary'`).
 */
/** A point inside every card's always-exposed left strip (narrowest exposure is 24px, ui-ux.md §19.6). */
const EXPOSED_CARD_STRIP = { x: 8, y: 24 };

export async function driveUnderFakeClock(page: Page, until: 'roundResult' | 'sessionSummary') {
  const passButton = page.getByRole('button', { name: 'Pass', exact: true });
  const playButton = page.getByRole('button', { name: 'Play', exact: true });
  const nextRound = page.getByRole('button', { name: 'Next Round', exact: true });
  const hand = page.getByRole('listbox', { name: 'Your hand' });

  for (let step = 0; step < 4000; step++) {
    // Every fact this loop decides on, including whether Pass is enabled and whether this is an
    // Opening lead, is read together in this one atomic evaluate (M4-P1 review finding, escalated) -
    // `GameRunner.commitWhenSubmissionAllowed` now deliberately crosses a macrotask boundary on every
    // Turn, so a `yourTurn` read and a separate, later `passButton.isEnabled()` read could otherwise
    // straddle two different Turns instead of describing the same live one.
    const state = await page.evaluate(() => {
      const passButtonEl = document.querySelector('button[aria-label="Pass"]') as HTMLButtonElement | null;
      return {
        yourTurn: document.querySelector('[aria-label="You panel"]')?.getAttribute('aria-current') === 'true',
        summary: document.querySelector('[aria-label="Session Summary"]') !== null,
        dialog: document.querySelector('[role="dialog"]') !== null,
        nextRound: [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Next Round'),
        skipReveal: document.querySelector('[aria-label="Skip reveal"]') !== null,
        transition: document.querySelector('[aria-label^="Starting Round"]') !== null,
        passEnabled: passButtonEl !== null && passButtonEl.getAttribute('aria-disabled') !== 'true',
        opening: document.querySelector('[aria-label="Current hand to beat"] p')?.textContent?.includes('OPENING') ?? false,
      };
    });

    if (state.summary) {
      // Let the settling Round 5 -> Summary hand-off and the Summary's own layout finish.
      await page.clock.runFor(1000);
      return;
    }
    if (state.nextRound) {
      if (until === 'roundResult') return;
      await nextRound.click();
      continue;
    }
    if (state.skipReveal) {
      await page.getByRole('button', { name: 'Skip reveal', exact: true }).click();
      continue;
    }
    if (state.dialog || state.transition || !state.yourTurn) {
      await page.clock.runFor(state.dialog || state.transition ? 700 : 800);
      continue;
    }
    if (state.passEnabled) {
      await passButton.click();
    } else {
      // Each card is overlapped only by the next card on its right, so its left edge strip is always the
      // exposed, targetable part - its center can sit under a neighbor in the tighter portrait overlap.
      const card = state.opening ? hand.getByRole('img', { name: '3 of Clubs', exact: true }) : hand.getByRole('img').first();
      await card.click({ position: EXPOSED_CARD_STRIP });
      await playButton.click();
    }
    await waitForTurnToRelease(page);
  }
  throw new Error(`Session did not reach ${until} within the step budget.`);
}

import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import { findViewport } from './viewportMatrix';
import type { ViewportSpec } from './viewportMatrix';
import { driveUnderFakeClock } from './turnHelpers';

/**
 * M5-T08 deterministic browser smoke: one complete five-Round Basic Session through the production entry
 * point on each approved composition class - supported portrait phone and portrait tablet (touch), plus
 * the retained landscape regression path. Each Session rotates to the matching landscape size for Round 3
 * and back while Round 3's Result is open, then ends at Session Summary and leaves through Play Again or
 * Home. Rules, legality and scores stay production-owned: the human only ever Passes or leads a single
 * card (`driveUnderFakeClock`), and the assertions read Round progression and the rendered Summary rather
 * than re-deriving any result. This does not replace the required human five-Round acceptance.
 *
 * `E2E_SEED` is main.tsx's dev-server-only `?e2eSeed=` hook, the seed scripts/find-e2e-seed.mjs verified
 * to complete a full five-Round Session under this strategy (responsive-hardening.e2e.ts uses it too).
 */
const E2E_SEED = 8;

const ROUND_COUNT = 5;
const ROTATED_ROUND = 3;

interface SessionPath {
  readonly name: string;
  readonly home: ViewportSpec;
  readonly rotated: ViewportSpec;
  readonly touch: boolean;
  readonly exit: 'Play Again' | 'Home';
}

const PATHS: readonly SessionPath[] = [
  { name: 'portrait phone', home: findViewport('portrait-phone-390'), rotated: findViewport('large-phone-landscape'), touch: true, exit: 'Play Again' },
  { name: 'portrait tablet', home: findViewport('portrait-tablet-768'), rotated: findViewport('tablet-landscape'), touch: true, exit: 'Home' },
  { name: 'landscape regression', home: findViewport('laptop'), rotated: findViewport('portrait-tablet-768'), touch: false, exit: 'Play Again' },
];

async function resizeTo(page: Page, spec: ViewportSpec) {
  await page.setViewportSize({ width: spec.width, height: spec.height });
}

async function press(locator: Locator, touch: boolean) {
  if (touch) await locator.tap();
  else await locator.click();
}

async function expectTableAt(page: Page, round: number) {
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.getByText(`Basic · Round ${round} of ${ROUND_COUNT}`, { exact: true })).toBeVisible();
}

function sessionTest(path: SessionPath) {
  test.describe(`${path.name} (${path.home.width}x${path.home.height})`, () => {
    test.use(path.touch ? { hasTouch: true, isMobile: true } : {});

    test(`completes a five-Round Session with a mid-Session orientation change, then ${path.exit}`, async ({ page }) => {
      test.setTimeout(240_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(message.text());
      });

      await page.clock.install();
      await resizeTo(page, path.home);
      await page.goto(`/?e2eSeed=${E2E_SEED}`);
      await press(page.getByRole('button', { name: 'Start Game', exact: true }), path.touch);
      await expectTableAt(page, 1);

      for (let round = 1; round < ROUND_COUNT; round++) {
        await driveUnderFakeClock(page, 'roundResult');
        const result = page.getByRole('dialog', { name: `Round ${round} Result`, exact: true });
        await expect(result).toBeVisible();
        // The table under the overlay still names the Round just completed: only Next Round advances it.
        await expect(page.getByText(`Basic · Round ${round} of ${ROUND_COUNT}`, { exact: true })).toBeAttached();

        if (round === ROTATED_ROUND) {
          // Round 3 was played in the rotated composition; rotating back keeps the same open Result.
          await resizeTo(page, path.home);
          await expect(result).toBeVisible();
        }
        await press(result.getByRole('button', { name: 'Next Round', exact: true }), path.touch);
        if (round + 1 === ROTATED_ROUND) await resizeTo(page, path.rotated);
      }

      await driveUnderFakeClock(page, 'sessionSummary');
      const summary = page.getByRole('dialog', { name: 'Session Summary', exact: true });
      await expect(summary).toBeVisible();
      // Round 5 hands off to Summary automatically - no continuation action is offered after it.
      await expect(page.getByRole('button', { name: /^(Next Round|View Session Results)$/ })).toHaveCount(0);

      const ranking = summary.getByRole('table', { name: 'Final Ranking' });
      await expect(ranking.locator('tbody tr')).toHaveCount(4);
      await expect(ranking.locator('tbody tr').filter({ hasText: 'You' })).toHaveCount(1);
      const rounds = summary.getByRole('table', { name: 'Round-by-Round Summary' });
      await expect(rounds.getByRole('columnheader')).toHaveText(['Player', 'R1', 'R2', 'R3', 'R4', 'R5', 'Total']);
      await expect(rounds.locator('tbody tr')).toHaveCount(4);
      // Presentation consistency only (not a scoring re-derivation): each row's Total is the sum of the
      // five Round cells it renders, and both tables report the same Total for each player.
      const rows = await rounds.locator('tbody tr').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '')));
      const rankingTotals = await ranking.locator('tbody tr').evaluateAll((trs) => Object.fromEntries(trs.map((tr) => {
        const cells = [...tr.querySelectorAll('td')].map((td) => td.textContent ?? '');
        return [cells[1], cells[2]];
      })));
      for (const [player, ...cells] of rows) {
        const points = cells.slice(0, ROUND_COUNT).map(Number);
        expect(points.every(Number.isInteger), `${player} Round cells are whole numbers`).toBe(true);
        expect(points.reduce((sum, value) => sum + value, 0), `${player} Total`).toBe(Number(cells[ROUND_COUNT]));
        expect(rankingTotals[player ?? ''], `${player} Final Ranking Total`).toBe(cells[ROUND_COUNT]);
      }

      await press(summary.getByRole('button', { name: path.exit, exact: true }), path.touch);
      await page.clock.runFor(2_000);
      await expect(summary).toHaveCount(0);
      if (path.exit === 'Play Again') {
        // A fresh Session, not a continuation: Round 1 again with every score reset.
        await expectTableAt(page, 1);
        // Matched on the score paragraph itself ("13 cards · 0 pts", or "0 pts" alone in phone portrait):
        // a panel's whole text runs straight into its Play trail's card labels.
        await expect(page.getByRole('region', { name: /^(You|West|North|East) panel$/ }).filter({ has: page.getByText(/(?:^|· )0 pts$/) })).toHaveCount(4);
      } else {
        await expect(page.getByRole('button', { name: 'Start Game', exact: true })).toBeVisible();
        await expect(page.getByRole('region', { name: 'Game Table' })).toHaveCount(0);
      }
      expect(errors).toEqual([]);
    });
  });
}

for (const path of PATHS) sessionTest(path);

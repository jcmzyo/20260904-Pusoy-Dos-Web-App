import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  FULL_SCALE_LANDSCAPE_HEIGHT_PX,
  FULL_SCALE_LANDSCAPE_WIDTH_PX,
  MINIMUM_EXPOSED_CARD_WIDTH_PX,
  MINIMUM_READABLE_TEXT_SIZE_PX,
  MINIMUM_TOUCH_TARGET_SIZE_PX,
  VIEWPORT_MATRIX,
} from './viewportMatrix';
import { currentSelectionCap, waitForSelectableTurn, waitForYourTurn } from './turnHelpers';

/**
 * Real-browser coverage for M4-T14 (Full Responsive Hardening; ui-ux.md §14): the frozen T04 viewport
 * matrix's own supported entries, checked for the properties only a real layout engine can prove - the
 * whole play area fits the viewport with no scrollbar, core controls stay visible and actually hit-testable,
 * nothing critical overlaps or clips, every card keeps its 5:7 ratio, the overlapped 13-card hand stays
 * independently targetable, dragging still follows the pointer under the scaled play area, and the
 * overlays (including Round Result and Session Summary) stay usable. Portrait/undersized guidance's own
 * content is already covered by `viewport-matrix.e2e.ts`; the last group here only adds that it too fits
 * its viewport. Vitest/RTL (jsdom has no layout) covers the scale arithmetic itself.
 *
 * Two tiers (M4-T14 decision): the frozen minimum readable text size (14px) and touch target (44px) are
 * asserted literally, on rendered sizes, wherever the play area renders at scale 1 or larger
 * (`FULL_SCALE_LANDSCAPE_*`: the play area's own design size, and up). The phone tier below that, down to
 * the minimum supported viewport, scales the play area down to fit, so those two constants are
 * deliberately exempt there; the exposed-card width (28px) and everything else here still apply to it.
 */

interface Size {
  readonly name: string;
  readonly width: number;
  readonly height: number;
}

const SUPPORTED_VIEWPORTS: readonly Size[] = VIEWPORT_MATRIX.filter((entry) => entry.category === 'supported');
const UNSUPPORTED_VIEWPORTS: readonly Size[] = VIEWPORT_MATRIX.filter((entry) => entry.category !== 'supported');

// Reproducible deal (M4-P1 review finding: the required deterministic browser acceptance suite was
// missing) for the one test below that must reliably drive a full five-Round Session to Session Summary -
// verified by scripts/find-e2e-seed.mjs to complete cleanly under `driveUnderFakeClock`'s own minimal
// strategy well inside its step budget, so a failure there is reproducible rather than deal-dependent.
const FIVE_ROUND_E2E_SEED = 8;

// Sizes beyond the frozen matrix that stress the two ways the play area's own fit can be tight: a short
// viewport (a real mobile browser's own chrome leaves less usable height than an emulated preset assumes,
// ui-ux.md §14) and a width-bound one (narrow for its height).
const TIGHT_VIEWPORTS: readonly Size[] = [
  { name: 'minimum-height-ultrawide', width: 1920, height: VIEWPORT_MATRIX.find((entry) => entry.name === 'large-phone-landscape')!.height },
  { name: 'width-bound-landscape', width: 850, height: 700 },
];

// Exactly where the play area first renders at scale 1, plus every supported matrix entry at least that big.
const FULL_SCALE_BOUNDARY: Size = { name: 'full-scale-boundary', width: FULL_SCALE_LANDSCAPE_WIDTH_PX, height: FULL_SCALE_LANDSCAPE_HEIGHT_PX };
const isFullScale = (viewport: Size) => viewport.width >= FULL_SCALE_LANDSCAPE_WIDTH_PX && viewport.height >= FULL_SCALE_LANDSCAPE_HEIGHT_PX;
const FULL_SCALE_VIEWPORTS: readonly Size[] = [...SUPPORTED_VIEWPORTS.filter(isFullScale), FULL_SCALE_BOUNDARY];

/** `seed` opts into `main.tsx`'s own dev-server-only `?e2eSeed=` hook (M4-P1 review finding: the
 *  deterministic browser acceptance suite was missing) - used only by the test below that must reliably
 *  reach a five-Round Session Summary, so a failure there is reproducible rather than deal-dependent.
 *  Every other call here is layout-only and stays on a genuinely random deal. */
async function startGameAt(page: Page, viewport: Size, seed?: number) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.goto(seed === undefined ? '/' : `/?e2eSeed=${seed}`);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  // The Round-start transition screen covers the whole table (and every control on it) for a moment
  // after Start Game; layout/hit-testing checks only mean anything once it is gone.
  await expect(page.getByRole('button', { name: /^Starting Round/ })).not.toBeVisible();
}

interface TargetProbe {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly viewportWidth: number;
  readonly viewportHeight: number;
  readonly isTopmostAtCenter: boolean;
}

/** Bounding box plus whether the element (or a descendant) is what a real pointer would actually hit at
 *  its own center - the difference between a control that is merely present and one that is targetable. */
async function probeTarget(locator: Locator): Promise<TargetProbe> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      isTopmostAtCenter: topmost !== null && (topmost === element || element.contains(topmost)),
    };
  });
}

function expectWithinViewport(probe: TargetProbe, description: string) {
  expect(probe.left, `${description}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(probe.top, `${description}: top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(probe.right, `${description}: right edge`).toBeLessThanOrEqual(probe.viewportWidth + 0.5);
  expect(probe.bottom, `${description}: bottom edge`).toBeLessThanOrEqual(probe.viewportHeight + 0.5);
}

async function expectTargetable(locator: Locator, description: string) {
  await expect(locator, `${description} is visible`).toBeVisible();
  const probe = await probeTarget(locator);
  expectWithinViewport(probe, description);
  expect(probe.isTopmostAtCenter, `${description} is not what a pointer hits at its own center`).toBe(true);
}

async function expectPlayAreaFits(page: Page) {
  const fit = await page.evaluate(() => {
    const root = document.documentElement;
    const playArea = document.querySelector('[data-play-area-scale]');
    if (!playArea) throw new Error('Play area is missing.');
    const table = document.querySelector('[aria-label="Game Table"]');
    if (!table) throw new Error('Game Table is missing.');
    const playAreaRect = playArea.getBoundingClientRect();
    const tableRect = table.getBoundingClientRect();
    const describe = (element: Element) => `${element.tagName.toLowerCase()}[${element.getAttribute('aria-label') ?? element.textContent?.slice(0, 20) ?? ''}]`;
    const escapes = (container: Element, containerRect: DOMRect) => {
      const found: string[] = [];
      for (const element of container.querySelectorAll('*')) {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        if (
          rect.left < containerRect.left - 1 || rect.top < containerRect.top - 1 ||
          rect.right > containerRect.right + 1 || rect.bottom > containerRect.bottom + 1
        ) {
          found.push(describe(element));
        }
      }
      return found;
    };
    const escaping = escapes(playArea, playAreaRect);
    const escapingTable = escapes(table, tableRect);
    return {
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth,
      scrollHeight: root.scrollHeight,
      clientHeight: root.clientHeight,
      left: playAreaRect.left,
      top: playAreaRect.top,
      right: playAreaRect.right,
      bottom: playAreaRect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      escaping,
      escapingTable,
    };
  });
  expect(fit.scrollWidth, 'page scrolls horizontally').toBeLessThanOrEqual(fit.clientWidth);
  expect(fit.scrollHeight, 'page scrolls vertically').toBeLessThanOrEqual(fit.clientHeight);
  expect(fit.left, 'play area left edge').toBeGreaterThanOrEqual(-0.5);
  expect(fit.top, 'play area top edge').toBeGreaterThanOrEqual(-0.5);
  expect(fit.right, 'play area right edge').toBeLessThanOrEqual(fit.viewportWidth + 0.5);
  expect(fit.bottom, 'play area bottom edge').toBeLessThanOrEqual(fit.viewportHeight + 0.5);
  // The authored content must really fit inside the play area, whose smallest size is the design size the
  // scale is computed from (playAreaScale.ts): anything escaping it would be clipped or overflow.
  expect(fit.escaping, 'elements extending past the play area').toEqual([]);
  // ...and the table's own seats/center must fit inside the table's border (its flex box shrinks rather
  // than growing, so an undersized canvas would show up here as content spilling over the table edge).
  expect(fit.escapingTable, 'elements extending past the Game Table\'s own border').toEqual([]);
}

/** Rendered text below `MINIMUM_READABLE_TEXT_SIZE_PX` and buttons/links/inputs below
 *  `MINIMUM_TOUCH_TARGET_SIZE_PX` in either dimension, over everything currently visible. Text sizes are
 *  computed sizes times the play area's own scale (a transform does not change `font-size`); controls are
 *  measured rendered. Full-viewport skip layers are not controls in this sense. */
async function collectSizingViolations(page: Page): Promise<string[]> {
  return page.evaluate(({ minText, minTarget }) => {
    const found = new Set<string>();
    const scaleOf = (element: Element) => {
      const area = element.closest<HTMLElement>('[data-play-area-scale]');
      return area ? Number(area.dataset.playAreaScale) : 1;
    };
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      const element = walker.currentNode.parentElement;
      if (!text || !element || element.getClientRects().length === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden') continue;
      // Known exemption (m4 task doc, M4-T14): a bot's face-up 4th-place reveal fan is overlapped 40 design px
      // wide slivers, not reading text. It is on the table only when that bot still holds cards, so without
      // this the audit would depend on how the random Round happened to end.
      const card = element.closest('[role="img"]');
      if (card instanceof HTMLElement && card.offsetWidth === 40) continue;
      const rendered = parseFloat(style.fontSize) * scaleOf(element);
      if (rendered < minText - 0.05) found.add(`text ${rendered.toFixed(1)}px "${text.slice(0, 20)}" in ${element.closest('[aria-label]')?.getAttribute('aria-label') ?? element.tagName.toLowerCase()}`);
    }
    for (const control of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
      if (control.getClientRects().length === 0) continue;
      const rect = control.getBoundingClientRect();
      if (rect.width > 600 && rect.height > 300) continue;
      if (rect.width < minTarget - 0.05 || rect.height < minTarget - 0.05) {
        found.add(`control ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px "${(control.getAttribute('aria-label') ?? control.textContent ?? '').trim().slice(0, 24)}"`);
      }
    }
    return [...found];
  }, { minText: MINIMUM_READABLE_TEXT_SIZE_PX, minTarget: MINIMUM_TOUCH_TARGET_SIZE_PX });
}

/** Waits for a hand to be on the table's center (a bot's opening Play, or - when this seat holds the 3♣ -
 *  this seat's own), so per-card checks can cover the center hand too. */
async function waitForCardsOnCenterTable(page: Page) {
  const centerCard = page.locator('[aria-label="Current hand to beat"] [role="img"]');
  const youPanel = page.getByRole('region', { name: 'You panel' });
  await expect
    .poll(async () => (await centerCard.count()) > 0 || (await youPanel.getAttribute('aria-current')) === 'true', { timeout: 20_000 })
    .toBe(true);
  if ((await centerCard.count()) > 0) return;
  await page.getByRole('group', { name: 'Your hand' }).getByRole('img', { name: '3 of Clubs', exact: true }).click();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(centerCard.first()).toBeVisible();
}

for (const viewport of [...SUPPORTED_VIEWPORTS, ...TIGHT_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`the play area fits the viewport without scrolling at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    await expectPlayAreaFits(page);
  });
}

test('the play area re-fits after the window is resized mid-Session, without a reload', async ({ page }) => {
  const [first, ...rest] = SUPPORTED_VIEWPORTS;
  if (!first) throw new Error('Viewport matrix has no supported entries.');
  await startGameAt(page, first);
  for (const viewport of rest) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    // The scale is recomputed from the resize event on the next render, so retry until it lands.
    await expect(() => expectPlayAreaFits(page)).toPass();
  }
});

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`core controls are visible, inside the viewport, and hit-testable at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const controls: Array<[string, Locator]> = [
      ['Play', page.getByRole('button', { name: 'Play', exact: true })],
      ['Pass', page.getByRole('button', { name: 'Pass', exact: true })],
      ['Sort Rank', page.getByRole('button', { name: 'Sort Rank', exact: true })],
      ['Sort Suit', page.getByRole('button', { name: 'Sort Suit', exact: true })],
      ['Check Discard Pile', page.getByRole('button', { name: 'Check Discard Pile', exact: true })],
      ['Event Log', page.getByRole('button', { name: 'Event Log', exact: true })],
      ['Leave Game', page.getByRole('button', { name: 'Leave Game', exact: true })],
      ['Your hand', page.getByRole('group', { name: 'Your hand' })],
      ['You panel', page.getByRole('region', { name: 'You panel' })],
      ['West panel', page.getByRole('region', { name: 'West panel' })],
      ['North panel', page.getByRole('region', { name: 'North panel' })],
      ['East panel', page.getByRole('region', { name: 'East panel' })],
    ];
    for (const [name, locator] of controls) await expectTargetable(locator, name);
  });
}

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`no two core table/bottom-bar elements overlap at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const boxes = await page.evaluate(() => {
      const named: Array<{ name: string; element: Element }> = [];
      const add = (name: string, element: Element | null | undefined) => {
        if (!element) throw new Error(`Layout probe: ${name} is missing.`);
        named.push({ name, element });
      };
      const buttonWithText = (text: string) => [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === text);
      for (const panel of document.querySelectorAll('[aria-label$=" panel"]')) {
        const label = panel.getAttribute('aria-label') ?? 'panel';
        add(label, panel);
        const botHand = panel.parentElement?.firstElementChild;
        if (botHand && botHand !== panel) add(`${label}'s bot hand`, botHand);
      }
      add('header', document.querySelector('[data-play-area-scale] > header'));
      add('Check Discard Pile', buttonWithText('Check Discard Pile'));
      add('Current hand to beat', document.querySelector('[aria-label="Current hand to beat"]'));
      add('Event Log', buttonWithText('Event Log'));
      add('Leave Game', buttonWithText('Leave Game'));
      add('Your hand', document.querySelector('[aria-label="Your hand"]'));
      add('Sort Rank', buttonWithText('Sort Rank'));
      add('Sort Suit', buttonWithText('Sort Suit'));
      add('Play or Pass', document.querySelector('[aria-label="Play or Pass"]'));
      return named.map(({ name, element }) => {
        const rect = element.getBoundingClientRect();
        return { name, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
      });
    });
    const overlaps: string[] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (overlapX > 1 && overlapY > 1) overlaps.push(`${a.name} overlaps ${b.name} by ${overlapX.toFixed(1)}x${overlapY.toFixed(1)}px`);
      }
    }
    expect(overlaps).toEqual([]);
  });
}

// Follow-up report on the first T14 layouts: the table looked cramped (everything zoomed in to fill a small
// fixed canvas), the title/Round line overlapped the table, and North's cards sat beside its panel instead
// of over it. The play area now stays at natural size (scale 1) anywhere between its design size and a
// laptop-sized window, and lays out the same arrangement as before with more room.
const NATURAL_SIZE_VIEWPORTS = SUPPORTED_VIEWPORTS.filter((viewport) => isFullScale(viewport) && viewport.width <= 1440 && viewport.height <= 900);

for (const viewport of [...NATURAL_SIZE_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`the play area is not zoomed in past natural size at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const measured = await page.evaluate(() => {
      const playArea = document.querySelector<HTMLElement>('[data-play-area-scale]');
      const card = document.querySelector('[aria-label="Your hand"] [role="img"]');
      if (!playArea || !card) throw new Error('Play area or held card is missing.');
      return { scale: Number(playArea.dataset.playAreaScale), cardWidth: card.getBoundingClientRect().width };
    });
    expect(measured.scale).toBe(1);
    expect(measured.cardWidth).toBeCloseTo(60, 1);
  });
}

for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`the title row sits above the Game Table and North's cards are centered over North's panel at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const layout = await page.evaluate(() => {
      const header = document.querySelector('[data-play-area-scale] > header');
      const table = document.querySelector('[aria-label="Game Table"]');
      const panel = document.querySelector('[aria-label="North panel"]');
      const cards = [...(panel?.parentElement?.querySelectorAll('[role="img"]') ?? [])];
      if (!header || !table || !panel || cards.length === 0) throw new Error('Layout probe: header, table, North panel or North cards missing.');
      const headerRect = header.getBoundingClientRect();
      const tableRect = table.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const cardRects = cards.map((card) => card.getBoundingClientRect());
      const fanLeft = Math.min(...cardRects.map((rect) => rect.left));
      const fanRight = Math.max(...cardRects.map((rect) => rect.right));
      return {
        headerBottom: headerRect.bottom,
        tableTop: tableRect.top,
        fanCenter: (fanLeft + fanRight) / 2,
        panelCenter: (panelRect.left + panelRect.right) / 2,
        fanBottom: Math.max(...cardRects.map((rect) => rect.bottom)),
        panelTop: panelRect.top,
      };
    });
    expect(layout.headerBottom, 'title row bottom vs table top').toBeLessThanOrEqual(layout.tableTop + 0.5);
    expect(Math.abs(layout.fanCenter - layout.panelCenter), 'North cards\' center vs North panel\'s center').toBeLessThanOrEqual(1);
    expect(layout.fanBottom, 'North cards\' bottom vs North panel\'s top').toBeLessThanOrEqual(layout.panelTop + 0.5);
  });
}

for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`the gap between each bot's cards and its panel is the same for North, West and East at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const gaps = await page.evaluate(() => {
      const gapOf = (seat: 'North' | 'West' | 'East') => {
        const panel = document.querySelector(`[aria-label="${seat} panel"]`);
        const cards = [...(panel?.parentElement?.querySelectorAll('[role="img"]') ?? [])].map((card) => card.getBoundingClientRect());
        if (!panel || cards.length === 0) throw new Error(`Layout probe: ${seat} panel or cards missing.`);
        const panelRect = panel.getBoundingClientRect();
        if (seat === 'North') return panelRect.top - Math.max(...cards.map((rect) => rect.bottom));
        if (seat === 'West') return panelRect.left - Math.max(...cards.map((rect) => rect.right));
        return Math.min(...cards.map((rect) => rect.left)) - panelRect.right;
      };
      return { north: gapOf('North'), west: gapOf('West'), east: gapOf('East') };
    });
    expect(gaps.west, 'West gap vs North gap').toBeCloseTo(gaps.north, 0);
    expect(gaps.east, 'East gap vs North gap').toBeCloseTo(gaps.north, 0);
    expect(gaps.north, 'North gap is a small positive gap, not overlapping').toBeGreaterThan(0);
  });
}

for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`the title, side buttons and Round line share left/right edges, inset to where the table's curve ends, at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const edges = await page.evaluate(() => {
      const playArea = document.querySelector<HTMLElement>('[data-play-area-scale]');
      const table = document.querySelector('[aria-label="Game Table"]');
      const title = document.querySelector('[data-play-area-scale] > header h1');
      const round = document.querySelector('[data-play-area-scale] > header p');
      const buttonWithText = (text: string) => [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === text);
      const eventLog = buttonWithText('Event Log');
      const leave = buttonWithText('Leave Game');
      const play = buttonWithText('Play');
      if (!playArea || !table || !title || !round || !eventLog || !leave || !play) throw new Error('Layout probe: an element is missing.');
      const scale = Number(playArea.dataset.playAreaScale);
      const playAreaRect = playArea.getBoundingClientRect();
      return {
        scale,
        designWidth: playArea.offsetWidth,
        titleLeft: title.getBoundingClientRect().left,
        eventLogLeft: eventLog.getBoundingClientRect().left,
        leaveLeft: leave.getBoundingClientRect().left,
        roundRight: round.getBoundingClientRect().right,
        playRight: play.getBoundingClientRect().right,
        playAreaLeft: playAreaRect.left,
        playAreaRight: playAreaRect.right,
        tableLeft: table.getBoundingClientRect().left,
        tableRight: table.getBoundingClientRect().right,
      };
    });
    expect(edges.eventLogLeft, 'Event Log vs title left edge').toBeCloseTo(edges.titleLeft, 0);
    expect(edges.leaveLeft, 'Leave Game vs title left edge').toBeCloseTo(edges.titleLeft, 0);
    expect(edges.playRight, 'Play vs Round line right edge').toBeCloseTo(edges.roundRight, 0);
    // The table's corners curve over 48 design px, so its straight edge begins that far in from its border box.
    // Whenever the play area is wide enough for the bottom bar's 874px to fit inside that, they line up there.
    if (edges.designWidth >= 1002) {
      expect(edges.eventLogLeft, 'left edge vs where the table\'s curve ends').toBeCloseTo(edges.tableLeft + 48 * edges.scale, 0);
      expect(edges.playRight, 'right edge vs where the table\'s curve ends').toBeCloseTo(edges.tableRight - 48 * edges.scale, 0);
    }
  });
}

test('Leave Game is red, and the other side buttons are not', async ({ page }) => {
  await startGameAt(page, FULL_SCALE_BOUNDARY);
  const colors = await page.evaluate(() => {
    const backgroundOf = (name: string) => {
      const button = [...document.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === name);
      if (!button) throw new Error(`Layout probe: ${name} is missing.`);
      const [red = 0, green = 0, blue = 0] = getComputedStyle(button).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [];
      return { red, green, blue };
    };
    return { leave: backgroundOf('Leave Game'), eventLog: backgroundOf('Event Log') };
  });
  expect(colors.leave.red).toBeGreaterThan(colors.leave.green + 100);
  expect(colors.leave.red).toBeGreaterThan(colors.leave.blue + 100);
  expect(colors.eventLog.red).not.toBeGreaterThan(colors.eventLog.green + 100);
});

for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
  test(`a card on the center table is the same size as a card in the hand at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    await waitForCardsOnCenterTable(page);
    const sizes = await page.evaluate(() => {
      const size = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error(`Layout probe: ${selector} is missing.`);
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      };
      return { held: size('[aria-label="Your hand"] [role="img"]'), center: size('[aria-label="Current hand to beat"] [role="img"]') };
    });
    expect(sizes.center.width).toBeCloseTo(sizes.held.width, 1);
    expect(sizes.center.height).toBeCloseTo(sizes.held.height, 1);
  });
}

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`every card - held, bot, and center - keeps its 5:7 ratio at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    await waitForCardsOnCenterTable(page);
    const cards = await page.evaluate(() =>
      [...document.querySelectorAll('div[role="img"]')].map((element) => {
        const rect = element.getBoundingClientRect();
        const kind = element.closest('[aria-label="Your hand"]')
          ? 'held'
          : element.closest('[aria-label="Current hand to beat"]')
            ? 'center'
            : element.getAttribute('aria-label') === 'Face-down card' ? 'bot' : 'other';
        return { kind, width: rect.width, height: rect.height };
      }),
    );
    for (const kind of ['held', 'bot', 'center']) {
      expect(cards.filter((card) => card.kind === kind).length, `${kind} cards found`).toBeGreaterThan(0);
    }
    // Rotated (West/East) bot cards swap width and height, so compare the long side to the short side.
    for (const card of cards) {
      const ratio = Math.max(card.width, card.height) / Math.min(card.width, card.height);
      expect(ratio, `${card.kind} card ${card.width.toFixed(1)}x${card.height.toFixed(1)}`).toBeCloseTo(7 / 5, 1);
    }
  });
}

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`held cards share one baseline and only selected cards rise at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const hand = page.getByRole('group', { name: 'Your hand' });
    const cards = hand.getByRole('img');
    const slots = hand.locator('[data-card-key]');
    await expect(cards).toHaveCount(13);
    // Scoped to the hand: the page also holds infinite animations (the bots' "deciding" spinner), whose
    // `finished` promise never resolves.
    const settle = () => hand.evaluate((element) => Promise.all(element.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    const tops = async () => Promise.all([...Array(13).keys()].map(async (index) => (await cards.nth(index).boundingBox())!.y));

    const baseline = await tops();
    for (const top of baseline) expect(top).toBeCloseTo(baseline[0]!, 0);

    // Selecting two cards (rather than one) is what proves a selected card rises independently of its
    // neighbors, so this Turn's own live cap must allow at least two.
    await waitForSelectableTurn(page, 2);
    for (const index of [2, 7]) await cards.nth(index).click();
    await expect(slots.nth(2)).toHaveAttribute('data-selected', 'true');
    await expect(slots.nth(7)).toHaveAttribute('data-selected', 'true');
    await settle();
    const afterSelecting = await tops();
    afterSelecting.forEach((top, index) => {
      if (index === 2 || index === 7) expect(top, `selected card ${index} rises`).toBeLessThan(baseline[index]! - 1);
      else expect(top, `unselected card ${index} stays on the baseline`).toBeCloseTo(baseline[index]!, 0);
    });
  });
}

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`all 13 overlapped cards are independently targetable, each with >= ${MINIMUM_EXPOSED_CARD_WIDTH_PX}px exposed, at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const hand = page.getByRole('group', { name: 'Your hand' });
    const cards = hand.getByRole('img');
    const slots = hand.locator('[data-card-key]');
    await expect(cards).toHaveCount(13);

    const lefts = await slots.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().left));
    for (let index = 0; index < 12; index++) {
      expect(lefts[index + 1]! - lefts[index]!, `card ${index} exposed width`).toBeGreaterThanOrEqual(MINIMUM_EXPOSED_CARD_WIDTH_PX - 0.5);
    }

    // Only the first `cap` clicks can select anything (the live Play selection cap, M4-T08); the rest
    // still prove their own card was hit by staying reliably deselected. `cap` is read from this Turn's
    // own live state rather than assumed to always be the free-Play 5, since Session start does not
    // guarantee this seat is the one opening (see `waitForYourTurn`'s own docstring above).
    await waitForYourTurn(page);
    const cap = await currentSelectionCap(page);
    for (let index = 0; index < 13; index++) {
      await cards.nth(index).click();
      await expect(slots.nth(index)).toHaveAttribute('data-selected', index < cap ? 'true' : 'false');
    }
  });
}

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`dragging a held card follows the pointer 1:1 under the scaled play area at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    const slots = page.getByRole('group', { name: 'Your hand' }).locator('[data-card-key]');
    await expect(slots).toHaveCount(13);
    const slot = slots.nth(6);
    const start = (await slot.boundingBox())!;
    const pointerX = start.x + start.width / 2;
    const pointerY = start.y + start.height / 2;
    const DRAG_PX = 30;

    await page.mouse.move(pointerX, pointerY);
    await page.mouse.down();
    await page.mouse.move(pointerX + DRAG_PX, pointerY, { steps: 6 });
    const during = (await slot.boundingBox())!;
    await page.mouse.up();
    // Without compensating for the play area's own scale, the card would move `DRAG_PX * scale` on screen
    // (visibly lagging at scale < 1 and running ahead at scale > 1).
    expect(Math.abs(during.x - start.x - DRAG_PX)).toBeLessThanOrEqual(1.5);
  });
}

const OVERLAYS = [
  { opener: 'Check Discard Pile', title: 'Discard Pile', controls: ['Close Discard Pile'] },
  { opener: 'Event Log', title: 'Event Log', controls: ['Close Event Log'] },
  { opener: 'Leave Game', title: 'Leave Game', controls: ['Close Leave Game', 'Stay', 'Yes, Leave Game'] },
] as const;

for (const viewport of SUPPORTED_VIEWPORTS) {
  test(`Discard Pile, Event Log, and Leave Game overlays fit and stay operable at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await startGameAt(page, viewport);
    for (const overlay of OVERLAYS) {
      await page.getByRole('button', { name: overlay.opener, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: overlay.title, exact: true });
      await expect(dialog).toBeVisible();
      expectWithinViewport(await probeTarget(dialog), `${overlay.title} dialog`);
      for (const control of overlay.controls) await expectTargetable(dialog.getByRole('button', { name: control, exact: true }), `${overlay.title} > ${control}`);
      await dialog.getByRole('button', { name: overlay.controls[0], exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}

for (const viewport of FULL_SCALE_VIEWPORTS) {
  test(`text is >= ${MINIMUM_READABLE_TEXT_SIZE_PX}px and controls >= ${MINIMUM_TOUCH_TARGET_SIZE_PX}px on Home, the table, and its overlays at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    expect(await collectSizingViolations(page), 'Home').toEqual([]);

    await page.getByRole('button', { name: 'Start Game', exact: true }).click();
    await expect(page.getByRole('button', { name: /^Starting Round/ })).not.toBeVisible();
    await waitForCardsOnCenterTable(page);
    expect(await collectSizingViolations(page), 'Game Table').toEqual([]);

    for (const overlay of OVERLAYS) {
      await page.getByRole('button', { name: overlay.opener, exact: true }).click();
      const dialog = page.getByRole('dialog', { name: overlay.title, exact: true });
      await expect(dialog).toBeVisible();
      expect(await collectSizingViolations(page), overlay.title).toEqual([]);
      await dialog.getByRole('button', { name: overlay.controls[0], exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }
  });
}

/**
 * Drives the human seat through Rounds with the same minimal legal strategy round-result.e2e.ts uses
 * (always Pass while responding; lead the first card only when forced to), but under Playwright's fake
 * clock so the bots' 800ms presentation pauses, the reveal, and the scoring stages are fast-forwarded
 * instead of waited out in real time - this is what makes reaching Round Result *and* a five-Round
 * Session Summary affordable across the whole matrix. Stops at Round 1's settled Result
 * (`'roundResult'`), or after clicking through every "Next Round" until Session Summary is showing
 * (`'sessionSummary'`).
 */
async function driveUnderFakeClock(page: Page, until: 'roundResult' | 'sessionSummary') {
  const passButton = page.getByRole('button', { name: 'Pass', exact: true });
  const playButton = page.getByRole('button', { name: 'Play', exact: true });
  const nextRound = page.getByRole('button', { name: 'Next Round', exact: true });
  const hand = page.getByRole('group', { name: 'Your hand' });
  const openingLabel = page.getByText('OPENING · 3♣ required', { exact: true });

  for (let step = 0; step < 4000; step++) {
    const state = await page.evaluate(() => ({
      yourTurn: document.querySelector('[aria-label="You panel"]')?.getAttribute('aria-current') === 'true',
      summary: document.querySelector('[aria-label="Session Summary"]') !== null,
      dialog: document.querySelector('[role="dialog"]') !== null,
      nextRound: [...document.querySelectorAll('button')].some((button) => button.textContent?.trim() === 'Next Round'),
      skipReveal: document.querySelector('[aria-label="Skip reveal"]') !== null,
      transition: document.querySelector('[aria-label^="Starting Round"]') !== null,
    }));

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
    if (await passButton.isEnabled()) {
      await passButton.click();
    } else {
      if (await openingLabel.isVisible()) await hand.getByRole('img', { name: '3 of Clubs', exact: true }).click();
      else await hand.getByRole('img').first().click();
      await playButton.click();
    }
  }
  throw new Error(`Session did not reach ${until} within the step budget.`);
}

test('Round Result and Session Summary stay inside the viewport with their actions targetable at every supported size', async ({ page }) => {
  test.setTimeout(180_000);
  await page.clock.install();
  const [first] = SUPPORTED_VIEWPORTS;
  if (!first) throw new Error('Viewport matrix has no supported entries.');
  await startGameAt(page, first, FIVE_ROUND_E2E_SEED);

  await driveUnderFakeClock(page, 'roundResult');
  const roundResult = page.getByRole('dialog', { name: /^Round \d Result$/ });
  await expect(roundResult).toBeVisible();
  for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const label = `Round Result at ${viewport.name} (${viewport.width}x${viewport.height})`;
    expectWithinViewport(await probeTarget(roundResult), label);
    // The play area re-fits from the resize event on its next render, so retry until it has settled.
    if (isFullScale(viewport)) await expect(async () => expect(await collectSizingViolations(page), `${label} sizing`).toEqual([])).toPass();
    await expectTargetable(roundResult.getByRole('button', { name: 'Next Round', exact: true }), `${label} > Next Round`);
    const clipped = await roundResult.evaluate((element) => element.scrollHeight > element.clientHeight + 1);
    expect(clipped, `${label} clips its own content`).toBe(false);
  }

  await driveUnderFakeClock(page, 'sessionSummary');
  const summary = page.getByRole('dialog', { name: 'Session Summary', exact: true });
  await expect(summary).toBeVisible();
  for (const viewport of [...SUPPORTED_VIEWPORTS, FULL_SCALE_BOUNDARY]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const label = `Session Summary at ${viewport.name} (${viewport.width}x${viewport.height})`;
    expectWithinViewport(await probeTarget(summary), label);
    if (isFullScale(viewport)) await expect(async () => expect(await collectSizingViolations(page), `${label} sizing`).toEqual([])).toPass();
    for (const action of ['Event Log', 'Home', 'Play Again']) {
      await expectTargetable(summary.getByRole('button', { name: action, exact: true }), `${label} > ${action}`);
    }
    // Follow-up report: the action buttons' text must sit at the center of each button, and each table must
    // be one solid rounded shape (a collapsed-border table ignores its own radius, so a wrapper clips it).
    const shapes = await summary.evaluate((dialog) => {
      const textOffsets = [...dialog.querySelectorAll('button')].map((button) => {
        const range = document.createRange();
        range.selectNodeContents(button);
        const text = range.getBoundingClientRect();
        const box = button.getBoundingClientRect();
        return { name: button.textContent?.trim() ?? '', dx: (text.left + text.right) / 2 - (box.left + box.right) / 2, dy: (text.top + text.bottom) / 2 - (box.top + box.bottom) / 2 };
      });
      const tables = [...dialog.querySelectorAll('table')].map((table) => {
        const card = getComputedStyle(table.parentElement!);
        const cardRect = table.parentElement!.getBoundingClientRect();
        const tableRect = table.getBoundingClientRect();
        return { overflow: card.overflow, radius: parseFloat(card.borderTopLeftRadius), clippedBy: Math.max(tableRect.right - cardRect.right, cardRect.left - tableRect.left, tableRect.bottom - cardRect.bottom) };
      });
      return { textOffsets, tables };
    });
    expect(shapes.tables, `${label} tables`).toHaveLength(2);
    for (const table of shapes.tables) {
      expect(table.overflow, `${label} table card clips its content`).toBe('hidden');
      expect(table.radius, `${label} table card is rounded`).toBeGreaterThanOrEqual(8);
      expect(table.clippedBy, `${label} table content is cut off by its own card`).toBeLessThanOrEqual(1);
    }
    for (const offset of shapes.textOffsets) {
      expect(Math.abs(offset.dx), `${label} > ${offset.name} text horizontal offset`).toBeLessThanOrEqual(1);
      expect(Math.abs(offset.dy), `${label} > ${offset.name} text vertical offset`).toBeLessThanOrEqual(1);
    }
  }
});

for (const viewport of UNSUPPORTED_VIEWPORTS) {
  test(`the unsupported-layout guidance fits its viewport without scrolling at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('/');
    await expectTargetable(page.getByRole('heading', { name: 'Resize your window to continue', exact: true }), 'guidance heading');
    const scrolls = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth > root.clientWidth || root.scrollHeight > root.clientHeight;
    });
    expect(scrolls, 'guidance page scrolls').toBe(false);
  });
}

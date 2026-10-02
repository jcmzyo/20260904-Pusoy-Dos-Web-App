import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';
import {
  MINIMUM_READABLE_TEXT_SIZE_PX,
  MINIMUM_TOUCH_TARGET_SIZE_PX,
  SUPPORTED_PORTRAIT_VIEWPORTS,
  findViewport,
} from './viewportMatrix';
import type { ViewportSpec } from './viewportMatrix';
import { waitForYourTurn } from './turnHelpers';
import { PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX, PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX } from '../../src/ui/primitives/layoutThresholds';

/**
 * Real-browser coverage for M5-T03 (Portrait Table, Opponent Status, and Gameplay Controls; ui-ux.md
 * §19.6.3-§19.6.5) over every supported portrait case of the frozen M5 matrix, in each pointer context the
 * matrix assigns it: no page scroll, every text and control at the literal 14px / 44x44px minimums, the
 * gameplay controls targetable and never overlapped, the current five-card combination readable, the
 * worst-case status/name text contained in its panel, the frozen Tab order with a visible focus indicator,
 * and the approved colors at WCAG AA. Hand geometry (exposure, selection rise, drag) and the hand's own
 * keyboard bindings are M5-T04's; dialogs are M5-T05's.
 */

// `?e2eSeed=1` (main.tsx's dev-server-only deterministic deal): East holds 3♣ and opens Round 1 with a Full
// House, so every case below has a real five-card hand to beat on the center table, and South's first Turn
// is a response (Pass available).
const FIVE_CARD_OPENING_SEED = 1;
const FIVE_CARD_OPENER = 'East';

// Portrait's top-to-bottom, left-to-right order, which is also its Tab order (ui-ux.md §19.6.4, revised
// October 2, 2026): the three utility buttons, the hand (M5-T04's Tab stop), Sort, then Pass | Play.
const CONTROL_NAMES = ['Event Log', 'Check Discard Pile', 'Leave Game', 'Sort Rank', 'Sort Suit', 'Pass', 'Play'] as const;

/** Tall-tier portrait (ui-ux.md §19.6.3): opponents show their face-down fan. */
function isTall(spec: { readonly width: number; readonly height: number }) {
  return spec.height >= (spec.width >= 600 ? PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX : PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX);
}

async function startPortraitGame(page: Page, spec: ViewportSpec) {
  await page.setViewportSize({ width: spec.width, height: spec.height });
  await page.goto(`/?e2eSeed=${FIVE_CARD_OPENING_SEED}`);
  await page.getByRole('button', { name: 'Start Game', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Game Table' })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Starting Round/ })).not.toBeVisible();
  await expect(page.locator('[data-layout]')).toHaveAttribute('data-layout', `portrait-${spec.portraitClass}`);
  await expect(page.locator('[aria-label="Current hand to beat"] [role="img"]')).toHaveCount(5, { timeout: 20_000 });
}

interface Box { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }

async function boxOf(locator: Locator): Promise<Box> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  });
}

function overlapArea(a: Box, b: Box): number {
  return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
}

/** No page scroll in either direction, and nothing rendered in the play area extends past the viewport. */
async function expectFitsWithoutScrolling(page: Page) {
  const fit = await page.evaluate(() => {
    const root = document.documentElement;
    const area = document.querySelector('[data-play-area-scale]');
    if (!area) throw new Error('Play area is missing.');
    const outside: string[] = [];
    for (const element of area.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.left < -0.5 || rect.top < -0.5 || rect.right > window.innerWidth + 0.5 || rect.bottom > window.innerHeight + 0.5) {
        outside.push(`${element.tagName.toLowerCase()}[${element.getAttribute('aria-label') ?? element.textContent?.slice(0, 20) ?? ''}]`);
      }
    }
    return { scrollWidth: root.scrollWidth, clientWidth: root.clientWidth, scrollHeight: root.scrollHeight, clientHeight: root.clientHeight, outside };
  });
  expect(fit.scrollWidth, 'page scrolls horizontally').toBeLessThanOrEqual(fit.clientWidth);
  expect(fit.scrollHeight, 'page scrolls vertically').toBeLessThanOrEqual(fit.clientHeight);
  expect(fit.outside, 'elements extending past the viewport').toEqual([]);
}

/** Rendered text below 14px and controls below 44x44px anywhere visible. Portrait renders unscaled
 *  (`data-play-area-scale` is 1), so computed sizes are rendered sizes; there is no phone-tier exemption. */
async function collectSizingViolations(page: Page): Promise<string[]> {
  return page.evaluate(({ minText, minTarget }) => {
    const found = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      const element = walker.currentNode.parentElement;
      if (!text || !element || element.getClientRects().length === 0) continue;
      const style = getComputedStyle(element);
      if (style.visibility === 'hidden') continue;
      const size = parseFloat(style.fontSize);
      if (size < minText - 0.05) found.add(`text ${size.toFixed(1)}px "${text.slice(0, 20)}" in ${element.closest('[aria-label]')?.getAttribute('aria-label') ?? element.tagName.toLowerCase()}`);
    }
    for (const control of document.querySelectorAll('button, a[href], [role="button"], input, select')) {
      if (control.getClientRects().length === 0) continue;
      const rect = control.getBoundingClientRect();
      if (rect.width < minTarget - 0.05 || rect.height < minTarget - 0.05) {
        found.add(`control ${rect.width.toFixed(0)}x${rect.height.toFixed(0)}px "${(control.getAttribute('aria-label') ?? control.textContent ?? '').trim().slice(0, 24)}"`);
      }
    }
    return [...found];
  }, { minText: MINIMUM_READABLE_TEXT_SIZE_PX, minTarget: MINIMUM_TOUCH_TARGET_SIZE_PX });
}

async function expectTargetable(page: Page, locator: Locator, description: string) {
  await expect(locator, `${description} is visible`).toBeVisible();
  const probe = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const topmost = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return { rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }, hit: topmost !== null && (topmost === element || element.contains(topmost)) };
  });
  const viewport = page.viewportSize()!;
  expect(probe.rect.left, `${description}: left edge`).toBeGreaterThanOrEqual(-0.5);
  expect(probe.rect.top, `${description}: top edge`).toBeGreaterThanOrEqual(-0.5);
  expect(probe.rect.right, `${description}: right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(probe.rect.bottom, `${description}: bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5);
  expect(probe.hit, `${description} is not what a pointer hits at its own center`).toBe(true);
}

/**
 * WCAG relative-luminance contrast of `foreground` against what is actually behind `element`: its own and
 * its ancestors' translucent background colors composited over the first opaque color or gradient beneath
 * them (ui-ux.md §19.6.5: "Measure against the actual composited background"). A gradient contributes each
 * of its color stops, and the lowest ratio over those stops is returned.
 */
async function contrastAgainstBackdrop(locator: Locator, foreground: 'color' | 'outline', from: 'self' | 'parent' = 'self'): Promise<number> {
  return locator.evaluate((element, { foreground, from }) => {
    const parse = (value: string): number[][] => [...value.matchAll(/rgba?\(([^)]+)\)/g)].map((match) => {
      const parts = match[1]!.split(/[ ,/]+/).filter(Boolean).map(Number);
      return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
    });
    const luminance = ([r, g, b]: number[]) => {
      const channel = (value: number) => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * channel(r!) + 0.7152 * channel(g!) + 0.0722 * channel(b!);
    };
    const ratio = (a: number[], b: number[]) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi! + 0.05) / (lo! + 0.05); };
    const layers: number[][] = [];
    let bases: number[][] = [[255, 255, 255, 1]];
    for (let node: Element | null = from === 'self' ? element : element.parentElement; node; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.backgroundImage.includes('gradient')) { bases = parse(style.backgroundImage); break; }
      const [color] = parse(style.backgroundColor);
      if (color && color[3]! > 0) {
        if (color[3]! >= 1) { bases = [color]; break; }
        layers.push(color);
      }
    }
    const composite = (base: number[]) => layers.reduceRight((under, [r, g, b, a]) => [r! * a! + under[0]! * (1 - a!), g! * a! + under[1]! * (1 - a!), b! * a! + under[2]! * (1 - a!), 1], base);
    const style = getComputedStyle(element);
    const [fg] = parse(foreground === 'color' ? style.color : style.outlineColor);
    return Math.min(...bases.map((base) => ratio(fg!, composite(base))));
  }, { foreground, from });
}

function portraitCases(pointer: 'coarse' | 'fine') {
  return SUPPORTED_PORTRAIT_VIEWPORTS.filter((spec) => spec.pointers.includes(pointer));
}

function geometryTests(pointer: 'coarse' | 'fine') {
  for (const spec of portraitCases(pointer)) {
    test(`portrait table fits, reads, and stays operable at ${spec.name} (${spec.width}x${spec.height}, ${pointer} pointer)`, async ({ page }) => {
      await startPortraitGame(page, spec);
      await expectFitsWithoutScrolling(page);
      expect(await collectSizingViolations(page)).toEqual([]);

      // Whose Turn, what to beat and who played it, opponent counts and scores, and the Round context.
      await expect(page.getByText('Basic · Round 1 of 5', { exact: true })).toBeVisible();
      const center = page.getByRole('region', { name: 'Current hand to beat' });
      await expect(center.locator('p').first()).toHaveText(`${FIVE_CARD_OPENER} played Full House`);
      for (const name of ['West', 'North', 'East', 'You']) {
        const panel = page.getByRole('region', { name: `${name} panel` });
        await expect(panel).toBeVisible();
        await expect(panel).toContainText(/\d+ cards?/);
        await expect(panel).toContainText(/\d+ pts/);
      }
      await expect(page.locator('section[aria-current="true"]')).toHaveCount(1);
      await expect(page.locator('section[aria-current="true"]')).toContainText('Turn');

      // Opponents show their face-down fan in the tall tier only; the trail is tablet-only, with East's Play in it.
      const faceDown = page.locator('[aria-label="Game Table"] [aria-label="Face-down card"]').filter({ visible: true });
      await expect(faceDown).toHaveCount(isTall(spec) ? 13 + 13 + 8 : 0);
      for (const card of await faceDown.all()) await expect(card).toBeInViewport();
      const eastTrail = page.getByRole('region', { name: 'East panel' }).getByRole('group', { name: 'Current Play' });
      if (spec.portraitClass === 'phone') await expect(eastTrail).toHaveCount(0);
      else await expect(eastTrail.getByRole('img')).toHaveCount(5);

      // The five center cards sit fully inside the center, at 5:7, at least 56px wide, with 14px+ indices.
      const centerBox = await boxOf(center);
      const centerCards = center.locator('[role="img"]');
      for (let index = 0; index < 5; index++) {
        const card = centerCards.nth(index);
        const box = await boxOf(card);
        expect(box.left, `center card ${index} left`).toBeGreaterThanOrEqual(centerBox.left - 0.5);
        expect(box.right, `center card ${index} right`).toBeLessThanOrEqual(centerBox.right + 0.5);
        expect(box.top, `center card ${index} top`).toBeGreaterThanOrEqual(centerBox.top - 0.5);
        expect(box.bottom, `center card ${index} bottom`).toBeLessThanOrEqual(centerBox.bottom + 0.5);
        expect(box.right - box.left, `center card ${index} width`).toBeGreaterThanOrEqual(56 - 0.5);
        expect((box.bottom - box.top) / (box.right - box.left), `center card ${index} ratio`).toBeCloseTo(7 / 5, 1);
        for (let other = 0; other < index; other++) expect(overlapArea(box, await boxOf(centerCards.nth(other))), `center cards ${other} and ${index} overlap`).toBeLessThan(1);
      }

      // Every control is visible, inside the viewport, and what a pointer hits at its center, and its label fits
      // inside it (a label wrapping onto more lines than the 44px button holds would spill out).
      for (const name of CONTROL_NAMES) {
        const button = page.getByRole('button', { name, exact: true });
        await expectTargetable(page, button, name);
        const fits = await button.evaluate((element) => element.scrollHeight <= element.clientHeight + 0.5 && element.scrollWidth <= element.clientWidth + 0.5);
        expect(fits, `${name}'s label fits inside it`).toBe(true);
      }

      // No two gameplay-critical elements overlap: the title row, each panel, the center, each control, the hand.
      const critical: [string, Locator][] = [
        ['title row', page.locator('header')],
        ...['West', 'North', 'East', 'You'].map((name): [string, Locator] => [`${name} panel`, page.getByRole('region', { name: `${name} panel` })]),
        ['center', center],
        ['hand', page.getByRole('group', { name: 'Your hand' })],
        ...CONTROL_NAMES.map((name): [string, Locator] => [name, page.getByRole('button', { name, exact: true })]),
      ];
      const boxes = await Promise.all(critical.map(async ([name, locator]) => [name, await boxOf(locator)] as const));
      for (let a = 0; a < boxes.length; a++) {
        for (let b = a + 1; b < boxes.length; b++) {
          expect(overlapArea(boxes[a]![1], boxes[b]![1]), `${boxes[a]![0]} overlaps ${boxes[b]![0]}`).toBeLessThan(1);
        }
      }

      // The table sits above the controls and takes at most 5/8 of the height; the controls read the utility
      // buttons, the hand, Sort, then Pass | Play, top to bottom.
      const viewport = page.viewportSize()!;
      const table = await boxOf(page.getByRole('region', { name: 'Game Table' }));
      expect(table.bottom - table.top, 'table height').toBeLessThanOrEqual(viewport.height * 5 / 8 + 1);
      const control = async (name: string) => boxOf(page.getByRole('button', { name, exact: true }));
      const [pass, play, sortRank, eventLog] = [await control('Pass'), await control('Play'), await control('Sort Rank'), await control('Event Log')];
      const hand = await boxOf(page.getByRole('group', { name: 'Your hand' }));
      expect(table.bottom, 'table above the utility buttons').toBeLessThanOrEqual(eventLog.top);
      expect(eventLog.bottom, 'utility buttons above the hand').toBeLessThanOrEqual(hand.top);
      expect(hand.bottom, 'hand above Sort').toBeLessThanOrEqual(sortRank.top);
      expect(sortRank.bottom, 'Sort above Pass/Play').toBeLessThanOrEqual(pass.top);
      expect(Math.abs(pass.top - play.top), 'Pass and Play share a row').toBeLessThan(1);
      expect(pass.right, 'Pass is left of Play').toBeLessThanOrEqual(play.left);
      // The utility buttons sit at least 12px below the table and are centered with Sort, like the hand.
      expect(eventLog.top - table.bottom, 'gap between the table and the utility buttons').toBeGreaterThanOrEqual(12 - 0.5);
      // Sort Rank/Sort Suit draw a shorter visible button inside their full 44px target.
      const sortVisible = await page.getByRole('button', { name: 'Sort Rank', exact: true }).evaluate((element) => {
        const style = getComputedStyle(element);
        return element.getBoundingClientRect().height - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth);
      });
      expect(sortVisible, 'Sort Rank visible height').toBeLessThan(sortRank.bottom - sortRank.top);
      expect(sortRank.bottom - sortRank.top, 'Sort Rank target height').toBeGreaterThanOrEqual(44 - 0.05);
      const leave = await control('Leave Game');
      const discard = await control('Check Discard Pile');
      const sortSuit = await control('Sort Suit');
      const sortCenter = (sortRank.left + sortSuit.right) / 2;
      expect(Math.abs((discard.left + discard.right) / 2 - sortCenter), 'Check Discard Pile centered under Sort').toBeLessThanOrEqual(1);
      expect(Math.abs((eventLog.left + leave.right) / 2 - sortCenter), 'utility row centered under Sort').toBeLessThanOrEqual(1);
      for (const [name, box] of [['Event Log', eventLog], ['Leave Game', leave]] as const) {
        expect(Math.abs((box.right - box.left) - (discard.right - discard.left)), `${name} is as wide as Check Discard Pile`).toBeLessThanOrEqual(0.5);
      }
      expect(Math.abs(sortCenter - (hand.left + hand.right) / 2), 'Sort centered under the hand').toBeLessThanOrEqual(1);
      // Pass and Play are each centered in their own half of the row.
      const playPassRow = await boxOf(page.getByRole('group', { name: 'Play or Pass' }));
      const rowMiddle = (playPassRow.left + playPassRow.right) / 2;
      expect(Math.abs(rowMiddle - sortCenter), 'Pass/Play row centered with Sort').toBeLessThanOrEqual(1);
      expect(Math.abs((pass.left + pass.right) / 2 - (playPassRow.left + rowMiddle) / 2), 'Pass centered in the left half').toBeLessThanOrEqual(1);
      expect(Math.abs((play.left + play.right) / 2 - (rowMiddle + playPassRow.right) / 2), 'Play centered in the right half').toBeLessThanOrEqual(1);
      expect(Math.abs((pass.right - pass.left) - (play.right - play.left)), 'Pass and Play are the same width').toBeLessThanOrEqual(0.5);
      // Sort Rank/Sort Suit share one width, so the gap between them lines up with the gap between Pass and Play.
      expect(Math.abs((sortRank.right - sortRank.left) - (sortSuit.right - sortSuit.left)), 'Sort Rank and Sort Suit are the same width').toBeLessThanOrEqual(0.5);
      expect(Math.abs((sortRank.right + sortSuit.left) / 2 - (pass.right + play.left) / 2), 'Sort gap lines up with the Pass/Play gap').toBeLessThanOrEqual(1);
      // The human's panel keeps room for its glow inside the table border.
      const you = await boxOf(page.getByRole('region', { name: 'You panel' }));
      expect(table.bottom - you.bottom, 'room below the human panel').toBeGreaterThanOrEqual(8);
      expect(you.left - table.left, 'room left of the human panel').toBeGreaterThanOrEqual(8);
      expect(table.right - you.right, 'room right of the human panel').toBeGreaterThanOrEqual(8);
      // Pass and Play are each smaller than a held card is tall, and narrower together than the hand.
      const heldCard = await boxOf(page.getByRole('group', { name: 'Your hand' }).locator('[role="img"]').first());
      expect(play.bottom - play.top, 'Play shorter than a held card').toBeLessThan(heldCard.bottom - heldCard.top);
      expect(play.right - pass.left, 'Pass/Play narrower than the hand').toBeLessThan(hand.right - hand.left);
      // Every Play/Pass second line the Engine-derived feedback can produce fits inside the fixed button.
      const overflowing = await page.evaluate(() => {
        const reasons = ['Invalid combination', 'Wrong number of cards', 'Must include 3♣', "Doesn't beat Pair of 10s", "Doesn't beat Triple 10s",
          'Needs a higher Four of a Kind', 'Needs a higher Straight Flush', 'Weaker than Four of a Kind', 'Weaker than Straight Flush', 'Needs a 5-card hand',
          'Four of a Kind', 'Straight Flush', 'No valid plays'];
        const found: string[] = [];
        for (const label of ['Play', 'Pass']) {
          const button = document.querySelector(`button[aria-label="${label}"]`) as HTMLElement;
          // Styled like PlayPassControls.module.css's `.subLabel`, the second line's own rule.
          const probe = document.createElement('span');
          probe.style.fontSize = '14px';
          probe.style.fontWeight = '600';
          probe.style.lineHeight = '1.2';
          probe.style.textAlign = 'center';
          probe.style.overflowWrap = 'break-word';
          // Any second line already shown is set aside so the probe stands in for it, not beside it.
          const existing = button.querySelector<HTMLElement>('[id$="-sublabel"]');
          if (existing) existing.style.display = 'none';
          button.append(probe);
          for (const reason of reasons) {
            probe.textContent = reason;
            if (button.scrollHeight > button.clientHeight + 0.5 || button.scrollWidth > button.clientWidth + 0.5) found.push(`${label}: ${reason}`);
          }
          probe.remove();
          if (existing) existing.style.display = '';
        }
        return found;
      });
      expect(overflowing, 'reasons spilling out of Play/Pass').toEqual([]);
      // A fine-pointer (desktop) window caps held cards at 72px; touch at 88px.
      const cardWidth = (await boxOf(page.getByRole('group', { name: 'Your hand' }).locator('[role="img"]').first()));
      expect(cardWidth.right - cardWidth.left, 'held card width').toBeLessThanOrEqual((pointer === 'fine' ? 72 : 88) + 0.5);

      // A selected card rises without covering a control (the raise headroom is reserved above the hand).
      const lastCard = page.getByRole('group', { name: 'Your hand' }).locator('[data-card-key]').last();
      await lastCard.click();
      await expect(lastCard).toHaveAttribute('data-selected', 'true');
      const raised = await boxOf(lastCard.locator('[role="img"]'));
      for (const name of CONTROL_NAMES) {
        expect(overlapArea(raised, await boxOf(page.getByRole('button', { name, exact: true }))), `raised card covers ${name}`).toBeLessThan(1);
      }
      await expectFitsWithoutScrolling(page);
    });

    test(`worst-case status, count, score, and long names stay inside their panels at ${spec.name} (${spec.width}x${spec.height}, ${pointer} pointer)`, async ({ page }) => {
      await startPortraitGame(page, spec);
      await waitForYourTurn(page);
      // Substitutes the widest real values into the rendered panels (DONE · 2nd, 13 cards, 25 pts, a long name)
      // and measures them in the same synchronous step, so no re-render intervenes. Panel boxes must not move.
      const result = await page.evaluate(() => {
        const failures: string[] = [];
        const within = (inner: DOMRect, outer: DOMRect) => inner.left >= outer.left - 0.5 && inner.right <= outer.right + 0.5 && inner.top >= outer.top - 0.5 && inner.bottom <= outer.bottom + 0.5;
        const turnPill = [...document.querySelectorAll('[aria-label="You panel"] p')].find((line) => line.textContent === 'Turn');
        if (!turnPill) throw new Error('Expected the human\'s Turn status to measure against.');
        const pillClass = turnPill.className;
        for (const name of ['West', 'North', 'East', 'You']) {
          const panel = document.querySelector(`[aria-label="${name} panel"]`) as HTMLElement;
          const before = panel.getBoundingClientRect();
          const [nameLine, ...rest] = [...panel.querySelectorAll('p')];
          nameLine!.textContent = 'Maximiliana Montgomery-Featherstonehaugh';
          const metas = rest.filter((line) => /card|pts/.test(line.textContent ?? ''));
          if (metas.length === 2) { metas[0]!.textContent = '13 cards'; metas[1]!.textContent = '25 pts'; } else { metas[0]!.textContent = '13 cards · 25 pts'; }
          // The status slot is the first <div> in every PlayerPanel variant.
          const slot = [...panel.children].find((child) => child.tagName === 'DIV')!;
          let pill = slot.querySelector('p');
          if (!pill) { pill = document.createElement('p'); pill.className = pillClass; slot.prepend(pill); }
          pill.textContent = name === 'You' ? 'DONE · 1st' : 'DONE · 2nd';
          const after = panel.getBoundingClientRect();
          if (Math.abs(after.width - before.width) > 0.5 || Math.abs(after.height - before.height) > 0.5) failures.push(`${name} panel resized`);
          const inner = new DOMRect(after.left + panel.clientLeft, after.top + panel.clientTop, panel.clientWidth, panel.clientHeight);
          for (const line of panel.querySelectorAll('p')) {
            const rect = line.getBoundingClientRect();
            if (!within(rect, inner)) failures.push(`${name}: "${line.textContent}" leaves the panel`);
            if (line.scrollWidth > line.clientWidth + 1 && getComputedStyle(line).textOverflow !== 'ellipsis') failures.push(`${name}: "${line.textContent}" is clipped without an ellipsis`);
          }
        }
        const center = document.querySelector('[aria-label="Current hand to beat"]')!;
        const meta = center.querySelector('p')!;
        (meta.firstElementChild as HTMLElement).textContent = 'Maximiliana Montgomery-Featherstonehaugh';
        const metaRect = meta.getBoundingClientRect();
        const centerRect = center.getBoundingClientRect();
        if (!within(metaRect, centerRect)) failures.push('center player line leaves the center');
        if (meta.getClientRects().length !== 1 || metaRect.height > 24) failures.push('center player line wraps');
        const range = document.createRange();
        range.selectNodeContents(meta.lastChild!);
        const typeRect = range.getBoundingClientRect();
        if (!within(typeRect, centerRect)) failures.push('"played <type>" is cut off');
        return failures;
      });
      expect(result).toEqual([]);
    });
  }
}

test.describe('coarse-pointer (touch) portrait', () => {
  test.use({ hasTouch: true });
  geometryTests('coarse');
});

test.describe('fine-pointer portrait', () => {
  geometryTests('fine');
});

// The tall tier starts exactly where its layout fits: at each class's threshold the fans show and nothing
// scrolls; one pixel below, the compact arrangement is used and still fits (layoutThresholds.ts).
test.describe('portrait height tiers at their thresholds (coarse pointer)', () => {
  test.use({ hasTouch: true });
  const boundaries = [
    { name: 'phone-tall-threshold', width: 360, height: PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX, portraitClass: 'phone' as const },
    { name: 'phone-below-tall-threshold', width: 360, height: PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX - 1, portraitClass: 'phone' as const },
    { name: 'tablet-tall-threshold', width: 600, height: PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX, portraitClass: 'tablet' as const },
    { name: 'tablet-below-tall-threshold', width: 600, height: PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX - 1, portraitClass: 'tablet' as const },
  ];
  for (const boundary of boundaries) {
    test(`${boundary.name} (${boundary.width}x${boundary.height}) fits with ${isTall(boundary) ? 'fans' : 'no fans'}`, async ({ page }) => {
      await startPortraitGame(page, { ...boundary, category: 'supported', orientation: 'portrait', pointers: ['coarse'] });
      await expectFitsWithoutScrolling(page);
      expect(await collectSizingViolations(page)).toEqual([]);
      const faceDown = page.locator('[aria-label="Game Table"] [aria-label="Face-down card"]').filter({ visible: true });
      await expect(faceDown).toHaveCount(isTall(boundary) ? 13 + 13 + 8 : 0);
      for (const name of CONTROL_NAMES) await expectTargetable(page, page.getByRole('button', { name, exact: true }), name);
    });
  }
});

for (const name of ['portrait-phone-minimum', 'portrait-tablet-768']) {
  test(`Tab reaches every control in portrait order with a visible focus indicator, and the keyboard activates them, at ${name}`, async ({ page }) => {
    const spec = findViewport(name);
    await startPortraitGame(page, spec);
    await waitForYourTurn(page);

    // Portrait's order (ui-ux.md §19.6.4, revised October 2, 2026), which is also its reading order. The hand's own
    // Tab stop arrives with M5-T04's listbox; until then Tab goes from Leave Game straight to Sort Rank.
    const reached: string[] = [];
    for (let step = 0; step < CONTROL_NAMES.length; step++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      reached.push(await focused.evaluate((element) => element.getAttribute('aria-label') ?? element.textContent?.trim() ?? ''));
      const outline = await focused.evaluate((element) => ({ width: parseFloat(getComputedStyle(element).outlineWidth), style: getComputedStyle(element).outlineStyle, visible: element.matches(':focus-visible') }));
      expect(outline.visible, `${reached.at(-1)} matches :focus-visible`).toBe(true);
      expect(outline.style, `${reached.at(-1)} outline style`).not.toBe('none');
      expect(outline.width, `${reached.at(-1)} outline width`).toBeGreaterThanOrEqual(2);
      expect(await contrastAgainstBackdrop(focused, 'outline', 'parent'), `${reached.at(-1)} outline contrast`).toBeGreaterThanOrEqual(3);
    }
    expect(reached).toEqual([...CONTROL_NAMES]);

    // Play is unavailable (nothing selected) but focusable; Enter and Space on it do nothing.
    const play = page.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toHaveAttribute('aria-disabled', 'true');
    await play.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await expect(page.getByRole('region', { name: 'You panel' })).toHaveAttribute('aria-current', 'true');
    await expect(page.getByRole('group', { name: 'Your hand' }).locator('[data-card-key]')).toHaveCount(13);

    // Sort Suit from the keyboard reorders the hand by suit.
    await page.getByRole('button', { name: 'Sort Suit', exact: true }).focus();
    await page.keyboard.press('Space');
    const suits = await page.getByRole('group', { name: 'Your hand' }).locator('[data-card-key]').evaluateAll((slots) => slots.map((slot) => slot.getAttribute('data-card-key')!.split('-')[1]!));
    const suitOrder = ['clubs', 'spades', 'hearts', 'diamonds'];
    expect(suits).toEqual([...suits].sort((a, b) => suitOrder.indexOf(a) - suitOrder.indexOf(b)));

    // Event Log opens from the keyboard (its dialog focus behavior is M5-T05's), and closes again.
    await page.getByRole('button', { name: 'Event Log', exact: true }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Event Log' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Pass is available while responding to East's Full House; Enter on it ends South's Turn.
    const pass = page.getByRole('button', { name: 'Pass', exact: true });
    await expect(pass).toHaveAttribute('aria-disabled', 'false');
    await pass.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('region', { name: 'You panel' })).toContainText('PASS');
  });
}

test('the approved colors meet WCAG AA against their composited backgrounds in portrait, including hover', async ({ page }) => {
  await startPortraitGame(page, findViewport('portrait-phone-minimum'));
  await waitForYourTurn(page);
  const play = page.getByRole('button', { name: 'Play', exact: true });
  const pass = page.getByRole('button', { name: 'Pass', exact: true });

  // Pass, enabled while responding, at rest and hovered.
  await expect(pass).toHaveAttribute('aria-disabled', 'false');
  expect(await pass.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(29, 95, 196)');
  expect(await contrastAgainstBackdrop(pass, 'color')).toBeGreaterThanOrEqual(4.5);
  await pass.hover();
  expect(await contrastAgainstBackdrop(pass, 'color')).toBeGreaterThanOrEqual(4.5);

  // Enabled Play needs a legal selection: the Play reason text of an unavailable Play must also meet 4.5:1.
  const hand = page.getByRole('group', { name: 'Your hand' }).locator('[data-card-key]');
  await hand.last().click();
  await expect(play).toHaveAttribute('aria-disabled', 'true');
  expect(await contrastAgainstBackdrop(play.locator('span').last(), 'color')).toBeGreaterThanOrEqual(4.5);
  // The enabled look is purely `aria-disabled="false"` styling, so it is measured by flipping that attribute.
  await play.evaluate((element) => element.setAttribute('aria-disabled', 'false'));
  expect(await play.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(31, 122, 67)');
  expect(await contrastAgainstBackdrop(play, 'color')).toBeGreaterThanOrEqual(4.5);
  await play.hover();
  expect(await contrastAgainstBackdrop(play, 'color')).toBeGreaterThanOrEqual(4.5);

  // Side and Sort buttons, at rest and hovered; panel text; center text.
  for (const name of ['Event Log', 'Check Discard Pile', 'Leave Game', 'Sort Rank', 'Sort Suit']) {
    const button = page.getByRole('button', { name, exact: true });
    await page.mouse.move(0, 0);
    expect(await contrastAgainstBackdrop(button, 'color'), `${name} at rest`).toBeGreaterThanOrEqual(4.5);
    await button.hover();
    expect(await contrastAgainstBackdrop(button, 'color'), `${name} hovered`).toBeGreaterThanOrEqual(4.5);
  }
  for (const name of ['West', 'North', 'East', 'You']) {
    const lines = page.getByRole('region', { name: `${name} panel` }).locator('p');
    for (let index = 0; index < await lines.count(); index++) {
      expect(await contrastAgainstBackdrop(lines.nth(index), 'color'), `${name} panel line ${index}`).toBeGreaterThanOrEqual(4.5);
    }
  }
  expect(await contrastAgainstBackdrop(page.getByRole('region', { name: 'Current hand to beat' }).locator('p').first(), 'color')).toBeGreaterThanOrEqual(4.5);

  // Every suit on a card face, including the approved Diamonds orange.
  const diamondsColor = await page.locator('[role="img"][aria-label$="of Diamonds"]').first().evaluate((element) => getComputedStyle(element).color);
  expect(diamondsColor).toBe('rgb(194, 65, 12)');
  for (const suit of ['Clubs', 'Spades', 'Hearts', 'Diamonds']) {
    const card = page.locator(`[role="img"][aria-label$="of ${suit}"]`).first();
    expect(await contrastAgainstBackdrop(card, 'color'), `${suit} on the card face`).toBeGreaterThanOrEqual(4.5);
  }
});

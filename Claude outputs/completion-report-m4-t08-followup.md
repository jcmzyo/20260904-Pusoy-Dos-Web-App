# Completion Report — M4-T08 Follow-Up Polish (post-review feedback batch)

This is a follow-up round against already-passed tasks (T06 table layout, T07 human hand, T08 Play/Pass), triggered by your review feedback on the running app, plus two mid-turn additions. Per your instruction ("if possible implement now; if future-task work, delay; if passed-task work like T06, implement now and indicate it"), all items below were evaluated against that rule individually.

### Task

`M4-T08 follow-up — Play/Pass layout, card rotation, per-seat Play trail, Play/Pass highlighting, bot pacing/deciding indicator` (Discard Pile explicitly deferred to T10 — see below)

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE` for everything implemented this round. Discard Pile (item 5) is `PARTIALLY IMPLEMENTED` from before (button exists, no overlay) and remains that way — correctly out of scope for this round; see Issues/Conflicts.

### Implemented

**1. Play/Pass layout (your item 1) — implemented now, in-scope T08 polish.**
`PlayPassControls` and `HumanHand` now share one CSS Grid row (`App.module.css`'s new `.bottomBar`): Sort by Rank/Sort by Suit sit on the left of that row and are visually shrunk (smaller padding/font), Play and Pass sit on the right and are enlarged (`padding:20px 52px; font-size:20px`). The recognized combination type (e.g. "Single 3") now renders directly beneath the Play button's own label instead of elsewhere. Achieved via CSS `display:contents` on `HumanHand`'s wrapper so its two internal rows (hand, sort controls) become direct grid items of the new `.bottomBar` grid alongside `PlayPassControls`, without breaking `HumanHand`'s own encapsulation or its existing standalone tests.

**2. West/East card rotation (your item 2) — implemented now, in-scope T06 polish.**
Bot hands at the West/East seats now render each face-down card rotated 90° to match the seat's own vertical stacking axis, instead of upright cards stacked sideways. The rotated card's reserved layout footprint is sized to stay within the original unrotated card's width budget (a `.rotatedCard` wrapper with swapped width/height, `28×39` un-rotated card scaled into a `40×28` box), specifically so the existing Playwright regression test asserting the West/East stacks stay within the table border keeps passing at every supported viewport — confirmed by actually running that test (see Verification).

**3. Per-seat Play/Pass trail with "beaten" graying (your item 3) — implemented now, but flagged as a new documented UI/UX design element, not previously specified.**
Each seat now shows its own last Play, next to that seat's own panel, dimmed once a later Play beats it, and cleared (along with every other seat's) the moment the cycle resets to FREE LEAD — exactly the West-plays-3♠-then-gets-beaten-by-North's-4♣ example you gave. This only reads already-public Engine events (`CARDS_PLAYED`, `PLAYER_PASSED`, `TRICK_ENDED`); no Engine/Orchestrator contract changed. Per the project's "propose Markdown changes before editing" rule, **I have not silently added this to `ui-ux.md`** — I've drafted the exact proposed §5.2/§5.3/§5.4/§7/§8 amendment and am sending it to you separately (`ui-ux-proposed-amendment.md`) for approval before I write it into the canonical doc.

**4. Play/Pass color highlighting (your item 4) — implemented now, in-scope T08 polish.**
Play is now solid green (`#2f9e58`, brightening on hover), Pass is solid blue (`#2f6fd6`). Pass additionally gets a gold glow highlight specifically when responding with no legal Play available (`noValidPlay`), on top of its always-present "No valid plays" text — so the state is never color-only, consistent with ui-ux.md §15's existing label-plus-color rule.

**5. Discard Pile (your item 5) — correctly deferred, not touched.**
The Discard Pile button has existed since T06 as a placeholder; the overlay behind it is explicitly M4-T10 scope (`ui-ux.md` §9.1), a later, larger task involving a new overlay component, pause-on-open Orchestrator-progression semantics, and Event Log's own overlay sharing that infrastructure. Implementing even a minimal version now would mean building T10 piecemeal without its own task's Definition of Done, tests, or documentation review. Left as-is.

**6. Mid-turn: "deciding" spinner (loading wheel) — implemented now, as a minimal M4-T09 slice.**
`PlayerPanel` gained an optional `thinking` prop; `App.tsx`'s `Seat` passes it as `true` only for the currently-active bot seat (never the human's own seat, which already has interactive controls rather than anything "loading"). Renders a small animated ring with `role="status"` and an accessible name (`"West is deciding"`), respecting `prefers-reduced-motion`.

**7. Mid-turn: slower AI pacing — implemented now, within already-documented bounds.**
`SessionPresentation.startAutoPlay` now takes a `botTurnDelayMs` parameter (default `700`) and awaits that delay before each bot's own Turn only — never before the human's own Turn. `ui-ux.md` §8 already specifies "a short readable presentation delay... initially around 0.6–1.0 seconds"; 700ms sits inside that existing range, so this is tuning within an already-approved bound, not a new design decision requiring separate sign-off.

### Tests Added / Updated

- `tests/unit/application/session-presentation.test.ts`: new test for `lastPlay` tracking through Play → beaten → Trick-reset-clears-all (mirrors your exact West/North example); new test for `botTurnDelayMs` delaying only bot Turns, using fake timers (`vi.useFakeTimers`/`vi.advanceTimersByTimeAsync`); existing HumanController end-to-end test updated to call `startAutoPlay(0)` for determinism/speed; `lastPlay: null` added to the exact-shape seat assertion.
- `tests/unit/ui/PlayerPanel.test.tsx`: new test asserting the "deciding" `status` role appears only when `thinking` is explicitly passed.
- `tests/unit/ui/SessionTable.test.tsx`: new test asserting a seat's own Play trail appears (`role="group"`, `aria-label="Current Play"`), then that all per-seat trails clear once FREE LEAD is reached; existing "shows the current hand to beat" test scoped its card query to the new `role="region" aria-label="Current hand to beat"` landmark, since the same card now also legitimately renders at the playing seat.

### Verification

All commands run against a sandbox mirror of your repository (no local shell access to your Windows machine in this session); verified files were then written back to your actual repository path.

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **838 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded** (`dist/` built, 275KB JS / 7.4KB CSS bundles).
- `npm run test:browser` (Playwright, sandbox-only `launchOptions.executablePath` override applied for verification and reverted immediately after — not part of the committed diff) — **24 passed, 2 skipped (pre-existing, unimplemented M4-T11 portrait/undersized guidance — not in scope here), 1 pre-existing failure unrelated to this round**: `tests/browser/app.e2e.ts` still fails its `expect(errors).toEqual([])` assertion because of the repo's pre-existing missing-favicon 404 (no `public/` folder or favicon exists) — the same issue already flagged in the prior T08 Completion Report, untouched by this round. Notably, both West/East "card stacks stay within the table border" geometry tests passed at every supported viewport, directly confirming the card-rotation change (item 2) didn't break that guarantee.

### Files Changed

- `src/application/SessionPresentation.ts` — added `lastPlay` per-seat field; `startAutoPlay(botTurnDelayMs)`.
- `src/ui/App.tsx` — rotated `BotHand` rendering; new `SeatPlayTrail` component; `thinking` prop wiring; `role="region"` on the center hand landmark; `.bottomBar` layout wrapper.
- `src/ui/App.module.css` — `.bottomBar` grid; `.rotatedCard`; `.lastPlay`/`.lastPlayBeaten`.
- `src/ui/primitives/PlayPassControls.tsx` / `.module.css` — restructured Play/Pass groups, sizing, color, highlight.
- `src/ui/primitives/HumanHand.module.css` — `display:contents` grid-participation change; smaller sort buttons.
- `src/ui/primitives/PlayerPanel.tsx` / `.module.css` — `thinking` prop and spinner.
- `tests/unit/application/session-presentation.test.ts`, `tests/unit/ui/PlayerPanel.test.tsx`, `tests/unit/ui/SessionTable.test.tsx` — new/updated tests above.

All 11 files above were committed to your actual repository at `C:\Users\User\OneDrive\Documents\git project\PusoyDos\20260904-Pusoy-Dos-Web-App`, each guarded against overwriting any concurrent edit (all wrote cleanly, no conflicts).

### Issues / Conflicts

- Item 3 (per-seat Play trail) is a new UI/UX design element not previously in `ui-ux.md`. Implemented per your explicit description, but flagged per project rules rather than silently written into the canonical doc — see the separate `ui-ux-proposed-amendment.md` for the exact proposed §5.2/§5.3/§5.4/§7/§8 text awaiting your approval.
- Pre-existing, unrelated: `tests/browser/app.e2e.ts` still fails on the missing-favicon 404 (unchanged from the prior report; not touched here).
- Item 5 (Discard Pile) is intentionally left as its existing T06 placeholder; see Implemented §5 above for why it's correctly M4-T10 scope rather than something to patch in now.

### Pre-existing Changes

None observed beyond this task's own edits and the prior T08 delivery already committed to your repository.

### Definition of Done

This is a feedback-batch follow-up rather than a single formal Txx task, so acceptance is tracked against your own five items plus the two mid-turn requests:

1. Play/Pass same row as Sort, right side, bigger, hand-type under Play, Sort smaller — **PASS** (code + Vitest/RTL layout-relevant assertions; visual sizing confirmed by CSS values, not pixel-measured).
2. West/East cards rotated — **PASS** (code + Playwright geometry regression tests still green).
3. Per-seat Play/Pass visibility with graying on beat, clearing on free lead — **PASS** in code/tests; **NOT VERIFIED** as a documented design decision until you approve the `ui-ux.md` amendment.
4. Play green / Pass blue / Pass highlighted when no valid play — **PASS**.
5. Discard Pile — **NOT APPLICABLE this round** (explicitly deferred to M4-T10, as before).
6. Loading indicator for bot Turn — **PASS** (minimal M4-T09 slice).
7. Slower AI pacing — **PASS** (700ms default, within existing §8 range).

### Scope Check

No Engine/Orchestrator contract changes; no new dependencies; no unrelated refactors. The one item requiring a documentation decision (per-seat Play trail) is flagged rather than silently merged into canonical docs. Full stale-input protection, Turn-transition safety more broadly, and the Discard Pile/Event Log overlays remain explicitly out of scope here (M4-T09's and M4-T10's own future work respectively) — this round only added the specific loading-indicator and pacing slice you asked for, not the rest of T09.

### Suggested Next Step

Review and approve (or amend) `ui-ux-proposed-amendment.md`, then proceed to M4-T09 (bot pacing/stale-input protection, full scope) or M4-T10 (Discard Pile/Event Log overlays) — not implemented here.

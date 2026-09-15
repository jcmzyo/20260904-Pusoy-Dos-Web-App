# Completion Report — M4-T08 Follow-Up Polish, Round 3

Third follow-up round.

### Task

`M4-T08 follow-up, round 3 — West/East card size, Play/Pass sizing stability, bottom-bar column alignment, finish/turn glow, spinner/trail interaction, bot pacing, card face readability`

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE` for everything implemented. Item 6 (4th-hand reveal) is confirmed as genuinely deferred, untouched — see below.

### Implemented

**1. West/East card size now matches North/South.** Both now render the same `widthPx={40}` card; the rotated wrapper was resized from a shrunk 40×28 box to a 56×40 box (the actual footprint a full-size card produces once rotated 90°), instead of shrinking the card itself to fit inside the old, smaller reserved space. Re-verified the West/East "stay within the table border" Playwright regression at all six supported viewports — still passes at the new, larger size.

**2. Play/Pass no longer change size.** Both buttons now have a fixed `width` and `min-height` sized to comfortably fit two lines, so neither button resizes when a recognized-combination/reason line (or the valid-Play glow) appears, disappears, or changes length; longer text wraps within the fixed width instead of stretching it.

**3. Bottom-bar layout corrected to actually align with North/South, with Play above Pass.** The bottom row now reuses the exact same three-column proportions as the table above it (west|center|east → left|sort|actions), so the Sort column is genuinely centered under North/South rather than just centered within its own arbitrarily-sized cell. Play now sits above Pass, both fixed to the right column. The left column is reserved (empty for now) for Event Log/Leave Game — see Issues/Conflicts below for why those aren't built yet.

**4. Spinner suppresses the Play trail.** While a bot's own "deciding" spinner is showing, that seat's Play/Pass trail is hidden (it's about to be replaced by whatever that seat decides next anyway).

**5. Finish/turn glow convention.** Each seat's panel now gets a colored glow, independent of its text status: gold for 1st place, silver for 2nd, bronze for 3rd, and a white glow for whoever's Turn it currently is — deliberately a different color from the "finished 1st" gold so the two are never confused. A 4th-place (or not-yet-placed) finish gets no special glow. This extends the medal-color convention already used at Session Summary to the live table itself.

**6. 4th-place hand not revealed at Round end — confirmed genuinely deferred, not a bug.** I checked the actual M4 task breakdown: the End-of-Round reveal (`SessionPresentationSnapshot.reveal`) is explicitly **M4-T12**'s own task, a future milestone task, not part of T06/T07/T08. The presentation layer already exposes the data (`reveal`), but no UI has ever rendered it — this was never built, rather than broken. Left untouched, per your own standing instruction to delay genuinely future-task work.

**7. Bot delay reduced to 0.8s** (from 1.5s last round). Still within `ui-ux.md`'s originally-documented 0.6–1.0s range, so — unlike last round's 1.5s — this number doesn't itself require a range change, though the pending doc amendment still needs updating to record the current value; see below.

**8. Center card face: removed the middle suit symbol, kept both corners.** `PlayingCard` no longer renders the large center pip — only the two corner rank/suit indices remain, which was the actual source of the two corners being visually harder to read at smaller sizes.

### Deferred / Explained Rather Than Implemented

- **Event Log and Leave Game buttons** (part of your requested left-column layout) are **not** implemented as even placeholder buttons this round. I checked the actual M4 task breakdown doc: unlike Discard Pile (explicitly called out as a T06 placeholder), Event Log and Leave Game are not listed anywhere in T06/T07/T08's own Work sections — they belong entirely to **M4-T10** (Event Log) and **M4-T11** (Leave Game), including the button itself, not just their overlay/confirmation behavior. Building even inert buttons for them now would be scope creep into those future tasks. Instead, I reserved the left column's width in the new three-column layout, so adding those buttons later needs no relayout — but visually there's currently empty space on the bottom-left where they'll eventually go. Flagging this explicitly rather than silently leaving a visual gap unexplained.

### Tests Added / Updated

- `tests/unit/ui/PlayerPanel.test.tsx`: new test asserting five genuinely distinct panel-glow states (idle, current-Turn, 1st, 2nd, 3rd) and that a 4th-place/unplaced finish gets no special glow (same look as idle).
- No other test files needed changes this round — the West/East sizing, button-sizing, and layout changes are covered by the existing Playwright geometry regression and don't change any queried role/text/structure.

### Verification

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **840 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted after) — **24 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from all three prior reports** (the favicon 404 in `app.e2e.ts`). One additional test (`human-hand.e2e.ts`'s drag-reorder test) failed once on the first run but passed cleanly on a 3x repeat and on a full second run — confirmed as a pre-existing flake in the drag-simulation timing, not a regression from this round's changes (nothing in this round touched hand drag/selection logic).

### Files Changed

- `src/application/SessionPresentation.ts` — `botTurnDelayMs` default → 800.
- `src/ui/App.tsx` — matching card size for West/East; spinner suppresses the Play trail.
- `src/ui/App.module.css` — `.bottomBar` now a 3-column grid matching `.table`; `.rotatedCard` resized to 56×40.
- `src/ui/primitives/Card.tsx` / `.module.css` — removed the center pip from `PlayingCard`.
- `src/ui/primitives/HumanHand.module.css` — comment update only (Sort's centering now driven by the shared column template).
- `src/ui/primitives/PlayerPanel.tsx` / `.module.css` — new glow convention (gold/silver/bronze/white), replacing the old single gold "active" glow.
- `src/ui/primitives/PlayPassControls.module.css` — fixed button width/min-height; Play stacked above Pass.
- `tests/unit/ui/PlayerPanel.test.tsx` — new glow test.

All 10 files were committed to your actual repository, each guarded against overwriting a concurrent edit (all wrote cleanly, no conflicts).

### Issues / Conflicts

- The pending `ui-ux.md` amendment (not yet written to the canonical doc) has been updated again to reflect this round's final state — West/East card sizing, the corrected three-column bottom-bar layout with Play above Pass, the new finish/turn glow convention, fixed Play/Pass sizing, and the 0.8s bot delay. Still awaiting your approval before I touch the canonical doc.
- The left column of the bottom bar is currently empty (reserved space, no visible button) since Event Log/Leave Game are M4-T10/T11 scope — see above.
- Pre-existing, unrelated: the favicon-404 Playwright failure, unchanged from all three prior reports.

### Pre-existing Changes

None observed beyond this task's own edits and the prior rounds already committed to your repository.

### Definition of Done

Tracked against this round's eight items:

1. West/East card size matches North — **PASS**.
2. Play/Pass no longer change size — **PASS**.
3. Sort aligned with North/South; Play above Pass, fixed right — **PASS** for the alignment/stacking; left column (Event Log/Leave Game) intentionally left empty/reserved, not built — **DEFERRED, explained above**.
4. Spinner hides the Play trail — **PASS**.
5. Gold/Silver/Bronze/White finish-and-turn glow — **PASS**.
6. 4th-place reveal after Round end — **confirmed M4-T12 scope, correctly not implemented**.
7. Bot delay → 0.8s — **PASS**.
8. Center card: corners only, no center suit — **PASS**.

### Scope Check

No Engine/Orchestrator contract changes; no new dependencies; no unrelated refactors. All changes are presentation-layer only. Event Log/Leave Game buttons were deliberately not added, per the task breakdown's own task ownership — flagged rather than silently built or silently left unexplained.

### Suggested Next Step

Review/approve the (now three-round) consolidated `ui-ux-proposed-amendment.md`, then decide whether to proceed to M4-T09 (full bot pacing/stale-input scope), M4-T10 (Discard Pile/Event Log — which would also finally add the Event Log button), or M4-T11/T12 (Leave Game / End-of-Round reveal) — none implemented here.

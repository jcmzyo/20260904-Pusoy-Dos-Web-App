# Completion Report — M4-T08 Follow-Up Polish, Round 5

Fifth follow-up round. Item 6 was a rules question, answered directly in the chat reply rather than here; items 1-4 are implemented and verified below. Item 5 is a scope question — see "Issues / Conflicts."

### Task

`M4-T08 follow-up, round 5 — round-end trail preservation, equal-length side buttons, stable middle-container width, table dimension stability`

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE` for items 1-4. Item 5 intentionally not implemented — a scope question is pending your answer.

### Implemented

**1. A finishing player's last Play no longer disappears the instant they finish.** Root cause: the Engine always emits a `TRICK_ENDED` event when a Trick ends — including when that same Trick also completes the Round (the 3rd-place finisher's own final Play). `SessionPresentation` was clearing every seat's Play/Pass trail on *every* `TRICK_ENDED`, including that one, wiping the very Play that just ended the Round an instant before anyone could see it (M4-T12's own End-of-Round reveal isn't built yet, so right now the table just sits there afterward). Fixed by checking whether that `TRICK_ENDED` is immediately followed by `ROUND_ENDED` in the same event batch (it always is, from `GameEngine.submitMove`) — only a genuine mid-Round reset (followed by `TURN_CHANGED`) clears the trails now; Round completion leaves everyone's trail as-is until you actually continue to the next Round.

**2. Event Log and Leave Game are now the same fixed length**, regardless of their own label length.

**3. The bottom bar's middle container no longer narrows as your hand shrinks.** Its width is now reserved for the maximum possible 13-card hand and held constant for the whole Round; a smaller hand just stays centered within that reserved space instead of shrinking the container (and shifting Sort/Play/Pass along with it).

**4. The table's own bordered box no longer resizes during a Round.** I traced this to several places where a seat's rendered content genuinely changed height/width over the course of a Round: West/East's bot-hand card stack shrinks from ~280px down toward 0 as cards are played, each panel could grow/shrink as its own Play trail badges wrapped differently for different combinations, and the center's "hand to beat" display varied between a single line (OPENING/FREE LEAD) and a fuller card row. Each of these now reserves its own worst case (a full 13-card hand, a wrapped 5-card trail, a full hand-to-beat row) and holds it constant for the whole Round — this reserves no more space than what already renders (and is already verified within the table border) at the very start of every Round; it just stops that space from later shrinking back down. Only resizing the actual browser window changes the table's size now.

### Tests Added / Updated

- `tests/unit/application/session-presentation.test.ts`: new test driving a full Round to completion and asserting the finishing player's own trail is still visible (not beaten) right after Round completion, and that it only actually clears once `continueToNextRound` is called.
- `tests/browser/table-stability.e2e.ts` (new file): a real-browser regression test that captures the table's bounding box right after Start Game, lets several bot Turns play out, and asserts the box is unchanged.

### Verification

- `npm run typecheck` — **passed**, no errors (one narrowing fix needed in the new test itself, corrected).
- `npm test` (Vitest) — **843 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after) — **25 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from all five prior reports** (the favicon 404 in `app.e2e.ts`). The new table-stability test passed, and the existing "West/East card stacks stay within the table border" regression still passes at every supported viewport (including the smallest, 667×375) with the new reserved sizes — confirming the reservation doesn't push anything outside the table border anywhere in the supported matrix.

### Files Changed

- `src/application/SessionPresentation.ts` — round-completion trail-preservation fix (item 1).
- `src/ui/App.module.css` — fixed-width side buttons (item 2); reserved bot-hand stack size, fixed-height center hand display (item 4).
- `src/ui/primitives/PlayerPanel.module.css` — fixed panel height (item 4).
- `src/ui/primitives/HumanHand.module.css` — fixed middle-container width (item 3).
- `tests/unit/application/session-presentation.test.ts`, `tests/browser/table-stability.e2e.ts` — new tests above.

All 6 files were committed to your actual repository, each guarded against overwriting a concurrent edit (all wrote cleanly, no conflicts).

### Issues / Conflicts

**Item 5 (fit the whole game on screen, no scrolling, adapt to resize) — flagging before implementing, rather than deciding this silently.** I checked why the existing Playwright test suite explicitly separates "elements are visible" from actual pixel-level overlap/scroll verification: `viewport-matrix.e2e.ts` has a comment stating outright that "pixel-level overlap/clipping verification across this matrix is M4-T14 (Full Responsive Hardening)," and the task breakdown's own M4-T14 is titled exactly that. A real guarantee of "no scrolling, ever, at every supported viewport including the smallest (667×375), with correct behavior across a live resize" is a substantially bigger piece of work than items 1-4 above — it would mean making every card size and every one of the fixed reservations I just added in item 4 responsive to viewport height too (not just holding them constant), and then re-verifying pixel-perfect fit across the whole frozen viewport matrix. That's squarely what T14 is already planned to do. Rather than either quietly doing a partial version of T14 under this round's polish, or quietly skipping your request, I'd like your call on scope before touching this — I've laid out the options in the chat reply.

- The pending `ui-ux.md` amendment (still not written to the canonical doc) has been updated for items 1-4 only; item 5 is deliberately left out of it until the scope question above is settled.
- Pre-existing, unrelated: the favicon-404 Playwright failure, unchanged from all five prior reports.

### Pre-existing Changes

None observed beyond this task's own edits and the prior four rounds already committed to your repository.

### Definition of Done

1. Finishing player's last hand stays visible through Round completion — **PASS**.
2. Event Log and Leave Game the same length — **PASS**.
3. Middle container's width doesn't shrink as held cards decrease — **PASS**.
4. Table border dimensions fixed during a Round — **PASS**.
5. Fit the whole game on screen without scrolling, adapting to resize — **NOT IMPLEMENTED**, scope question pending (see above).
6. Free-lead rules question — **ANSWERED** (in the chat reply, not a code change).

### Scope Check

Items 1-4: no Engine/Orchestrator contract changes, no new dependencies, no unrelated refactors; all presentation-layer only. Item 5 was deliberately not implemented pending your decision on whether it's this round's polish or M4-T14's own scope.

### Suggested Next Step

Answer the item-5 scope question in the chat reply, then decide whether to revisit `ui-ux-proposed-amendment.md` for approval now (items 1-4) or bundle it with item 5's resolution.

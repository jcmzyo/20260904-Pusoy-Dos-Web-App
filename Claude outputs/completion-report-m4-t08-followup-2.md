# Completion Report — M4-T08 Follow-Up Polish, Round 2 (bug fixes on the per-seat Play trail + button feedback)

Second follow-up round, addressing the bugs and refinements you found after trying the first round's changes.

### Task

`M4-T08 follow-up, round 2 — bot pacing, per-seat Play trail fixes, Play/Pass button redesign, Sort alignment` (Discard Pile confirmed still deferred to M4-T10)

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE`

### Implemented

**1. Bot delay increased to 1.5s.** `SessionPresentation.startAutoPlay`'s default `botTurnDelayMs` is now `1500` (was `700`). This exceeds `ui-ux.md` §8's currently-documented 0.6–1.0s range, so I've folded the range update into the same pending doc amendment rather than silently drifting past it — see the updated `ui-ux-proposed-amendment.md`.

**2. Per-seat Play trail bug fixes (your item 2):**
- **2.1 "Shrunk cards look weird"** — replaced the mini full-card rendering with a new compact `CardIndex` component (`Card.tsx`): just rank-over-suit, styled like the corner index already drawn on a real card, instead of an illegibly shrunk full card face.
- **2.2 "Put the cards where the spinner/PASS are, inside the darker green container"** — the trail now renders inside `PlayerPanel`'s own container via a new `playTrail` slot, alongside the status badge and spinner, instead of as a separate element beside the panel.
- **2.3 "Pass doesn't overwrite the grayed-out cards"** — fixed at the presentation layer: `SessionPresentation`'s `lastPlay` is now `null` the instant a seat itself Passes (even on a later Turn, after already Playing once this cycle), so PASS now replaces the old Play indicator instead of showing alongside it. Verified with a new test that plays out real gameplay and asserts the invariant "a passed seat never also shows a Play trail," and confirms the scenario actually occurs.
- **2.4 "5-card hands overlap the center"** — solved structurally by 2.1 + 2.2: the trail is now a real child of the CSS-Grid-managed seat panel (which can only grow its own grid cell, never overlap a neighboring one) rather than a free-floating sibling element, and the compact badges are far narrower than a 5-card row of mini `PlayingCard`s.

**3. Play button redesign (your item 3):**
- **3.1** Play now defaults to a neutral gray/white look and only turns green once the current selection is a valid, legal Play — previously it was always green, just dimmed when disabled.
- **3.2** The recognized-combination text / invalid reason / "No valid plays" now render as a smaller second line inside the button itself, for both Play and Pass, instead of as separate text below. The button's accessible name stays the fixed "Play"/"Pass" (via `aria-label`) so screen readers and tests aren't confused by the extra text, but that text is still exposed as an accessible description (`aria-describedby`) so nothing is lost for assistive tech.
- **3.3** A valid Play now gets the same glowing-yellow highlight treatment Pass already had for "no valid play" — so Play glows exactly when it's ready to submit.

**4. Sort alignment (your item 4).** Sort by Rank/Sort by Suit now sit centered under the hand (roughly the horizontal middle of the bottom bar) and are vertically centered against Play/Pass, instead of clinging to the bottom-left of their row. Play/Pass remain on the right, unchanged.

**5. Discard Pile — confirmed still M4-T10, untouched.** To directly answer your question: yes, this is future-task work. The button is a T06 placeholder; the overlay behind it (with its own pause-on-open Orchestrator semantics, shared with the Event Log) is M4-T10's own task, not something to build piecemeal inside a feedback round on T08. No code changed here.

### Tests Added / Updated

- `tests/unit/application/session-presentation.test.ts`: new test that plays out a real game where a seat Plays once and later strategically Passes, asserting the invariant "any seat with `passed: true` has `lastPlay: null`" holds throughout, and that the scenario is actually exercised (not vacuously true).
- `tests/unit/ui/SessionTable.test.tsx`: updated the existing per-seat-trail test to query the trail from inside the panel region directly (it's now a child of the panel, not a sibling reached via `.parentElement`).
- `PlayPassControls.test.tsx` and `PlayerPanel.test.tsx` needed **no changes** — their `getByRole('button', {name: 'Play'/'Pass'})` and `getByText(...)` queries kept working unchanged because the button's accessible name stays fixed and the feedback text is still plain visible text, just relocated inside the button.

### Verification

Same sandbox-mirror-then-commit-back workflow as before (no local shell access to your machine in this session).

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **839 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after) — **24 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from both prior reports** (the missing-favicon 404 in `app.e2e.ts`, still nothing to do with this round). The West/East geometry regression tests still pass at every viewport, confirming the per-seat trail's new bounded layout doesn't reopen the overlap problem.

### Files Changed

- `src/application/SessionPresentation.ts` — `botTurnDelayMs` default → 1500; `lastPlay` now `null` once the seat itself has passed.
- `src/ui/primitives/Card.tsx` / `.module.css` — new `CardIndex` compact corner-badge component.
- `src/ui/primitives/PlayerPanel.tsx` — new `playTrail` slot rendered inside the panel container.
- `src/ui/App.tsx` — `SeatPlayTrail` now uses `CardIndex` and is passed into `PlayerPanel` as `playTrail` instead of rendered beside it.
- `src/ui/App.module.css` — `.lastPlay` now wraps and bounds itself to its container's width.
- `src/ui/primitives/HumanHand.module.css` — Sort controls centered instead of bottom-left-aligned.
- `src/ui/primitives/PlayPassControls.tsx` / `.module.css` — restructured button markup (feedback text inside the button, `aria-label`/`aria-describedby` split), Play's neutral-vs-valid coloring, valid-Play glow.
- `tests/unit/application/session-presentation.test.ts`, `tests/unit/ui/SessionTable.test.tsx` — tests above.

All 12 files were committed to your actual repository, each guarded against overwriting a concurrent edit (all wrote cleanly, no conflicts).

### Issues / Conflicts

- The bot-delay range in `ui-ux.md` §8 (0.6–1.0s) is now out of date given the 1.5s default; folded into the still-pending `ui-ux-proposed-amendment.md` (updated and re-sent) rather than silently left inconsistent with the code.
- The §5.2/§5.4/§7 amendment text has also been updated to match this round's actual behavior (corner badges inside the panel, Pass overriding a prior Play badge, Play's neutral-vs-valid coloring). None of this has been written into the canonical `ui-ux.md` yet — still awaiting your approval.
- Pre-existing, unrelated: the favicon-404 Playwright failure, unchanged from both prior reports.

### Pre-existing Changes

None observed beyond this task's own edits and the two prior rounds already committed to your repository.

### Definition of Done

Tracked against this round's five items:

1. Bot delay → ~1.5s — **PASS** (default changed; doc range flagged for update).
2. Per-seat trail bugs (shrunk-card look, container placement, Pass-overwrite, 5-card overlap) — **PASS**, all four sub-issues addressed and covered by tests/geometry regressions.
3. Play button (gray/white default, text inside button, glow when valid) — **PASS**.
4. Sort centered and vertically aligned with Play/Pass — **PASS**.
5. Discard Pile — **confirmed deferred to M4-T10**, not implemented here (correctly out of scope).

### Scope Check

No Engine/Orchestrator contract changes; no new dependencies; no unrelated refactors. All changes are presentation-layer only, derived from already-public data. The one item requiring a documentation decision (per-seat Play trail, its exact behavior, and the bot-delay range) remains flagged rather than silently merged into canonical docs — still awaiting your review of `ui-ux-proposed-amendment.md`.

### Suggested Next Step

Review/approve the updated `ui-ux-proposed-amendment.md` (now covers both rounds), then proceed to M4-T09 (bot pacing/stale-input protection, full scope) or M4-T10 (Discard Pile/Event Log overlays) — not implemented here.

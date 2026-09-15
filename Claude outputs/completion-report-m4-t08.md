# Completion Report

### Task
`M4-T08 — Authoritative Play/Pass Feedback and Submission`

Plus a scope adjustment the user requested alongside it (originating from T07): cap the number of cards the human can select for a Play to the current Trick's exact card count while responding, or up to 5 while opening/on a free lead.

### Status
`COMPLETE`

### Implemented

**Play/Pass submission reaches the production Engine.**
- `SessionPresentation` gained three new public methods plus a private driver, all additive (no existing method signatures changed):
  - `getPendingHumanRequest(): PlayerTurnRequest | null` — duck-types onto the session's `humanController` via an internal `HumanInputExtras` interface (`getPendingRequest?`, `resolveMove?`), so `StartedSession<PlayerController>`'s generic contract (used throughout the existing test fixtures) is untouched.
  - `resolveHumanMove(requestId, move): boolean` — same duck-typing; delegates to the real `HumanController.resolveMove`.
  - `startAutoPlay(): void` — idempotent (a synchronous guard flag set before any `await`, safe under StrictMode's double-invoke) fire-and-forget loop that keeps calling `runTurn()` while `status === 'ROUND_ACTIVE'`, so the game actually keeps moving once bots have played and a human Turn becomes reachable. Judgment call flagged for review: nothing in T08's text asked for this, but without it no Turn is ever requested from `HumanController` in the production `App`, so Play/Pass would have nothing to submit against. Scope is deliberately minimal — no pacing, no stale-input guard against a Turn transition mid-selection; the method's own doc comment says pacing/stale-input protection is M4-T09's job.
  - Only `App.handleStart()` calls `startAutoPlay()` (never `SessionTable`), so the many existing tests that render `SessionTable` directly and drive Turns with their own manual loop are unaffected.
- New `PlayPassControls` component (`src/ui/primitives/PlayPassControls.tsx` + `.module.css`) re-derives Play legality from the snapshot using only the Engine's public exports (`inspectCombination`, `canBeat`, `generateLegalResponseMoves`, `defaultRuleset`) — the public package boundary (`src/engine/index.ts`) deliberately excludes `validateMove`, so the UI cannot reimplement or bypass that, it re-checks the same three conditions in the same order: recognized combination → Opening's required 3♣ → beats the current hand. Reason text matches ui-ux.md §7 verbatim: "Invalid combination", "Wrong number of cards", "Must include 3♣", "Doesn't beat <combination>" (via new `describeCombination` in `combinationLabels.ts`, which also now holds the `COMBINATION_LABELS` map previously private to `App.tsx`). "No valid plays" shows when responding with zero legal Plays left (computed via `generateLegalResponseMoves`), while Pass stays enabled. Pass is disabled during Opening/free lead per ui-ux.md §7. Selection clears automatically after a successful Play/Pass because the parent's `selectedCards` state is only ever populated by `HumanHand`'s own `onSelectionChange`, and `HumanHand` clears its internal selection whenever the incoming `cards` prop shrinks past what's selected (already-existing T07 behavior) — the human's hand shrinking after a Play triggers this via the normal snapshot update.
- `App.tsx`'s `SessionTable` now tracks the current selection, computes `isMyTurn`, and wires `HumanHand`'s `onSelectionChange` and `PlayPassControls`' `onSubmit` (`handleSubmit`) to `getPendingHumanRequest`/`resolveHumanMove`, guarding against submitting for the wrong pending request/player.

**Selection cap (T7 follow-up).**
- `HumanHand` takes a new required `maxSelectable: number` prop and an optional `onSelectionChange` callback. `toggleSelected` now refuses to grow the selection past the cap (existing selections and other cards remain fully interactive); a `useEffect` trims the current selection down (keeping the earliest-order cards) whenever `maxSelectable` drops below the current selection size — e.g., across a Turn transition from a 2-card Trick down to a 1-card Trick. `onSelectionChange` reports the current selection as `Card[]` in display order on every change.
- `App.tsx` computes the cap per the user's stated rule: `center.kind === 'hand' ? center.combination.cards.length : 5` (opening/free lead → 5).

### Tests Added / Updated
- `tests/unit/ui/PlayPassControls.test.tsx` (new) — 9 tests covering every feedback reason, the valid-selection/submit path, the not-my-turn no-op, and Pass availability/disablement rules.
- `tests/unit/ui/HumanHand.test.tsx` — added `maxSelectable` to every existing render call (a permissive cap of 5, chosen so no pre-existing T07 scenario changes behavior) and a new "Selection cap (M4-T08)" describe block (3 tests: blocks over-cap selection while leaving existing selections/other cards clickable, trims on a lowered cap keeping earliest-order cards, reports selection via `onSelectionChange`).
- `tests/unit/ui/App.test.tsx` — updated the full button-list assertion to include the new `Play`/`Pass` buttons.
- `tests/unit/application/session-presentation.test.ts` — added 2 tests: the duck-typed null/false path for a Controller without the pending-request/resolve-move contract, and an end-to-end test of a real `HumanController` through `startAutoPlay`/`getPendingHumanRequest`/`resolveHumanMove`, including that a stale/duplicate resolution of an already-consumed request is rejected and that a second `startAutoPlay()` call is a no-op.
- `tests/integration/ui/session-table-play-pass.test.tsx` (new) — renders the real `SessionTable` over a real `HumanController`/`GameRunner`/Engine (bots pick `legalMoves[0]`), drives bot Turns to reach South, starts (but does not await) South's Turn to populate the pending request, simulates clicking the exact cards of a legal Play (or Pass, if none exists) through the DOM, and asserts the Engine actually advanced (hand size shrank by the right count and the center now shows South's hand, or the current player moved off South) — proof the wiring reaches the production Engine, not a UI-side rule replica.
- `tests/browser/human-hand.e2e.ts` — updated the "overlapped cards stay independently targetable" Playwright test: at Session start the cap is 5 (free lead's `FREE_PLAY_MAX_CARDS`), so only the first 5 of 13 clicks now select; the test still clicks and asserts all 13 to keep proving independent hit-testing.

### Verification
All commands run from a same-content sandbox mirror of the repository (no `device_bash` is available for this device, so this is the only way to execute anything locally; the verified files were then copied back to the repository unmodified).

- `npm run typecheck` (`tsc --noEmit`): **PASS**, zero errors.
- `npm test` (`vitest run`): **PASS**, 71 test files, 834/834 tests passed.
- `npm run build` (`vite build`): **PASS**, built in 583ms.
- `npm run test:browser` (`playwright test`): 24 passed, 2 skipped (pre-existing, unimplemented M4-T11 portrait/undersized-guidance tests — not in scope here), **1 pre-existing failure unrelated to this task**: `tests/browser/app.e2e.ts` fails its `expect(errors).toEqual([])` assertion because the browser's automatic `/favicon.ico` request 404s (there is no `public/` folder or favicon anywhere in the repository) and that 404 surfaces as a console error the test collects. I did not touch `index.html`, favicon handling, or `app.e2e.ts`, and confirmed no `public/` directory exists in the actual repository — this is a pre-existing gap, not a regression from this task. Flagging it as `Issues / Conflicts` below rather than silently fixing it, per the "do not silently repair unrelated problems" instruction.
  - Environment note: this sandbox's pre-installed Chromium build (rev. 1194) doesn't match what `@playwright/test@1.63.0` expects (rev. 1243) by default; I ran with `launchOptions.executablePath` pointed at the pre-installed browser for this verification pass only, then restored `tests/browser/playwright.config.ts` to its original, unmodified content before committing anything back — that override is not part of the delivered changes.

### Files Changed

Created:
- `src/ui/primitives/PlayPassControls.tsx`
- `src/ui/primitives/PlayPassControls.module.css`
- `src/ui/primitives/combinationLabels.ts`
- `tests/unit/ui/PlayPassControls.test.tsx`
- `tests/integration/ui/session-table-play-pass.test.tsx`

Modified:
- `src/application/SessionPresentation.ts`
- `src/ui/App.tsx`
- `src/ui/primitives/HumanHand.tsx`
- `tests/unit/ui/HumanHand.test.tsx`
- `tests/unit/ui/App.test.tsx`
- `tests/unit/application/session-presentation.test.ts`
- `tests/browser/human-hand.e2e.ts`

All 12 files above were committed back into the actual repository at their original paths; `device_commit_files` reported all 12 written with zero rejections (no mtime drift since they were first read/staged).

### Issues / Conflicts
- Pre-existing, unrelated: `tests/browser/app.e2e.ts` fails on the missing-favicon 404 described above. Not caused by this task; not fixed, since fixing it (adding a favicon/`public/` asset) is outside T08's and the T7-cap adjustment's scope. Recommend a follow-up ticket if it should be silenced (e.g., add a favicon, or have the test ignore the specific 404 resource message).
- `startAutoPlay()` is a judgment call beyond T08's literal text, flagged above under Implemented — needed so a human Turn is ever reachable in the production `App`, deliberately minimal, with pacing/stale-input protection explicitly left to M4-T09 per its own doc comment.

### Pre-existing Changes
None. `git status`/`git diff` were verified against the actual repository before this session's implementation work began (per the earlier portion of this session, before context compaction): the branch was `dev/M4/T8-Authoritative_Play/Pass_Feedback_and_Submission-20260915`, confirmed both locally and on `origin` with a clean working tree. No pre-existing modifications were found or preserved from that check. (Note: `device_bash` is not available for this device, so `git status` could not be re-run after this session's file commits; the commit call's zero-rejection result confirms no file changed on disk between this session's read and its write, which is the available substitute for that check here.)

### Definition of Done
- Play button enabled only for a legal selection, disabled otherwise, with reason text matching ui-ux.md §7 exactly — **PASS** (`PlayPassControls.test.tsx`).
- Pass available while responding (including a strategic Pass with a legal Play available) and disabled during Opening/free lead — **PASS** (`PlayPassControls.test.tsx`, "Pass availability" describe block).
- "No valid plays" messaging when responding with zero legal Plays — **PASS**.
- Submission reaches the real Engine via `HumanController`/`GameRunner`, not a UI-side replica — **PASS** (`session-table-play-pass.test.tsx` integration test, and `session-presentation.test.ts`'s new end-to-end unit test).
- Selection clears/gaps close automatically after a successful Play — **PASS**, as a consequence of `HumanHand`'s existing (T07) cap/shrink behavior combined with the snapshot-driven `selectedCards` state; not independently re-asserted as a dedicated new test beyond what `HumanHand.test.tsx`'s "Selection cap" tests already cover for the shrink mechanics.
- Additional scope: Play selection capped to the current Trick's card count while responding, or 5 while free/opening — **PASS** (`HumanHand.test.tsx`'s "Selection cap (M4-T08)" tests, plus `App.tsx`'s `maxSelectableCards`).
- All focused + regression tests, typecheck, build pass — **PASS** (see Verification).
- Human manual acceptance per T08's own Manual Tests section ("Try representative invalid selections and confirm the reason is understandable. Confirm Pass remains available when you could play and clearly explains No valid plays when you cannot.") — **MANUAL VERIFICATION PENDING**. Checklist below; per project rules this cannot be self-certified.

### Manual Verification Checklist (MANUAL VERIFICATION PENDING)

A person must run these against the running app and report pass/fail/notes; none of this is inferable from automated results.

1. Start a game, wait for your turn (South).
2. Select 2 cards that form no valid combination (e.g. a 4 and a 7 of different suits). **Expect:** Play disabled, text reads "Invalid combination."
3. Select 4 cards (not a valid 4-card grouping — Pusoy Dos has no 4-card combination). **Expect:** "Wrong number of cards," Play disabled.
4. While responding to another player's hand, select something too weak to beat it. **Expect:** message names what you're up against, e.g. "Doesn't beat Pair of 9s," Play disabled.
5. On the game's very first play (Opening Move), select cards without the 3 of Clubs. **Expect:** "Must include 3♣," Play disabled. Add the 3♣. **Expect:** message clears; Play enables if otherwise valid.
6. Select a valid, beating (or valid opening/free-lead) combination. **Expect:** its name appears (e.g. "Pair of 5s"), Play enables. Click Play. **Expect:** cards leave your hand into the center/Discard Pile, selection clears, hand gap closes.
7. While responding, when you do have a legal beating card, click Pass instead. **Expect:** Pass is enabled and works — strategic Pass is allowed even with a legal Play available.
8. While responding, reach a state where nothing in hand can beat the current hand. **Expect:** feedback reads "No valid plays," Pass stays enabled.
9. During the Opening Move or immediately after a Free Lead reset (no hand to beat). **Expect:** Pass is disabled/grayed out.
10. (T7 follow-up) While responding to a single card, try selecting a second card. **Expect:** the extra click is a no-op — capped at 1.
11. (T7 follow-up) During Opening/Free Lead, try selecting a 6th card. **Expect:** no-op — capped at 5.

### Scope Check
No unrelated refactors, dependency changes, or formatting sweeps. `COMBINATION_LABELS` was moved (not changed) from a private constant in `App.tsx` into the new shared `combinationLabels.ts` module solely because `PlayPassControls` needed the same mapping — this is a pure relocation, not a behavior or contract change; `App.tsx` now imports it from the new location instead of defining it locally. No future-phase (M4-T09+, M4-T10 Discard Pile overlay, M4-T11 portrait/undersized guidance) functionality was implemented.

### Suggested Next Step
M4-T09 (per the task breakdown) — Turn pacing and stale-input protection across Turn transitions, which `startAutoPlay`'s doc comment explicitly defers to. Not implemented here.

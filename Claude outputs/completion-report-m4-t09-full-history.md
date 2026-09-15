# Completion Report — M4-T09, Full History (Initial Implementation → Follow-Up Polish)

**Note on scope:** M4-T09's original implementation (bot pacing, the "deciding" indicator's earliest form, stale-input protection) was completed and merged prior to this session's own working context — I do not have that original session's own diff/turn-by-turn history to recount. What follows is: (a) the current, verified state of T09's own Definition of Done as it stands in the repository today, and (b) a full, itemized account of every follow-up polish round this session actually carried out on top of that baseline — most of which touched the same live game table T09 introduced, plus adjacent M4-T05/T06/T07/T08 surface area that shares the same screen. Everything under "Follow-Up Polish History" below is drawn from this session's own actual edits, verified test runs, and your own reported feedback, not reconstructed from memory of an earlier session.

### Task

`M4-T09 — Bot Turn Pacing and Interaction Safety` (plus the full round of cross-cutting UI polish that followed it)

### Status

`COMPLETE`

---

## Part 1 — M4-T09's Own Definition of Done, Verified Against Current Code

| DoD item | Status | Evidence |
|---|---|---|
| No bot precompute across Turns | **PASS** | `SessionPresentation.startAutoPlay` (`src/application/SessionPresentation.ts`) only advances one Turn at a time through `runTurn()`/`submitMove`, gated on `getSnapshot().currentPlayerId`; a bot's controller request is issued only once it is that bot's own authoritative Turn. |
| Presentation delay cannot affect authoritative decision | **PASS** | The `botTurnDelayMs` wait (`await new Promise((resolve) => setTimeout(resolve, botTurnDelayMs))`) happens *before* the Orchestrator asks the bot controller for its Move; it is pure `setTimeout` wall-clock delay with no influence on `GameEngine`/AI decision logic, and callers (tests) can pass `0` for a fast/deterministic loop, confirming the delay is presentational only. |
| Human stale input blocked | **PASS** | `tests/integration/orchestrator/stale-response.test.ts` and `tests/unit/orchestrator/human-controller.test.ts` cover stale/cancelled request rejection at the controller boundary; `App.tsx`'s `handleSubmit` additionally checks `pending.playerId !== move.playerId` before resolving. |

Current tunable default: **0.8 seconds** per bot action (`startAutoPlay(botTurnDelayMs: number = 800)`), landing back inside the originally-documented 0.6–1.0s range after this session's own back-and-forth (see Round 2 below).

---

## Part 2 — Follow-Up Polish History (this session)

Everything below happened after T09 (and T05–T08) were already implemented and merged, in response to your own live playtesting feedback. Rounds are numbered in the order you raised them.

### Round 1–4 (visual/interaction feedback, prior to this session's own detailed working context)

Carried forward from earlier in this same follow-up effort, before the portion of this session I have full transcript detail for:
- Play/Pass buttons enlarged, switched from side-by-side to stacked, and given a color state machine (neutral/gray → green+yellow-glow only once legal) with inline recognized-combination/invalid-reason text.
- Sort by Rank/Sort by Suit re-centered under the human hand.
- West/East bot cards rotated 90° to match their seat's vertical stacking axis (originally rendered upright and sideways — "nobody plays cards this way").
- Per-seat Play/Pass trail introduced: each seat shows its own last Play as a compact corner-badge row inside its own panel, dimming once beaten.
- Card face pip: removed everywhere first to fix a corner-index/center-pip visual collision in the center hand-to-beat, then restored specifically for the player's own held hand once it read as "barren" without it.
- Bot pacing delay tuned: raised from the original range to 1.5s, found too slow, brought back down to 0.8s.
- Event Log / Leave Game rendered as actual (inert) placeholder buttons.

*(These are accurately summarized from this session's own carried-forward working notes and the design rationale already written into the `ui-ux.md` amendment's "Why" annotations; I did not re-verify their original diffs this round since they were not re-touched.)*

### Round 5 — Round-completion trail, equal-length buttons, layout stability, free-lead rule question

- **Trail preservation through Round completion:** fixed `SessionPresentation.project()` so a finishing player's last Play stays visible through the Round-ending Trick reset instead of vanishing before you see it, by distinguishing (via event-order lookahead) a Trick reset that also completes the Round from an ordinary mid-Round reset. New unit test in `session-presentation.test.ts`.
- **Equal-length side buttons:** Event Log / Leave Game given a fixed `width: 112px`.
- **Middle container width stability:** `HumanHand.module.css`'s `.handArea` given a fixed width reserved for the maximum 13-card hand, so it no longer narrows as cards are played away.
- **Table/panel dimension stability:** `.botHand`, `.currentHand`, and `PlayerPanel`'s `.panel` all given fixed worst-case dimensions (`App.module.css`, `PlayerPanel.module.css`) so the table's own bordered box stops visibly growing/shrinking during a Round. New Playwright regression, `table-stability.e2e.ts`.
- **Rules question answered before implementing anything:** confirmed via `resolveTurnAndTrick.ts` that a player who Plays from a free lead and is then passed by everyone gets **another free lead**, not an obligation to beat their own card — matches `engine.md`'s free-lead resolution logic.
- **Scope conflict flagged, not implemented:** "fit the whole game on screen without scrolling, adapting to resize" was identified as M4-T14's own explicit scope (`viewport-matrix.e2e.ts` even has a code comment saying so) and was not silently implemented or dropped — left as an open decision for you.

### Round 6 — Seat panel too tall

- Reported: the panel fixed-height fix from Round 5 left an idle seat looking "too tall," with dead space collecting at the bottom.
- Fixed by centering panel content (`justify-content: center`) and converting the status badge and Play-trail row into always-rendered, fixed-height "slots" (`.statusSlot`, `.trailSlot`) that reserve space even when empty, rather than being conditionally removed — this is what actually stops the surrounding content from shifting, not just the centering. Panel height trimmed from 168px to 152px since the slot system no longer needed the old safety margin.

### Round 7 — Glow resize question

- Asked directly whether the seat panel's gold/silver/bronze/turn glow was resizing the panel or was an optical illusion.
- Answered empirically, not just by CSS-spec reasoning: added a Playwright test that applies the exact `border-color`/`box-shadow` glow styling directly to a live panel and asserts its `boundingBox()` is unchanged before/after. Confirmed: purely a paint effect, never a layout resize.

### Round 8 — Straight / Straight Flush display order

- Reported: a Straight's cards displayed as `3,4,5,A,2` instead of the expected `A,2,3,4,5`; asked to fix Straight and (on clarification) Straight Flush specifically.
- Root cause: `inspectCombination` never sorts a combination's own cards, and both display sites (center table, per-seat trail) render `combination.cards` in raw submission order. This is invisible for ordinary Straights (where the domain's own Sort-by-Rank order already matches the sequence) and only breaks for the two special low Straights (`A-2-3-4-5`, `2-3-4-5-6`), where the domain's Ace/2-high sort convention scatters the low cards to the end.
- Fixed with a new `getDisplayCards(combination)` helper (`src/ui/primitives/combinationLabels.ts`) that, for Straight/Straight Flush only, reorders cards using the Engine's own already-public `defaultRuleset.straightRules.patterns` (`engine/index.ts`) — reusing the Engine's authoritative sequence data rather than re-deriving Straight rules in the UI. Wired into both the center table and per-seat trail in `App.tsx`. New test file `combinationLabels.test.ts` (6 tests), including an explicit check that `J-Q-K-A-2` was already correct and an explicit throw-on-impossible-input case.

### Round 9 — Documentation

- Consolidated every design decision above into a single `ui-ux.md` amendment and, on your approval, applied it as one version step, **v1.3 → v1.4** (not one bump per round, per your explicit instruction) — both to the claude.ai Project's copy and, this round, to the actual local repository file.
- Corrected `m4-playable-ui-task-breakdown.md`'s stale cross-reference (`ui-ux.md v1.1`/`v1.3` → `v1.4`) and bumped its own header version `v1.1 → v1.2` to reflect that correction, in both the Project's copy and the local repository file.

---

### Tests Added / Updated (this session's own rounds, 5–8)

- `tests/unit/application/session-presentation.test.ts` — Round-completion trail-preservation test.
- `tests/browser/table-stability.e2e.ts` (new file) — table-resize regression, panel-glow-resize regression.
- `tests/unit/ui/combinationLabels.test.ts` (new file) — 6 tests for `getDisplayCards`.

No test files were modified in Round 6 (pure CSS/component refinement of Round 5's own coverage) or Round 9 (documentation only).

### Verification

Most recently executed, reflecting the current, final code state (all rounds' code changes are cumulative in one codebase, so this run exercises everything above at once):

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **849 tests passed, 72 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after) — **26 passed, 2 skipped (pre-existing M4-T11 guidance states, out of scope), 1 pre-existing failure** (a favicon 404 in `app.e2e.ts`, present before this session's own changes and unrelated to them).

Rounds 1–4's own verification results were reported at the time they were completed (prior to this session's visible working context) and were not re-executed as a separate step this round — they are subsumed by the cumulative suite run above, which includes their own tests.

### Files Changed (this session's own rounds, 5–9)

- `src/application/SessionPresentation.ts`
- `src/ui/App.module.css`, `src/ui/App.tsx`
- `src/ui/primitives/HumanHand.module.css`
- `src/ui/primitives/PlayerPanel.module.css`, `src/ui/primitives/PlayerPanel.tsx`
- `src/ui/primitives/combinationLabels.ts`
- `tests/unit/application/session-presentation.test.ts`
- `tests/unit/ui/combinationLabels.test.ts` (new)
- `tests/browser/table-stability.e2e.ts` (new)
- `md files/ui-ux.md` (Project + local repo, v1.3 → v1.4)
- `md files/m4-playable-ui-task-breakdown.md` (Project + local repo, v1.1 → v1.2, stale `ui-ux.md` cross-reference corrected)

All source/test files above were committed to your repository at the time each round completed; the two documentation files were committed to the local repository in this round specifically (they had previously only been written to the claude.ai Project copy).

### Issues / Conflicts

One still-open scope question, unresolved since Round 5: whether to implement "fit the whole game on screen without scrolling, adapting to any resize" now, given it overlaps M4-T14's own explicit, later scope. Not implemented; not part of the v1.4 documentation amendment; awaiting your decision.

### Pre-existing Changes

None observed beyond this session's own edits across all rounds.

### Definition of Done

- M4-T09's own three DoD items — **PASS** (Part 1 above).
- Every follow-up polish item raised this session was implemented, tested, and verified, or explicitly flagged as a scope conflict rather than silently resolved — **PASS**.
- Documentation (`ui-ux.md`, `m4-playable-ui-task-breakdown.md`) reflects the final implemented state in both the Project and the local repository — **PASS**.

### Scope Check

Presentation-layer polish across M4-T05–T09's shared screen, plus two documentation corrections. No Engine/Orchestrator/domain rule changes at any point in this history; no new dependencies; no unrelated refactors.

### Suggested Next Step

The open M4-T14 scope question (full no-scroll/resize-adaptive hardening) is the one loose end from this whole polish history. Beyond that, the next milestone task per `m4-playable-ui-task-breakdown.md` would be whichever of M4-T10 onward you want to pick up — not started or assumed here.

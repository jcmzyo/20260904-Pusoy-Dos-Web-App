# Completion Report — M4-T08 Follow-Up Polish, Round 8

### Task

`M4-T08 follow-up, round 8 — Straight/Straight Flush display order`

### Status

`COMPLETE`

### Implemented

You reported that a Straight's cards render in a confusing order — your example was `3,4,5,A,2` where you expected `A,2,3,4,5` — and asked me to consider other cases too; you then clarified the scope was Straight and Straight Flush specifically.

Root cause: `inspectCombination` (Engine) preserves whatever order the cards were submitted in — it never sorts a combination's own cards — and both display sites (the center table's "hand to beat" and each seat's own Play trail) just render `combination.cards` as-is. For every ordinary Straight this happens to look fine, because the domain's own Rank order (`3...10,J,Q,K,A,2`, used for sorting your held hand) already matches the Straight's own ascending sequence. It only breaks for the two special low Straights, `A-2-3-4-5` and `2-3-4-5-6`, where A and/or 2 act as *low* cards for the sequence but still sort to the *end* under the domain's normal Rank order — producing exactly the `3,4,5,A,2` you saw.

Fixed with a new pure display-order helper, `getDisplayCards(combination)` (`src/ui/primitives/combinationLabels.ts`):
- For every combination type except Straight/Straight Flush, it returns the cards unchanged (their existing submission order is already correct and untouched).
- For Straight/Straight Flush, it looks up the matching pattern in `defaultRuleset.straightRules.patterns` (already exported from the Engine's own public package boundary, `src/engine/index.ts` — the same public config `PlayPassControls.tsx` already consumes) and reorders the cards into that pattern's own sequence. This reuses the Engine's own authoritative house-rule sequence data rather than re-deriving Straight validity/order in the UI, per `domain-model.md`'s caution against another module leaking or duplicating the Engine's internal combination representation.
- If a Straight/Straight Flush's ranks somehow don't match any of the 11 configured patterns (which the Engine guarantees can't happen for a real Combination), it throws rather than silently guessing an order — consistent with the project's "fail diagnostically, don't paper over impossible states" rule.

Wired into both places a combination's cards are displayed, in `src/ui/App.tsx`: the center table's current hand to beat, and each seat's own Play trail badge row.

"Consider other cases too" — checked and confirmed only these two special low Straights are affected. Normal Straights (`3-4-5-6-7` through `10-J-Q-K-A`) and `J-Q-K-A-2` already display correctly today (verified with an explicit test for `J-Q-K-A-2`, since a naive glance might expect A/2 to scatter there too — they don't, because the domain Rank order already places J,Q,K,A,2 consecutively). No other combination type (Single/Pair/Triple/Flush/Full House/Four-of-a-Kind) has an analogous "sequence" concept, so none of them needed a change.

### Tests Added / Updated

New file `tests/unit/ui/combinationLabels.test.ts` (6 tests):
- non-Straight types (Single, Full House) display in unchanged submission order;
- `A-2-3-4-5` Straight reorders correctly from the exact reported `3,4,5,A,2` input;
- `2-3-4-5-6` Straight Flush reorders correctly;
- a normal Straight (`6-7-8-9-10`, submitted out of order) still displays in ascending order;
- `J-Q-K-A-2` Straight Flush displays correctly (the "already fine" case, explicitly verified rather than assumed);
- an impossible/invalid Straight-shaped input throws rather than silently guessing.

### Verification

- `npx vitest run tests/unit/ui/combinationLabels.test.ts` — **6 passed.**
- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **849 tests passed, 72 test files, 0 failed** (843 prior + 6 new).
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after) — **26 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from every prior report** (the favicon 404 in `app.e2e.ts`). The full 6-viewport containment matrix and both `table-stability.e2e.ts` regressions (table resize, panel glow) still pass.

### Files Changed

- `src/ui/primitives/combinationLabels.ts` — new `getDisplayCards` helper.
- `src/ui/App.tsx` — both display sites (center table, per-seat Play trail) now call `getDisplayCards`.
- `tests/unit/ui/combinationLabels.test.ts` — new.

All three committed to your actual repository, guarded against overwriting a concurrent edit (wrote cleanly, no conflicts).

**Note on the previously-paused `table-stability.e2e.ts` commit:** I checked before touching anything this round — that file is already present in your repository with both tests (the table-resize regression and the glow-resize regression), byte-identical to what I verified last round. Nothing further was needed there; it must have gone through on an earlier attempt despite the pause you hit mid-flow. No action taken on it this round beyond confirming it's already correct.

### Issues / Conflicts

None. Item 5 from an earlier round (fit the whole game on screen without scrolling, across every viewport) remains a separate, still-unresolved scope question against M4-T14 — not touched here.

### Pre-existing Changes

None observed beyond this task's own edits and everything already committed in prior rounds.

### Definition of Done

- Straight's cards display in ascending house-rule sequence order rather than submission order — **PASS**.
- Straight Flush covered identically — **PASS**.
- Other combination types unaffected — **PASS** (explicit regression test).
- Change reuses the Engine's own public sequence data rather than reimplementing Straight rules in the UI — **PASS**.
- No silent fallback for an impossible input — **PASS** (throws, tested).

### Scope Check

Presentation-layer only (`src/ui`), a config-data read of the Engine's already-public `defaultRuleset` (same pattern already used by `PlayPassControls.tsx`), no Engine/Orchestrator/domain changes, no new dependencies, no unrelated refactors.

### Suggested Next Step

You mentioned this was "last change" for this round of polish — once you've had a chance to look it over, let me know if you're ready for me to write the consolidated amendment into `ui-ux.md` as v1.4 (still pending your go-ahead from the prior round), or if anything else needs adjusting first.

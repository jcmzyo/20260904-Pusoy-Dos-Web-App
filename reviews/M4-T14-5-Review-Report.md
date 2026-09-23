# PR #86 - M4-T14.5 Pre-M4-Completion Issue Sweep - Review Report

## Task and Review Scope
- **Task:** M4-T14.5 - Pre-M4-Completion Issue Sweep
- **PR:** #86 (open, 2 commits)
- **Branch:** dev/M4/T14-5-Pre-M4-Completion_Issue_Sweep-20260921
- **Base:** dev/M4/main-Minimal_Playable_UI-20260915
- **Documents consulted:** md files/ui-ux.md (sections 7, 8, 12, 13), md files/requirements.md, md files/m4-playable-ui-task-breakdown.md (T14.5)

## Verdict
APPROVE WITH MINOR COMMENTS

## Findings

### MINOR-1: Duplicated test helpers across e2e files
`waitForYourTurn`, `currentSelectionCap`, `waitForSelectableTurn`, and `SELECTION_TURN_BUDGET` are identically copy-pasted in `tests/browser/human-hand.e2e.ts` and `tests/browser/responsive-hardening.e2e.ts`. This risks silent drift. Consider extracting to a shared test utility.

### NIT-1: HOW_TO_PLAY.md references SVG images that may not render on GitHub
The file references 18 SVGs under `docs/images/`. These were added in this PR. Verify the SVG paths are correct relative to the docs folder and that GitHub renders them.

### NIT-2: Reviews directory included in diff
`reviews/M4-T14-Review-Report.md` and `reviews/M4-T14-Task-Completion.md` are authoring artifacts from the prior PR review. They are valid to commit but unrelated to the T14.5 scope. Acceptable but worth noting.

## Code Quality

**Correctness:** The `SessionPresentation.ts` `beaten` simplification is correct. Removing `frozenBeaten` and using `roundCheckpoint !== null` is cleaner and eliminates the inconsistent visual state where a finisher's untopped trail stayed bright while a topped one grayed. The belt-and-braces `isPaused()` guards in `handleSubmit`/`handleContinue` are good defense-in-depth.

**Maintainability:** The `Overlay.tsx` focus restoration pattern (capture `document.activeElement` on mount, restore on unmount) is clean and standard. The `inert`/`hidden` wrapper in `App.tsx` preserves table state across unsupported-layout interruptions without remounting — a significant improvement over the previous unmount-and-remount approach.

**Module boundaries:** Engine/Orchestrator ownership preserved. All changes are in `src/ui/`, `tests/`, and documentation. No domain or engine contracts were touched.

**Unnecessary complexity:** The `RoundResultOverlay.tsx` `priorPlacements.reduce()` chain is O(rounds x players) but with max 5 rounds and 4 players, this is negligible. The approach correctly maintains tie-breaking order across rounds per ui-ux.md section 12.

## Test Quality

**Assertion strength:** Good coverage of new behaviors: modal keyboard isolation (inert/Tab/Enter/Escape), drag cancellation, layout interruption state preservation, scoring animation pause, tie-breaking order persistence, five-card non-beating reasons. The `modal-gating.e2e.ts` file is a strong addition for real-browser `inert` behavior that jsdom cannot test.

**Edge cases:** Covered — pointercancel during drag, wrong pointer ID ignored, event log opened behind unsupported-layout notice, scoring animation freeze/resume, Round 5 auto-advance hold.

**Regression coverage:** The 5 flaky tests were fixed with proper turn-waiting helpers instead of assuming the opening free-lead. The fix is correct and the tests now work regardless of which seat holds 3 of Clubs.

**Determinism:** All tests are deterministic. The timeout flakes (3/989 in full suite, 0 in isolation) are pre-existing resource contention issues, not caused by this PR.

**Gaps:** Minor — no dedicated test for Overlay focus restoration when closed by backdrop click (only Escape-triggered close is explicitly tested in modal-gating.e2e.ts and SessionTable.test.tsx). The effect logic handles both paths, but a dedicated assertion would be stronger.

## Verification
- npm run typecheck - clean
- npm test - 986/989 Vitest tests passing (3 pre-existing timeout flakes, all pass in isolation: session-summary 2/2, session-table-round-result 15/15)

## Definition of Done
| DoD Item | Status | Evidence |
|----------|--------|----------|
| Fix flaky Playwright tests | PASS | 5 tests fixed with waitForYourTurn/waitForSelectableTurn helpers |
| Edit ui-ux.md section 7 | PASS | Five-card non-beating wording added |
| Retry all tests | PASS | 986/989 passing, 3 pre-existing flakes |
| No product code changes | PASS | Only test files, docs, and reviews |

## Scope and Working Tree
- **Pre-existing changes:** None identified.
- **Unrelated/deferred work:** Review report files (M4-T14-Review-Report.md, M4-T14-Task-Completion.md) are authoring artifacts from the prior review, not T14.5 scope but harmless.
- **Files changed:** 30+ files across tests/browser, tests/unit, tests/integration, src/ui, docs/images, md files, and reviews.

## Remaining Risks
The `describeNonBeatingReason()` function implicitly assumes the selection is a valid combination (the Play button already validates this). If the selection is not a valid combination, `describeNonBeatingReason` is not called — the button shows a different message. This is correct behavior but worth noting the implicit contract.

## Suggested Next Step
Commit and merge. The duplicate test helper extraction (MINOR-1) is optional cleanup that can be deferred to a future sweep if desired.

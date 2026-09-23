# PR #91 - M4-T15 Stabilization: session-summary/App.test.tsx Acceptance Failures - Review Report

## Task and Review Scope
- **Task:** M4-T15 stabilization round (acceptance failures on PR #87)
- **PR:** #91 (open, 2 commits: 87f0fba + e962cf1)
- **Branch:** dev/M4/T15-Phase_1_End-to-End_Acceptance_and_Regression_Gate-20260922
- **Head commit verified locally:** e962cf148e33669af7ca3a6e1527dcde51476c08 (matches PR head; re-review 2)
- **Base:** dev/M4/main-Minimal_Playable_UI-20260915
- **Documents consulted:** md files/orchestrator.md (GameRunner yieldToMacrotask lifecycle guard), md files/requirements.md, md files/ui-ux.md (section 10 unload warning)
- **Working tree:** clean; no pre-existing changes

## Verdict
APPROVE WITH MINOR COMMENTS

## Findings

### MINOR-1 (RESOLVED in re-review 2): No permanent regression test for the unmount-cleanup fix
Commit `e962cf1` adds two well-formed, deterministic regression tests under `Session teardown on unmount (M4-T15 stabilization round, review finding MINOR-1)` in `tests/unit/ui/App.test.tsx`:
- Test 1 asserts unmounting `<App>` with a still-live Session calls `session.destroy()` exactly once (the leak regression), using an `engineRng: { next: () => 0 }` seed and a prototype `destroy()` spy — deterministic, no real timing dependency.
- Test 2 asserts a Session already torn down explicitly via Leave Game is **not** destroyed a second time on unmount — this specifically guards the naive `[session]`-keyed-cleanup double-destroy regression, and it is a meaningful assertion (a leaked second call would still be recorded by the spy even though `destroy()` is internally idempotent).

Both pass: `npx vitest run tests/unit/ui/App.test.tsx` → 20/20. MINOR-1 is resolved.

### MINOR-2 (new, re-review 2): Original M4-T15 acceptance-gate report is overwritten in-place
Commit `e962cf1` rewrites `reviews/M4-T15-Task-Completion.md`, replacing the previously-committed Phase 1 End-to-End Acceptance and Regression Gate report (the full record of the acceptance gate: 989/989 Vitest, 4/4 M3 batch, 121/121 Playwright, and the executed human-acceptance checklist verdict) with the PR #91 stabilization report under the same filename. The original record is still recoverable via git history, but merging this PR erases it from the working tree's documentation trail. Suggest keeping the two reports distinct — e.g. restore the original gate report and add the stabilization report as a separate file (`M4-T15-Stabilization-Task-Completion.md`) — or otherwise record both, so the acceptance-gate evidence remains available on the merged branch. The committed review report also carries stale metadata from round 1 (says "1 commit", head 87f0fba, with MINOR-1 open).

### NIT-1: `sessionRef.current = session` written during render
Writing a ref during render is slightly against the latest React guidance for concurrent safety. In this specific case it is acceptable: the ref only ever needs the latest `session` at unmount, `destroy()` is idempotent (SessionPresentation.ts:268), and there is no scenario where a stale ref would destroy a live Session erroneously. The `started` ref at App.tsx:65 uses the same pattern.

## Code Quality

**Correctness — the core fix is sound.** The empty-dependency effect `useEffect(() => () => sessionRef.current?.destroy(), [])` (App.tsx:95) runs its cleanup only on a true unmount, reading the latest Session from the ref. Because `destroy()` is guarded by `if (this.destroyed) return;` (SessionPresentation.ts:268-269) and is documented idempotent "across React StrictMode" (SessionPresentation.ts:166), the fix is safe in all three interaction paths:
- Ordinary `handleLeave`/`handlePlayAgain` (session → null): cleanup does not re-fire during the transition because deps are empty, and even if it did later at unmount, the session is already null in the ref.
- React StrictMode initial double-mount (`main.tsx` wraps in `<StrictMode>`): the fake unmount cleanup fires when `session` is still null (app starts at Home), so it is a no-op.
- RTL `afterEach(cleanup)`: the leak that previously left an unattended `driveTurns` loop is now closed, reducing cross-test CPU contention — the demonstrated root cause of the reported flakiness.

**Maintainability:** The comment above the effect (App.tsx:83-92) explains the repair, the reasoning for empty deps, and the alternates considered and rejected. This is exactly the level of documentation the workflow asks for on a non-obvious invariant.

**Module boundaries:** No Engine/Orchestrator contract changes. GameRunner.ts, the approved lifecycle guard, and MessagePort cleanup are untouched (verified — not in the diff). The production change is confined to the UI shell's teardown responsibility.

**Test timeout raises (20000 → 45000ms):** Justified — not a bare number change. The reasoning (one real, un-fake-timer-mockable macrotask per autoplay Turn; bounded ~35s worst case under 8x synthetic CPU oversubscription) is documented inline in both files, and the measured figure provides real headroom while still failing on a genuine hang.

**beforeunload `waitFor` hardening (App.test.tsx:388-392):** Legitimate fix. The final expectation is unchanged (strictly `toBe(false)`); `waitFor` only tolerates the startup instant where the `[session, sessionResult]` effect has not yet attached the listener, by dispatching a fresh Event each retry. No assertion was weakened.

## Test Quality
- The three timeout raises target the measured bottleneck (real macrotasks across a five-Round Session) and are documented with reproduced evidence.
- The `waitFor` change turns a single-shot, race-prone dispatch into a retried dispatch against the same strict expectation — an improvement, not a weakening.
- The leak-fix regression coverage (MINOR-1) is now on record and is deterministic; test 2 in particular would catch the specific double-destroy regression a naive `[session]`-keyed cleanup would reintroduce.
- Existing exact-call-count and Play Again/Home/warning assertions are preserved.

## Verification (performed locally, Node 24)
- Re-review 2 (head `e962cf1`): `npx vitest run tests/unit/ui/App.test.tsx` → 20/20 passed (incl. the two new regression tests); `npm run typecheck` → clean; `npm test` → 1000 passed, 2 failed (both the pre-existing `session-table-round-result.test.tsx` timeout flakes; that file passes 15/15 in isolation and is untouched by this PR)
- Re-review 1 (head `87f0fba`):
  - `npx vitest run tests/unit/ui/App.test.tsx tests/integration/ui/session-summary.test.tsx` → 20/20 passed
  - `npx vitest run tests/integration/ui/session-table-round-result.test.tsx` → 15/15 passed (isolation)
  - `npx vitest run tests/unit/application/session-presentation.test.ts` → 34/34 passed (isolation)
  - `npm test` → 997-1000 passing; the only failures are the pre-existing timeout flakes in `session-table-round-result.test.tsx` / `session-presentation.test.ts` (files untouched by this PR), all of which pass in isolation — same flakes tracked across prior PRs, not caused by this change
  - `npm run typecheck` → clean

## Definition of Done
| DoD Item | Status | Evidence |
|----------|--------|----------|
| Root-caused the reported flakiness | PASS | Orphaned autoplay loop leak reproduced (2→91 calls at 500ms), fix verified (2→2 flat) |
| Established reliable startup readiness | PASS | beforeunload assertion wrapped in waitFor, same strict expectation |
| Deterministic, bounded Session progression | PASS | Fix + documented timeout raise with measured ~35s worst case |
| Fixture cleanup / outstanding async work checked | PASS | Real defect found and fixed; no leaks remain |
| Preserved assertions | PASS | No assertion values weakened, only retry/timeout mechanics |
| Preserved lifecycle guard / MessagePort cleanup | PASS | GameRunner.ts untouched |
| Production code changed only on demonstrated defect | PASS | Leak proven with before/after counts |
| Full verification suite run and reported | PASS | Author reports all commands; reviewer independently confirmed tests + typecheck |

## Scope and Working Tree
- Review made no file modifications.
- Local working tree clean; HEAD matches PR head commit e962cf1.
- **Pre-existing changes:** none.
- **Unrelated/deferred work:** production/test diff is confined to the three files (App.tsx, App.test.tsx, session-summary.test.tsx); the two reviews/*.md files committed in e962cf1 are review artifacts (see MINOR-2).
- **Note:** the full-suite flakes (session-table-round-result, session-presentation) remain unresolved pre-existing issues but are outside this PR's scope and predate it.

## Remaining Risks
- The leak fix depends on `destroy()` idempotency; the unit test at SessionPresentation.ts already covers the idempotent-destroy contract, so this dependency is verified.
- Full-suite timeout flakes persist for two test files, but are unrelated to this PR and were failing before it.
- If MINOR-2 is left as-is, the original M4-T15 acceptance-gate report is absent from the merged working tree (recoverable only via history).

## Suggested Next Step
Address MINOR-2 (keep the original gate report separate from the stabilization report), then merge. The pre-existing flakes in session-table-round-result.test.tsx and session-presentation.test.ts remain open as separate issues.
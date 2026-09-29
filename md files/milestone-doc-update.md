# Pusoy Dos --- September 11, 2026 Milestone Documentation Update

**Last Modified:** September 29, 2026
**Purpose:** Record the documentation changes made after approval of the M2 Baseline AI algorithm and M3/M4 milestone planning decisions.

## New milestone documents

- `m2-baseline-ai-headless-task-breakdown.md` (v1.1 at time of this update)
- `m3-simulation-reliability-task-breakdown.md` (v1.1 at time of this update)
- `m4-playable-ui.md` (v1.0 at time of this update)

## Updated design documents

- `requirements.md` v1.14
- `ai.md` v1.5, from v1.4
- `orchestrator.md` v1.6, from v1.5
- `testing-simulation.md` v1.7, from v1.6
- `ui-ux.md` v1.2, from v1.1

## Material decisions synchronized

1. M2 Baseline AI is now explicitly the deterministic hybrid selected by research: exact memoized hand decomposition + lightweight contextual evaluation + strategic PASS + deterministic tie-breaking.
2. PASS is a first-class AI candidate while responding even if legal beating Plays exist.
3. Exact minimum-play decomposition moved from older deferred richer-AI material into required M2 Baseline scope.
4. Initial AI no longer claims Basic+Competitive, Easy/Normal/Hard, or personality support. Those remain deferred.
5. M3 now explicitly requires structured failure traces, reproducible failed-seed replay, and regression-fixture workflow.
6. M4 is landscape-first, supports non-fullscreen/windowed web play inside a controlled viewport/aspect-ratio envelope, preserves card ratio and readable/usable text/controls, and gracefully rejects portrait/undersized gameplay layouts.

## Files not semantically changed

- `domain-model.md` (v1.3): no new shared domain concept is required by these decisions.
- `engine.md` (v1.7): Engine legality/rules authority is unchanged; AI decomposition/strategy remains outside Engine authority.
- `m1-task-breakdown.md` (v2.5): M1 scope is unchanged.
- `AGENTS.md`: existing project-wide workflow remains valid; no new coding-agent behavior is required solely by these milestone decisions.

## Conflict resolution

The prior AI document still described Basic + Competitive, Easy/Normal/Hard, Optimizer/personality behavior, and richer AI capabilities as initial implementation. That conflicted with the currently approved Phase 1 Baseline-only roadmap and has been corrected in `ai.md` (v1.5).

The prior requirements deferred the richer minimum-play solver. The researched M2 decision now explicitly requires exact memoized minimum-play decomposition for the Baseline Bot, so that requirement has been updated.

No canonical Pusoy Dos house rule was changed.

## September 15, 2026 — M3-T11 follow-on

- M3 task breakdown v1.2 adds M3-T11, its acceptance criteria, task map/dependency order, and milestone completion requirement.
- Testing strategy v1.8 defines readable console/file traces, explicit private-hand diagnostics, information safety, and unchanged deterministic replay.
- README documents the runnable command, options, exit codes, and current headless implementation status.
- Requirements v1.14 already authorize M3 diagnostic tracing; shared domain, Engine, Orchestrator, and AI contracts are unchanged. Earlier version references above record the September 11 update, not current versions.
- The application package version remains 0.1.0; this update increments the affected design-document versions rather than declaring a product release.


## September 15, 2026 — M4 detailed UI planning synchronization

- Phase 1 Start Game now begins the fixed Basic Session immediately; a future setup screen remains an extension seam rather than a current screen.
- Manual bounded hand rearrangement is now committed Phase 1 scope. Selection and hand order are independent; sorting/reordering preserves selection.
- The table center uses current hand-to-beat plus a Discard Pile overlay; Event Log is a bottom-area popup with latest-event preview. Both pause progression.
- Bot hands use overlapping card backs plus count; bots decide only when their authoritative Turn begins.
- After 3rd place finishes, the 4th-place remaining hand is revealed briefly, sorted by Rank, before the Round Result overlay.
- Round Result is a dimmed-table overlay with staged Round-score application and standings reordering; Session Summary uses official final ordering and gold/silver/bronze placement treatment.
- M4 testing now explicitly uses Vitest/RTL + focused Playwright browser tests + human-observable manual acceptance. Codex may write/run automated tests and write the manual checklist, but humans execute subjective/manual checks.
- `requirements.md`, `orchestrator.md`, `testing-simulation.md`, `ui-ux.md`, `m4-playable-ui.md`, and `AGENTS.md` were synchronized where required. `domain-model.md`, `engine.md`, `ai.md`, and completed M1-M3 task plans require no semantic change from these UI decisions.

## September 29, 2026 — Phase 2 M5–M8 planning synchronization

- Saved the supplied phase-2-expansion-plan.md in this directory; the approved accessibility clarification is recorded as an addendum without rewriting the supplied plan.
- Requirements v1.17 commits M5–M8 while preserving all house rules and completed M1–M4 task plans.
- UI/UX v1.12 adds portrait and scoped keyboard/focus/reduced-motion contracts. Existing landscape-phone 14px/44×44px exemptions remain; portrait minimums and exact interactions are approved/frozen in M5-T01.
- New tutorial.md owns scenario/objective/content boundaries. Domain v1.4, Engine v1.8, Orchestrator v1.7, and AI v1.7 clarify ownership without changing runtime APIs or Baseline strategy. A substantial setup API change requires a concrete compatibility review/approval at M6-T01.
- Testing v1.9 adds deterministic scenario falsification, responsive/browser/input acceptance, mandatory accessibility evidence, and human-verification requirements.
- Added four milestone design/task breakdowns using M4's task-section format, with explicit dependencies, Must Read documents, automated/manual checks, and task/milestone DoD. Detailed contracts/content remain gated by their initial planning tasks; no implementation is claimed.
- Updated AGENTS.md committed scope and UI-task guidance plus README planning links/status. HOW_TO_PLAY.md remains an accurate current-product guide; M7 owns delivery-time synchronization.
- User approved the document change set and tutorial.md, retaining landscape-phone sizing exemptions, and promoting keyboard/focus and reduced motion to mandatory scoped requirements. No full accessibility-standard certification, new game mode, hidden-hand reveal, dependency, persistence, or future-phase commitment was approved.

## Phase 2 follow-up — Play Choice and Comprehensive How to Play

- User specified main menu Play → choice window → Tutorial / Basic Game, with Tutorial running guided scripted gameplay.
- Replaced the earlier Phase 2 immediate Start Game/no-choice assumption in current requirements, UI, tutorial, and M7/M8 plans. M5 retains immediate entry only as its intermediate checkpoint; M1–M4 historical plans remain unchanged.
- Promoted the reference from concise-only to comprehensive How to Play directly accessible from the main menu, including organized rules, worked examples, scoring/tiebreaks, and controls. In-context reference access remains available.
- Added choice/cancel/startup-uniqueness, direct guide access, keyboard/focus, and human content-discovery acceptance checks. No runtime implementation, new Engine mode, or game-rule change.

## Phase 2 follow-up — Authored Five-Round Tutorial

- Added tutorial-script.md with player copy, guided beats, exploration/choice boundaries, eight learner-played combination categories, history/control practice, strategy tradeoffs, finisher continuation branches, and unrestricted fifth Round.
- Included five complete unique-card deals and Engine-checked guided traces. Verified 13 prefix alternatives and one complete five-Round Session through real Engine validation/invariants, with production Baseline bot decisions after authored handoffs.
- Synchronized requirements, tutorial contract, M6/M7 task inputs, testing strategy, and expansion-plan clarification. No runtime implementation or canonical game-rule change; human comprehension remains unverified.

## Documentation Review Follow-up — Tutorial Fixture Reproduction

- Clarified that tutorial deal tables define order-insensitive 13-card assignments per seat, not a unique raw shuffle output or RNG sequence. Preserved the explicit Round 5 seed recipe.
- Distinguished author-reported external probe evidence from the reviewer's independently corroborated results. M6-T01 now requires a repository-contained fixture test and reproducible command using existing APIs, with an explicit test-only exception to its planning-task verification exemption.
- Retained cosmetic link encoding, intentional Markdown hard breaks, and historical M1 scope wording; no rules or production code changed.

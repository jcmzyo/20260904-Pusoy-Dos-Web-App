# Pusoy Dos --- September 11, 2026 Milestone Documentation Update

**Last Modified:** October 2, 2026
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

## September 29, 2026 — M5-T01 frozen portrait, input, and accessibility contract

- User approved the M5-T01 proposal: a 360×560 portrait minimum; portrait cards 56–96px wide, all 13 in one row with at least 24px exposed and a selected-card rise of at least 16px; literal 14px/44×44px minimums in portrait; Shift+Arrow card reordering; WCAG 2.2 AA contrast with Diamonds `#c2410c`, Play `#1f7a43`, and Pass `#1d5fc4`; and the rest of the proposal as written.
- UI/UX v1.13, from v1.12, adds §19.6 "Frozen M5 portrait, input, and accessibility contract":
  - the pre-M5 baseline;
  - classification and guidance;
  - portrait geometry and overflow;
  - keyboard, focus, and disabled-feedback rules;
  - contrast and non-color cues;
  - reduced motion;
  - task allocation.

  §19.1, §19.3, and §19.4 now point to it.
- Testing v1.10, from v1.9, adds "Frozen M5 acceptance matrix and evidence assignments": portrait, landscape, and transition cases with the expected guidance per pointer type; automated assertions; and browser/device evidence assignments that keep every requirements §12.5 target.
- The M5 breakdown moves to v1.1 with an M5-T01 Approval Record. The M6, M7, M8, and tutorial.md headers now cite UI/UX v1.13 and Testing v1.10.
- Review follow-up (M5-T01):
  - added the coarse 844×389 "Rotate your device" boundary row;
  - added the `portrait-phone-se-toolbar` (375×553) exclusion row;
  - added an explicit focus-indicator assertion (outline at least 2px, contrast at least 3:1);
  - added this log entry.
- The landscape contract, requirements, rules, dependencies, and runtime code are unchanged. No portrait behavior is implemented yet.

## September 30 – October 1, 2026 — M5-T02 portrait spare-height rule and review follow-up

- User approved (September 30, M5-T02 review) a portrait layout rule for M5-T03: the table and opponent area stays at its natural height and is never stretched; spare height goes to the bottom controls section, not the table center.
- UI/UX v1.14, from v1.13 (September 30, 2026):
  - §19.6.3 adds the "Spare vertical height" bullet;
  - §19.6.7 records that M5-T02 also delivered the unsupported-layout notice's focus entry and return (§19.6.4).
- The M5, M6, M7, M8, and tutorial.md headers now cite UI/UX v1.14 (October 1, 2026).
- README notes that its `portrait-unsupported` row is superseded since M5-T02 and that the table itself is updated in M5-T07.
- No other contract, requirement, rule, or dependency changed.

## October 2, 2026 — M5-T03 portrait layout revisions

- User approved (October 2, M5-T03 review) these portrait contract revisions, recorded in the M5 breakdown's M5-T01 Approval Record under "Revisions":
  - **Table height:** the table takes spare height first, up to 5/8 of the viewport height, and the controls get the rest. This supersedes the September 30 spare-height rule.
  - **Height tiers:** a tall tier from 662px for phones and 690px for tablets (`PORTRAIT_PHONE_TALL_MIN_HEIGHT_PX`, `PORTRAIT_TABLET_TALL_MIN_HEIGHT_PX`). In it, opponents show their face-down fan again (restored on phones; M5-T01 had removed it) and the human's own panel is stacked. Below it there is no fan and the human's panel is a one-row strip, so 360×560 still fits. Phones still have no per-seat Play trail.
  - **Controls and Tab order:** portrait reads Event Log / Discard Pile / Leave Game, the hand, Sort Rank / Sort Suit, then Pass | Play (Play on the right), and its Tab order follows: Event Log → Discard Pile → Leave Game → hand → Sort Rank → Sort Suit → Pass → Play. Landscape is unchanged.
  - **Card width:** held and center cards keep the 56px floor, take at most 14.5vw, and are capped at 88px on touch devices and 72px in a fine-pointer (desktop) window.
- UI/UX v1.15, from v1.14 (October 2, 2026): §19.6.3 records the above, plus the compact panel's separate "deciding" row, the fixed Pass/Play, Sort, and utility-button sizes, and room for the human panel's glow; §19.6.4 records the portrait Tab order.
- The M5, M6, M7, M8, and tutorial.md headers now cite UI/UX v1.15.
- Deferred findings recorded in the M5 breakdown: the portrait Session Summary's Round-by-Round table (M5-T06) and the clipped focus outline in the Leave Game confirmation (M5-T05).
- No requirement, rule, Engine/Orchestrator contract, or dependency changed.

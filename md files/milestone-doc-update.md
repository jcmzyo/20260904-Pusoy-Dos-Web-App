# Pusoy Dos --- September 11, 2026 Milestone Documentation Update

**Last Modified:** September 11, 2026  
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

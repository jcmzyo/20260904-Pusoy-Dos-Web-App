# Pusoy Dos --- M3 Headless Simulator + Reliability

## Milestone Design Document (v1.0)

**Status:** Approved design baseline for later task decomposition  
**Last Modified:** September 11, 2026  
**Milestone:** M3 --- Headless Simulator + Reliability  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.13  
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.6  
**AI design:** `ai.md` v1.5  
**Testing strategy:** `testing-simulation.md` v1.7

---

# 1. Milestone Goal

M3 turns the working M2 headless game into a deterministic reliability and debugging harness.

M2 proves that a game can complete. M3 proves that the same production game can survive repeated varied deals and that any failure can be reproduced and analyzed.

```text
Production Engine + Orchestrator + Controllers
                    ↓
             Seeded Simulator
                    ↓
       Invariants / failure detection
                    ↓
          Structured trace + report
                    ↓
              Deterministic replay
```

A valid shuffled/dealt game must always have a legal route to a terminal Basic result. A failing seed is diagnostic evidence of a software/controller defect until proven otherwise; it must not be dismissed as an unlucky or unplayable deal.

---

# 2. Scope

M3 includes:

- deterministic single-Session simulation;
- seeded batch execution;
- reuse of production Engine/Orchestrator/controllers;
- invariant checks at meaningful lifecycle boundaries;
- stuck/nontermination safeguards;
- structured simulation tracing;
- compact normal-run summaries;
- rich failure artifacts;
- deterministic replay by seed/configuration;
- regression-fixture workflow for confirmed bugs;
- basic engineering/performance metrics;
- M3 reliability acceptance runs.

---

# 3. Non-Goals

M3 does not become:

- a second gameplay implementation;
- an AI tournament framework;
- difficulty balancing infrastructure;
- personality analysis;
- production analytics;
- persistent player statistics;
- a UI;
- a performance-optimization project;
- a Monte Carlo AI rollout engine.

---

# 4. Production-System Requirement

The simulator must exercise the same production flow used by M2:

```text
Simulator
   ↓
GameRunner / Orchestrator
   ↓
PlayerControllers
   ↓
Game Engine
```

It must not reproduce Turn/Trick/scoring/rules logic inside `/simulation`.

---

# 5. Deterministic Simulation

Every simulation run must be identifiable by enough configuration to reproduce its authoritative behavior.

At minimum this includes:

- Engine shuffle/deal seed;
- Session/run identifier or batch index;
- rules/mode configuration;
- controller/bot configuration that materially affects behavior.

For the deterministic Phase 1 Baseline Bot, no separate AI RNG seed is required because the AI contains no random decision mechanism.

The same seed + same relevant configuration + same software version must reproduce the same authoritative game sequence unless an intentional code change modifies deterministic AI policy or game behavior.

---

# 6. Logging and Diagnostic Trace System

M3 requires a structured logging/trace facility specifically suitable for simulation analysis.

Two practical levels are expected.

## 6.1 Normal batch record

Successful runs should remain compact. Useful data includes:

- seed;
- Session result;
- Round count;
- total turn/action count;
- outcome/placement summary;
- invariant status;
- elapsed simulation time;
- optional aggregate AI decision metrics.

## 6.2 Failure / replay trace

When a simulation fails, capture enough context to locate the first incorrect transition rather than only the final exception.

A failure artifact should contain, where applicable:

- failure type;
- simulation/batch index;
- seed;
- Round number;
- turn/action index;
- current player;
- current hand to beat / Trick state;
- proposed Move;
- legal Move set at that decision;
- relevant PlayerView;
- recent and/or complete factual Engine events;
- invariant/error message;
- exception and stack trace if present;
- Baseline `DecisionTrace` / decision components where available;
- authoritative state snapshot around failure when required for developer diagnosis.

Developer-only failure artifacts may contain authoritative private state where required to diagnose Engine defects. Such data must never become AI input or normal user-facing information.

---

# 7. Failure Analysis Workflow

The intended defect loop is:

```text
batch discovers failure
        ↓
record seed + configuration + trace
        ↓
replay exact failing Session
        ↓
identify first incorrect transition
        ↓
fix production code
        ↓
add focused automated regression coverage
        ↓
replay original failing seed
        ↓
rerun broader deterministic batch
```

A confirmed simulation bug is not considered fully resolved until the failing behavior is protected by a focused automated regression test and/or retained deterministic reproduction fixture appropriate to the defect.

---

# 8. Invariant Integration

M3 should invoke M1 Engine invariants at appropriate points rather than waiting for visible failure.

Examples include:

- all 52 cards accounted for exactly once where applicable;
- no duplicate physical card;
- valid current player;
- acting player is eligible/current;
- accepted Move is legal;
- played cards are actually removed;
- finished player has zero cards and is not returned to normal rotation;
- Trick state is coherent;
- no duplicate finish placement;
- completed Round rejects normal progression;
- Basic placements/scores are valid;
- exactly five Rounds compose the Session;
- Session totals match Round aggregation;
- completed Session cannot progress.

The simulator may add harness-level assertions, but it must not redefine Engine rules.

---

# 9. Stuck / Nontermination Detection

The rules should terminate naturally, so abnormal nontermination is a defect signal.

The simulator must have generous diagnostic guards capable of detecting cases such as:

- excessive Turn/action count;
- repeated state without legitimate progress;
- controller request cycle that never resolves in the test harness;
- invalid/no current player when play should continue;
- lifecycle checkpoint that cannot advance.

Thresholds are safety guards, not new gameplay rules.

When triggered, they must produce a normal failure artifact with seed and trace information.

---

# 10. Metrics

M3 should collect engineering metrics useful for reliability and future evaluation, such as:

- Sessions attempted/completed/failed;
- Rounds completed;
- Turns/actions per Round/Session;
- Pass frequency;
- invariant failure count/type;
- failure seed(s);
- simulation duration;
- AI decision duration summary;
- decomposition states/cache metrics where tracing is enabled.

These are simulation diagnostics, not persistent player statistics.

---

# 11. Acceptance Batch Philosophy

Do not define M3 correctness as a fixed performance race such as "10,000 games under X seconds."

Batch size should be configurable and selected to provide meaningful variation on the available machine.

M3 acceptance should use a documented deterministic seed set/batch with:

- zero unexplained legality/invariant/lifecycle failures;
- zero silent skipped failures;
- zero unresolved nontermination;
- reproducible results;
- sufficient diagnostics if a run does fail.

Large/long simulation suites should be separable from fast local smoke tests.

---

# 12. Definition of Done

M3 is COMPLETE only when:

- [ ] Simulator executes the production GameRunner/Orchestrator rather than a second game loop.
- [ ] Production Engine and M2 controllers are used unchanged by the simulator except through documented interfaces/instrumentation.
- [ ] One Session can be run from an explicit deterministic seed/configuration.
- [ ] The same seed/configuration reproduces the same authoritative behavior for the same software/policy version.
- [ ] Multiple seeded Sessions can execute as a batch.
- [ ] Successful batch logging is compact enough for repeated execution.
- [ ] Structured failure artifacts capture sufficient context to diagnose the failing transition.
- [ ] Failure artifacts include at minimum the seed and relevant run/Round/action location.
- [ ] Baseline AI decision trace can be included when AI decision analysis is needed.
- [ ] A failing seed can be replayed individually.
- [ ] Invariants execute at documented lifecycle boundaries.
- [ ] Silent card duplication/loss, illegal accepted Moves, invalid Turn ownership, finished-player corruption, score corruption, and lifecycle corruption are detectable.
- [ ] Stuck/nontermination safeguards fail loudly and produce reproducible diagnostic output.
- [ ] Simulation failures are never silently skipped or dismissed as bad deals.
- [ ] Confirmed bugs receive focused regression coverage and/or a retained deterministic reproduction fixture before being considered resolved.
- [ ] Useful engineering metrics are reported.
- [ ] A documented reliability acceptance batch completes with zero unresolved failures.
- [ ] M1 and M2 regression/integration tests pass.
- [ ] Typecheck and applicable build/test commands pass.
- [ ] No M4/deferred product feature is required for M3 completion.

**Technical deliverable:**

> A deterministic, reproducible headless simulation and diagnostic harness that repeatedly exercises the real production game, fails loudly on corruption or nontermination, records analyzable traces, and can replay failed seeds for debugging and regression protection.

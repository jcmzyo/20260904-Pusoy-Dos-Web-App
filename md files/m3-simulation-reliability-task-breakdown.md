# Pusoy Dos --- M3 Headless Simulator + Reliability

## Milestone Design + Task Breakdown (v1.1)

**Status:** Approved milestone design and implementation task plan  
**Last Modified:** September 14, 2026  
**Milestone:** M3 --- Headless Simulator + Reliability  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.14  
**Shared model:** `domain-model.md` v1.3  
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


---

# 13. Task Breakdown

## 13.1 Task Planning Principles

M3 tasks are sized for short, isolated coding-agent cycles. Each task has one primary responsibility, an observable technical result, focused verification, and explicit scope boundaries.

M3 is a **reliability/debugging milestone**, not an AI-balancing milestone. Every simulator path must exercise the production M2 GameRunner/Orchestrator, controllers, and Engine rather than creating a simplified simulation-only game loop.

A task is COMPLETE only when every task-specific Definition of Done item is satisfied. If required verification cannot run, report the task as **PARTIAL / NOT VERIFIED**.

## 13.2 Task Map

| Mini-milestone | Tasks | Technical checkpoint |
|---|---|---|
| MM1 Deterministic run contract | M3-T01–T02 | One explicit seed/config can run a production Session |
| MM2 Reliability detection | M3-T03–T05 | Invariants, traces, and nontermination failures are diagnosable |
| MM3 Reproduction | M3-T06 | A failing Session can be replayed exactly |
| MM4 Batch harness | M3-T07–T08 | Multiple deterministic Sessions run with compact metrics/reporting |
| MM5 Regression workflow | M3-T09 | Confirmed simulation bugs become retained regressions |
| MM6 Acceptance | M3-T10 | M3 reliability criteria are verified end-to-end |

**Total: 10 tasks.**

---

## M3-T01 — Define Simulation Configuration and Run Identity

### Goal

Create the deterministic simulator configuration contract needed to identify and reproduce one Session.

### Work

Define the smallest simulation-facing configuration containing, as applicable:

- Engine shuffle/deal seed;
- run/session identifier;
- Basic ruleset/config identity;
- seat/controller configuration that materially affects behavior;
- optional software/version metadata when available.

The Phase 1 Baseline Bot has no random decision seed.

Do not run a Session yet and do not introduce AI difficulty/personality configuration.

### Tests

Verify:

- equal configuration values compare/serialize consistently;
- different seeds/run identities remain distinguishable;
- required deterministic reproduction fields are retained;
- no hidden game state is used as configuration input;
- no separate AI RNG is required for Phase 1.

### Expected Result

The simulator has one explicit, serializable description of the inputs required to reproduce a production Session.

### Definition of Done

- [ ] Simulation configuration/run identity types compile.
- [ ] Engine seed and relevant production configuration are explicit.
- [ ] Baseline AI randomness is not invented.
- [ ] Configuration can be recorded in diagnostics/replay metadata.
- [ ] Focused tests/typecheck pass.
- [ ] M1–M2 regressions remain green.
- [ ] No Session execution or batch loop is added.

---

## M3-T02 — Implement Single Seeded Production Session Runner

### Goal

Run exactly one headless Basic Session from an explicit M3 configuration through the production M2 execution path.

### Work

Implement a thin simulator runner:

```text
SimulationConfig
      ↓
production GameRunner / Orchestrator
      ↓
production Baseline controllers
      ↓
production Engine
      ↓
Session result
```

The simulator may observe execution but must not decide Turns, legality, Trick flow, scoring, or Session completion.

### Tests

Verify:

- explicit seed/config initializes one Session;
- production controllers and GameRunner are used;
- exactly five Rounds complete on a known-good deterministic fixture;
- same seed/config produces the same authoritative result for unchanged code/policy;
- no simulation-specific rules path exists.

### Expected Result

One deterministic M2 production Session can be invoked through a reusable M3 runner.

### Definition of Done

- [ ] Single-Session runner accepts explicit M3 configuration.
- [ ] Production GameRunner/Engine/controllers are reused.
- [ ] Known deterministic Session completes.
- [ ] Repeated unchanged run reproduces authoritative outcome.
- [ ] No duplicated gameplay loop/rules logic exists in `/simulation`.
- [ ] Focused integration tests, M1–M2 regressions, and typecheck pass.

---

## M3-T03 — Integrate Runtime Invariant Checking

### Goal

Detect state corruption as close as practical to the transition that causes it.

### Work

Invoke existing M1 Engine invariants at documented lifecycle points, especially after accepted Moves and relevant Round/Session transitions. Add harness-level assertions only for simulator concerns that are not gameplay rules.

The simulator must not redefine rule semantics.

### Tests

Verify detection of representative invalid fixtures/mocked failures such as:

- card duplication/loss;
- invalid/current-player inconsistency;
- finished player incorrectly active;
- incoherent Trick state;
- duplicate finish placement;
- invalid completed-Round progression;
- invalid Basic scores/Session aggregation;
- completed Session progressing again.

Tests may use controlled invalid fixtures without changing production behavior.

### Expected Result

Invariant corruption fails immediately with a clear invariant/error signal rather than surviving until a later symptom.

### Definition of Done

- [ ] Engine invariants run at documented M3 lifecycle boundaries.
- [ ] Harness-only assertions are clearly separated from game rules.
- [ ] Representative corruption is detected.
- [ ] Successful valid Sessions remain unaffected.
- [ ] Focused tests/regressions/typecheck pass.
- [ ] No failure-report formatting beyond minimal test output is required yet.

---

## M3-T04 — Implement Structured Trace and Failure Artifact Capture

### Goal

Capture enough information around a failure to identify the first incorrect transition.

### Work

Add a structured simulation trace/failure artifact containing, where available:

- failure type;
- run/batch index;
- seed/config;
- Round and turn/action location;
- current player;
- Trick/hand-to-beat context;
- proposed Move;
- legal Moves;
- relevant safe `PlayerView`;
- recent or complete factual Engine events;
- invariant/error message;
- exception/stack;
- Baseline `DecisionTrace` when available;
- developer-only authoritative snapshot when needed for diagnosis.

Successful runs should not emit the same verbose trace by default.

### Tests

Verify:

- synthetic invariant/exception/controller failures create artifacts;
- seed and action location are always present when known;
- trace order is deterministic;
- developer-only private state is not exposed through player-facing/AI-facing paths;
- successful normal execution can remain compact.

### Expected Result

A failed single Session produces a structured, inspectable diagnostic artifact rather than only a final exception.

### Definition of Done

- [ ] Failure artifact schema is implemented.
- [ ] Seed/config and failure location are captured.
- [ ] Relevant Move/legal/event context is available.
- [ ] AI DecisionTrace can be attached without altering decisions.
- [ ] Developer-only authoritative snapshots remain diagnostic-only.
- [ ] Success-path logging remains compact.
- [ ] Focused tests/regressions/typecheck pass.

---

## M3-T05 — Add Nontermination and Progress Guards

### Goal

Fail loudly when software/controller defects prevent a Session from making legitimate progress.

### Work

Add generous diagnostic safeguards for cases such as:

- excessive Turn/action count;
- repeated state without legitimate progress;
- controller request that never resolves under the test harness;
- invalid/no current player while play should continue;
- Round Result/lifecycle checkpoint that cannot advance.

Thresholds are diagnostics, not game rules, and must be set well above realistic valid play.

### Tests

Use controlled test doubles/fixtures to verify each guard:

- triggers deterministically;
- produces a normal failure artifact;
- includes reproduction metadata;
- does not declare a winner or alter scoring;
- does not trigger on representative valid Sessions.

### Expected Result

A stuck run terminates as a reproducible diagnostic failure instead of hanging indefinitely.

### Definition of Done

- [ ] At least one bounded action/progress safeguard exists.
- [ ] Relevant stuck/lifecycle failure classes are detectable.
- [ ] Guard thresholds are documented as non-gameplay diagnostics.
- [ ] Guard failure produces the same structured artifact path as other failures.
- [ ] Valid representative Sessions do not false-trigger.
- [ ] Focused tests/regressions/typecheck pass.

---

## M3-T06 — Implement Deterministic Single-Session Replay

### Goal

Replay a recorded run/failure using its seed and relevant configuration.

### Work

Provide a replay entry point that accepts recorded M3 reproduction metadata and executes the same production Session path.

Replay must not require hand-editing hidden state or bypassing production initialization for normal seeded reproduction.

### Tests

Verify:

- successful recorded Session reproduces authoritative event/result sequence for unchanged code;
- synthetic/known failing run re-triggers at the same relevant point while the defect remains;
- replay mismatch is reported explicitly;
- trace/logging settings do not change authoritative outcome.

### Expected Result

A seed/config from a failure report can be run individually and compared against its original deterministic execution.

### Definition of Done

- [ ] Replay accepts recorded simulation metadata.
- [ ] Same unchanged seed/config reproduces authoritative behavior.
- [ ] Replay mismatches are visible failures.
- [ ] Trace verbosity/instrumentation does not change gameplay.
- [ ] Focused tests, M1–M2 regressions, and typecheck pass.
- [ ] No batch functionality is required yet.

---

## M3-T07 — Implement Configurable Seeded Batch Runner

### Goal

Execute multiple independent deterministic Sessions without changing the single-Session production path.

### Work

Build a batch coordinator that:

- receives an explicit seed list/range/generator configuration;
- invokes the T02 single-Session runner for each Session;
- records batch/session indices;
- stops on invariant corruption by default during development;
- never silently skips a failing seed;
- keeps large batches separable from fast smoke runs.

Do not add AI tournament ranking or difficulty comparisons.

### Tests

Verify:

- requested seeds execute in deterministic order;
- all successful Sessions are counted;
- a failing seed is reported, not omitted;
- fail-fast behavior works;
- rerunning the same batch/config produces equivalent outcomes.

### Expected Result

The project can repeatedly exercise varied production Sessions through one deterministic batch harness.

### Definition of Done

- [ ] Multiple seeded Sessions can execute.
- [ ] Batch order/configuration is reproducible.
- [ ] Failure cannot be silently skipped.
- [ ] Fail-fast default is explicit.
- [ ] Fast smoke batches and larger reliability batches can be configured separately.
- [ ] Focused tests/regressions/typecheck pass.
- [ ] No AI balancing/tournament framework is added.

---

## M3-T08 — Add Compact Metrics and Batch Reporting

### Goal

Summarize reliability and engineering behavior without turning simulation output into persistent gameplay statistics.

### Work

Aggregate/report metrics such as:

- Sessions attempted/completed/failed;
- Rounds completed;
- turns/actions per Round/Session;
- Pass frequency;
- invariant/guard failure counts and types;
- failing seeds;
- simulation duration;
- AI decision-duration summary;
- decomposition/cache metrics where instrumentation is enabled.

Normal successful output should stay compact; failed runs link/attach richer diagnostics.

### Tests

Verify:

- aggregate counts match controlled batches;
- failed Sessions are included in attempted/failed totals;
- metrics do not affect deterministic outcomes;
- optional AI instrumentation absence does not break reporting;
- repeated identical batch produces equivalent semantic metrics aside from wall-clock duration.

### Expected Result

A batch produces concise reliability/performance evidence plus clear failure references.

### Definition of Done

- [ ] Reliability metrics are aggregated correctly.
- [ ] Performance is measured, not converted into arbitrary pass/fail SLA.
- [ ] Diagnostics remain separate from persistent player statistics.
- [ ] Optional instrumentation is handled safely.
- [ ] Compact success report and failure references exist.
- [ ] Focused tests/regressions/typecheck pass.

---

## M3-T09 — Establish Failed-Seed Regression Fixture Workflow

### Goal

Turn confirmed simulator-discovered defects into durable, focused regression protection.

### Work

Define the repository convention for retaining a deterministic reproduction when appropriate:

```text
failure seed/config
→ isolate owning defect
→ fix production component
→ add focused regression
→ replay original seed
→ rerun broader batch
```

Do not store every successful seed as a permanent fixture.

### Tests

Demonstrate the workflow with a controlled/artificial regression fixture or an actual previously discovered defect if one exists:

- reproduction can be invoked directly;
- focused regression protects the corrected component;
- original seed replay succeeds after correction;
- fixture metadata is understandable without external state.

### Expected Result

The project has a repeatable process for converting M3 findings into regression tests rather than merely fixing transient batch failures.

### Definition of Done

- [ ] Regression-fixture convention/location is documented.
- [ ] At least one demonstrative deterministic reproduction path is tested.
- [ ] Confirmed defects are routed to the owning production component.
- [ ] Simulator itself is not used to mask production defects.
- [ ] Original failing seed is retained only when useful for regression/debugging.
- [ ] Focused tests/regressions/typecheck pass.

---

## M3-T10 — M3 Reliability Acceptance and Regression Verification

### Goal

Verify the complete M3 reliability harness and establish readiness for M4.

### Work

Run:

- single-seed deterministic smoke runs;
- replay verification;
- invariant and guard tests;
- structured failure-artifact tests;
- documented deterministic acceptance batch;
- full M1–M2 regressions;
- typecheck and applicable build/test commands.

Choose and record a meaningful acceptance seed set/batch for the available machine. Do not use a fixed huge count as a substitute for targeted verification.

**Defect-routing rule:** substantial failures discovered here belong to the component/task that owns the defect. Fix there, add focused regression coverage, replay the failing seed, then rerun M3 acceptance.

### Tests

Acceptance must demonstrate:

- zero unexplained legality/invariant/lifecycle failures;
- zero silent skipped failures;
- zero unresolved nontermination;
- deterministic replay;
- useful failure diagnostics when an intentionally failing fixture is exercised.

### Expected Result

There is objective evidence that the production headless game survives repeated deterministic execution and failures are reproducible/diagnosable.

### Definition of Done

- [ ] Every M3 milestone DoD item is PASS or explicitly unresolved.
- [ ] Documented acceptance batch completes with zero unresolved failures.
- [ ] Replay verification passes.
- [ ] Failure artifacts and stuck guards are proven by targeted tests.
- [ ] M1–M2 regression/integration suites pass.
- [ ] Typecheck and applicable build/test commands pass.
- [ ] Performance/engineering measurements are reported without arbitrary SLA.
- [ ] No M4 or deferred feature is needed for M3 completion.
- [ ] Unrun verification is reported as NOT VERIFIED, never falsely PASS.

---

# 14. Dependency Model and Recommended Order

```text
T01 Simulation config
 ↓
T02 Single seeded production Session
 ↓
T03 Invariant integration
 ↓
T04 Failure trace/artifact
 ↓
T05 Nontermination/progress guards
 ↓
T06 Deterministic replay
 ↓
T07 Batch runner
 ↓
T08 Metrics/reporting
 ↓
T09 Regression-fixture workflow
 ↓
T10 Acceptance
```

T03–T05 are intentionally separated so state correctness, diagnostics, and stuck detection can be reviewed independently. T06 precedes broad batching so reproducibility exists before M3 begins discovering many failures.

---

# 15. Per-Task Scope Guardrails

1. Do not create a simulator-specific rules/game loop.
2. Do not modify Baseline strategy merely to make a failing seed complete.
3. Do not silently skip or classify a seed as “bad luck.”
4. Do not turn M3 into AI difficulty/personality balancing.
5. Do not use diagnostic private state as AI input.
6. Do not treat guard thresholds as gameplay rules.
7. Do not optimize for a large Session count at the expense of invariants/diagnostics.
8. Material ambiguity is `CONFLICT / CLARIFICATION REQUIRED`, not a silent choice.
9. Never report tests/builds as passed unless actually executed.
10. Follow repository Git safety rules; Git writes remain user-controlled.

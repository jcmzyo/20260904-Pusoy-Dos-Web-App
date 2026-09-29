# Pusoy Dos --- M6 Tutorial Framework & Scripted Scenario Infrastructure

## Milestone Design + Task Breakdown (v1.0)

**Status:** Phase 2 implementation plan based on approved scope; detailed decisions gated by the named contract tasks  
**Last Modified:** September 29, 2026  
**Milestone:** M6 --- Tutorial Framework & Scripted Scenario Infrastructure  
**Phase:** Phase 2 --- Mobile Accessibility, Onboarding, and Player Experience Expansion  
**Parent requirements:** requirements.md v1.17  
**Expansion plan:** phase-2-expansion-plan.md, including approved clarification addendum  
**Shared model:** domain-model.md v1.4  
**Engine design:** engine.md v1.8  
**Orchestrator design:** orchestrator.md v1.7  
**AI design:** ai.md v1.7  
**UI/UX design:** ui-ux.md v1.13  
**Tutorial design:** tutorial.md v1.0  
**Testing strategy:** testing-simulation.md v1.10

---

# 1. Milestone Goal

Build only the deterministic scenario execution capabilities needed for committed guided gameplay, with a representative complete scenario proving production authority and recovery.

# 2. Architecture

Tutorial-owned definitions/objectives/guidance surround existing controller/runner/Engine execution. Engine remains the only rules/state authority. Scenario data and progress are not shared domain types. Normal startup and Baseline controllers remain unchanged; substantial setup/API changes require the T01 review gate.

# 3. Product Flow

Deterministic scenario setup → explanation checkpoint → guided human intent and scripted bot Turns → Engine validation/events → feedback/objective progression → scenario completion or explicit retry/exit. Full authored curriculum belongs to M7.

# 4. Interaction and Authority Contract

Support exact-action early lessons and later multiple-solution objectives. Distinguish instructional admission from authoritative legality, and accepted events from mere user activation. Privileged deal data must not leak to player-facing views or other controllers. Illegal scripted actions fail diagnostically.

# 5. Lifecycle and Results Contract

Run/checkpoint identities isolate retries, cancellation, and restart. Repeated observations cannot advance twice. Pause reasons compose with dialogs/unsupported layout. Retry never patches Engine internals or fabricates a completed Round/Session.

# 6. Responsive and Accessibility Contract

Use the accepted M5 matrix, hand/control components, keyboard/focus, and reduced-motion contract. The representative scenario needs only enough presentation to demonstrate the framework; no speculative content editor or redesign.

# 7. Testing Contract

- Vitest/React Testing Library: component, objective, and application/production-boundary behavior.
- Playwright: high-value real-browser interactions and layout/focus/pause/navigation regressions on the frozen matrix; no duplicate rules engine in fixtures/assertions.
- Human: observable usability/comprehension and assigned real-device/browser acceptance. Automated execution does not count as human verification.
- Each code task runs focused tests, `npm test`, and `npm run typecheck`; UI/integration changes also run `npm run build` and affected `npm run test:browser -- <test-file-or-filter>` checks. Replace the placeholder with the actual new/existing test path/filter; report the exact command used.
- Milestone gates run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`, and `npm run test:acceptance:m3`. Also run the M3 acceptance command after changes affecting Engine/runner/setup reliability. Additional approved browser coverage must be executed or marked NOT VERIFIED.
- Contract-only tasks verify documents/approval records, not runtime functionality; runtime commands are N/A for those tasks. Current package has no lint script. Use Node >=24, the existing lockfile, and `npm ci` if installation is needed.
- Tests use deterministic setup/action sequences, physical card uniqueness, and meaningful state/event assertions. Do not assert exact animation durations or fabricate accepted results.

# 8. Milestone Definition of Done

- [ ] The setup/objective/controller/lifecycle contract is reviewed and any substantial public API change explicitly approved.
- [ ] Deterministic valid setup preserves physical cards, opening rules, Engine state, and information boundaries.
- [ ] Scripted bot intentions and guided human actions execute through production requests and Engine validation.
- [ ] Exact and multiple-solution objectives, unchanged-state corrective retry, accepted-event progression, and diagnostic failures are covered.
- [ ] One representative end-to-end scenario proves setup, guidance, bot behavior, rejection, progression, completion, and clean replacement/exit.
- [ ] M5/Phase 1 regressions, full automated gates, and required representative-scenario human checks pass.

# 9. Task Planning Principles

Read AGENTS.md, this milestone's §§1–10, the assigned task, and every Must Read document before implementation. Paths below are relative to md files/ except the repository-root AGENTS.md and HOW_TO_PLAY.md. Inspect relevant production code and tests, then implement only one assigned task on the user-prepared appropriate branch. Preserve existing changes; user performs all Git writes.

Each task uses the M4 format: Goal, Must Read, Work, Automated Tests, Manual Tests, Expected Result, Definition of Done. Dependencies below are explicit; no later task silently bypasses an unresolved contract gate. Complete each task's own checks and shared §7 verification. Required human checks are part of DoD: record MANUAL VERIFICATION PENDING until a human reports them and do not label that task COMPLETE prematurely.

Normal local implementation choices are delegated; substantial product/rule/API/ownership/dependency changes require clarification/approval. No speculative frameworks, runtime dependency upgrades, auto-pass, new game mode, advanced AI, persistence, networking, sandbox, or major art/audio redesign. Optional polish is not a completion requirement and is not authorized by this breakdown.

# 10. Task Map

| Task | Technical checkpoint | Dependencies |
|---|---|---|
| M6-T01 | Freeze Scenario Setup and Production Integration Contracts | M5 accepted for implementation; read-only design may overlap M5 |
| M6-T02 | Validated Deterministic Scenario Setup | M6-T01 |
| M6-T03 | Scripted Controllers Through Production Turn Requests | M6-T02 |
| M6-T04 | Objectives and Authoritative Progression | M6-T03 |
| M6-T05 | Guided Input, Corrective Feedback, and Checkpoint UI | M6-T04; accepted M5 presentation foundation |
| M6-T06 | Cancellation, Retry Reconstruction, and Run Isolation | M6-T05 |
| M6-T07 | Representative End-to-End Guided Scenario | M6-T02 through M6-T06 |
| M6-T08 | M6 Framework Acceptance and Regression Gate | M6-T01 through M6-T07 |

---

# M6-T01 — Freeze Scenario Setup and Production Integration Contracts

**Dependencies:** M5 accepted for implementation; read-only design may overlap M5

### Goal

Select the smallest safe deterministic setup and objective lifecycle compatible with production.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [domain-model.md](domain-model.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md), [ai.md](ai.md), [testing-simulation.md](testing-simulation.md).

### Work

- Inspect GameEngine/startRound, GameRunner, PlayerTurnRequest, HumanController, SessionPresentation, normal startup, simulation fixtures, and their actual consumers.
- Design representative scenario requirements and compare existing seeded/controlled production setup plus legal replay with a minimal validated setup extension. Document the selected path and physical invariants.
- Add a repository-contained authoring fixture test for tutorial-script.md using existing production APIs and test tooling. Verify all five 52-card deals as four order-insensitive 13-card sets, exact Round 5 seed reproduction, guided traces and listed alternatives, rejected opening Passes, comparison examples, and one complete five-Round Session. Record the exact command and observed results; do not depend on the external authoring probe or hard-code its aggregate Move count as a product requirement. This is test-only feasibility evidence, not tutorial runtime implementation or approval of a new setup API.
- Define scenario validation, scripted intention/branch data, objective admission versus accepted-result completion, observation identity, diagnostics, cancellation, and retry/reconstruction ownership.
- List any proposed exported type/function/event/configuration changes and all consumers. Obtain explicit approval for substantial changes before dependent code; never assume arbitrary state restoration is already supported.
- Update tutorial.md and owning Engine/Orchestrator documents only after approval. Keep normal Basic/headless semantics and hidden-information boundaries unchanged.

### Automated Tests

Contract review against actual APIs and test fixtures; check representative setup is reachable and no proposed predicate duplicates rules. Run the new repository-contained authoring fixture test, npm test, and npm run typecheck; record the actual test path/command and results. The fixture test reproduces Engine-level evidence only; tutorial controller/UI execution remains unimplemented and unverified.

This task is an explicit exception to §7's contract-only runtime-test exemption: documentation approval checks and the test-only fixture verification above are both required. No production API change is authorized by adding the test.

### Manual Tests

Review the concrete setup/API proposal and representative teaching flow with the user. Expected: ownership and any compatibility impact are understood and approved before implementation.

### Expected Result

An approved implementable contract, not an open-ended framework or hidden API change.

### Definition of Done

- [ ] Setup and objective/observation/lifecycle contracts frozen.
- [ ] Consumer/compatibility review and any required API approval recorded.
- [ ] Representative scenario can exercise exact-action, alternative solution, rejection, and completion behavior.
- [ ] Repository-contained fixture reproduction passes with a documented command; externally reported counts are distinguished from independently reproduced results.
- [ ] Required document approvals and consistency/link checks recorded.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T02 — Validated Deterministic Scenario Setup

**Dependencies:** M6-T01

### Goal

Construct reproducible valid teaching situations using the approved setup path.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [engine.md](engine.md), [domain-model.md](domain-model.md), [testing-simulation.md](testing-simulation.md).

### Work

- Implement narrowly scoped scenario definition/setup validation and deterministic construction chosen in T01.
- Validate full physical deck uniqueness, required participants/card references, opening ownership, and reachable history/state as applicable to the chosen contract.
- Retain authoritative startup/events and isolate scenario definitions from mutable execution data.
- Reject malformed setup diagnostically; no silent repairs, arbitrary internal-state writes, or generic snapshot/persistence system.

### Automated Tests

Unit/integration: duplicate/missing/invalid cards and players, impossible opener/history, malformed definitions, input mutation isolation, same setup/action replay equality. Use production invariants and run M3 acceptance if setup/Engine boundaries changed.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

N/A — setup correctness is verified through deterministic tests; learner presentation is tested in T07.

### Expected Result

Scenario setup yields only reproducible production-valid states.

### Definition of Done

- [ ] Approved setup path implemented and invalid inputs diagnosed.
- [ ] Physical/authoritative invariants and deterministic replay proven.
- [ ] Normal Session startup and simulation behavior unchanged.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T03 — Scripted Controllers Through Production Turn Requests

**Dependencies:** M6-T02

### Goal

Drive authored bot intentions without bypassing legality or altering Baseline AI.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [orchestrator.md](orchestrator.md), [ai.md](ai.md), [engine.md](engine.md), [testing-simulation.md](testing-simulation.md).

### Work

- Implement tutorial-owned PlayerController behavior using current request identity, permitted view, and Engine-authorized actions.
- Support only the branching required by representative and committed multi-solution objectives; deterministic choices follow authored intent.
- Report an illegal/unavailable intention or exhausted nonterminal script as a scenario defect with reproduction context.
- Retain stale-response checks and isolate script/setup-private data from normal Baseline requests and public output.

### Automated Tests

Integration with GameRunner/Engine: legal intended Play/Pass, wrong seat/request, unavailable intention, cancellation, illegal script rejection, bounded failure, deterministic branching, no fallback auto-pass. Regression: normal Baseline startup still creates the same controllers and decisions.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

N/A — controller outcomes are deterministic integration checks; visible pacing/clarity is covered in T07.

### Expected Result

Scripted actors remain ordinary production intent sources.

### Definition of Done

- [ ] Every scripted Move uses current production request/submission validation.
- [ ] Illegal/exhausted scripts fail diagnostically without mutation or fallback.
- [ ] No private-hand leak or Baseline strategy change.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T04 — Objectives and Authoritative Progression

**Dependencies:** M6-T03

### Goal

Recognize lesson success from authoritative results while allowing legitimate alternative solutions.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md).

### Work

- Implement approved objective admission/completion predicates over production facts; do not add a hand classifier or comparator.
- Support explicitly constrained actions and any Engine-valid action satisfying a multi-solution objective, independent of display/card-array order.
- Advance only once for the current accepted result/checkpoint; explanation acknowledgments stay application-only.
- Distinguish rejected Move, off-objective uncommitted attempt, accepted success, and scenario fault without rollback tricks.

### Automated Tests

Unit/integration: two or more distinct satisfying legal actions and subsequent scripted continuations, non-satisfying action, illegal near-match, reordered selection, duplicate/repeated/out-of-order observations, wrong-run events. Assert authoritative state/events do not change on uncommitted attempts.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

N/A — objective truth is verified with authoritative integration evidence; explanations are checked in T05/T07.

### Expected Result

Objective progress reflects actual accepted gameplay rather than highlights or one hard-coded solution.

### Definition of Done

- [ ] Both exact-action and multiple-solution objectives work.
- [ ] Engine rejection/off-objective feedback cannot advance progress.
- [ ] Duplicate/stale observations cannot advance twice.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T05 — Guided Input, Corrective Feedback, and Checkpoint UI

**Dependencies:** M6-T04; accepted M5 presentation foundation

### Goal

Connect learner input and concise guidance to the framework without corrupting game state.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md).

### Work

- Reuse production hand/controls for guided intent and existing Engine-derived legality feedback.
- Show instruction, objective context, non-obscuring highlight, attempt feedback, and continue/retry where the representative flow needs them.
- Label a legal off-objective attempt instructionally, never as an illegal game Move; preserve state and let the player try again.
- Implement M5 keyboard/focus and reduced-motion behavior; blocking explanation gates pause gameplay without changing rules.

### Automated Tests

RTL/integration: exact and alternative inputs, illegal/off-objective attempts, unchanged state, retry success, rapid continue, keyboard activation/focus, reduced motion, and overlapping pause reasons. Playwright representative checkpoint at minimum portrait and landscape.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Make a wrong attempt, read feedback, and retry using touch and keyboard. Expected: the explanation distinguishes lesson intent from legality, cards/Turn do not unexpectedly change, and guidance never covers required controls.

### Expected Result

Learner mistakes produce understandable feedback and safe retry.

### Definition of Done

- [ ] Guidance/input integrate with production authority.
- [ ] Mistakes preserve authoritative state and allow retry.
- [ ] Representative guidance is usable with M5 input/accessibility constraints.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T06 — Cancellation, Retry Reconstruction, and Run Isolation

**Dependencies:** M6-T05

### Goal

Ensure retries, replacement, and exit cannot let old asynchronous work affect a new run.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [orchestrator.md](orchestrator.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md).

### Work

- Implement approved deterministic retry/restart construction with fresh execution identities and teardown of pending requests/subscriptions.
- Compose explanation, overlay, and unsupported-layout pauses; recover without accidentally advancing bots or objectives.
- Distinguish learner retry from scenario defect recovery, retaining developer diagnostic context and a safe visible exit/retry path.
- Keep tutorial completion distinct from Engine Session completion and normal app startup free from tutorial state.

### Automated Tests

Integration: restart/exit while human request or bot decision is pending, late resolution after replacement, duplicate continue, repeated destroy, supported/unsupported with modal open, terminal scenario fault. Assert no new-run mutation/events from old work and deterministic reconstruction.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Retry/restart and leave the representative scenario during guidance and bot activity, then start normal gameplay. Expected: no old instruction/Move leaks, controls remain responsive, and normal bots/gameplay resume independently.

### Expected Result

Tutorial runs have safe lifecycle boundaries and reproducible recovery.

### Definition of Done

- [ ] Obsolete callbacks/requests cannot mutate or advance replacement runs.
- [ ] Pause/recovery and fault handling are explicit and bounded.
- [ ] Normal five-Round startup remains unaffected.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T07 — Representative End-to-End Guided Scenario

**Dependencies:** M6-T02 through M6-T06

### Goal

Prove the framework works as integrated gameplay before authoring the full curriculum.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md).

### Work

- Author one coherent valid scenario containing guided human action, scripted bots, incorrect-attempt feedback, an alternative-solution objective, accepted-event progression, and completion.
- Demonstrate a reduction in guidance and exercise approved retry/restart/exit boundaries.
- Use production setup/validation/views throughout; preserve reference to setup and action sequence for reproduction.
- Keep this a representative framework proof, not the M7 full tutorial or a new normal-game mode.

### Automated Tests

Deterministic integration replay and focused Playwright full representative flow, including one mistake/retry, alternate valid path, keyboard action, and reduced-motion path at approved portrait/landscape sizes. Assert actual authoritative transitions and terminal tutorial progress.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

A human follows the representative instructions, makes a mistake, retries, and completes the scenario. Expected: guidance/action/feedback form a coherent game interaction and completion is understandable.

### Expected Result

An end-to-end technical checkpoint demonstrates every required M6 mechanism.

### Definition of Done

- [ ] Representative scenario passes on the accepted M5 foundation.
- [ ] Alternative valid solutions and failure/retry paths are proved.
- [ ] Required human clarity/usability observations recorded.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M6-T08 — M6 Framework Acceptance and Regression Gate

**Dependencies:** M6-T01 through M6-T07

### Goal

Accept the tutorial execution foundation without regressing the production system.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [testing-simulation.md](testing-simulation.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md), [ai.md](ai.md).

### Work

- Audit dependency direction, public API compatibility, scenario/private data boundaries, and absence of duplicated rules.
- Map M6 DoD to positive and falsifying tests, representative human evidence, and reproducible scenario diagnostics.
- Run full regression/browser/typecheck/build/M3 acceptance gates.
- Record residual risks or blockers; stop before full M7 authoring.

### Automated Tests

Full milestone gate commands plus scenario invalid-input/script/identity/replay suite. Inspect tests to ensure expected gameplay results come from canonical fixtures/Engine evidence rather than a second rule implementation.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Confirm T07 representative human evidence covers required interactions on portrait and landscape. Missing evidence remains MANUAL VERIFICATION PENDING.

### Expected Result

M7 receives a tested compatible framework with explicit limitations.

### Definition of Done

- [ ] Every M6 milestone DoD item passes.
- [ ] No authority/privacy/compatibility blocker remains.
- [ ] Required automated and human evidence recorded.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# 11. Dependency Order and Completion Evidence

Follow the task-map dependencies. Contract tasks block dependent implementation until required approval is recorded. The final task is the milestone gate; passing isolated tasks does not replace integrated acceptance.

For each task record automated command/results, scenario/seed where relevant, and human tester/date/build/browser/device/viewport/input plus actions and expected/observed results. Record approval decisions and acceptance evidence in the relevant task's implementation/acceptance notes when available; no acceptance is pre-filled by this planning document. Reuse existing canonical documents rather than creating an unapproved reporting subsystem.

# 12. Scope Guardrails and Next Checkpoint

After M6 acceptance, the next checkpoint is M7 authored tutorial/reference content. Stop after the assigned task; do not automatically implement the next task or commit/push.

## Authored Five-Round Script Input

M6-T01 must also read [tutorial-script.md](tutorial-script.md). Its complete deals and checked prefixes provide concrete setup/branch requirements: preserve one real five-Round Session, admit listed alternatives, and transition deliberately from scripted intentions to existing Baseline policy at open-practice handoffs without replacing authoritative state. Round 5 is unrestricted; tutorial completion requires the real Session result. The authoring probe shows existing injected RNG can reproduce the deals; evaluate that evidence before proposing a new setup API. This does not authorize an arbitrary snapshot API or fallback from a defective script.

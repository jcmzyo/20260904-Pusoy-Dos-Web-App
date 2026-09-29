# Pusoy Dos --- M8 Player Experience, Accessibility & Phase 2 Acceptance

## Milestone Design + Task Breakdown (v1.0)

**Status:** Phase 2 implementation plan based on approved scope; detailed decisions gated by the named contract tasks  
**Last Modified:** September 29, 2026  
**Milestone:** M8 --- Player Experience, Accessibility & Phase 2 Acceptance  
**Phase:** Phase 2 --- Mobile Accessibility, Onboarding, and Player Experience Expansion  
**Parent requirements:** requirements.md v1.17  
**Expansion plan:** phase-2-expansion-plan.md, including approved clarification addendum  
**Shared model:** domain-model.md v1.4  
**Engine design:** engine.md v1.8  
**Orchestrator design:** orchestrator.md v1.7  
**AI design:** ai.md v1.7  
**UI/UX design:** ui-ux.md v1.12  
**Tutorial design:** tutorial.md v1.0  
**Testing strategy:** testing-simulation.md v1.9

---

# 1. Milestone Goal

Verify and harden the integrated Phase 2 product across approved devices, inputs, tutorial/reference flows, and normal gameplay without expanding into an unrestricted redesign.

# 2. Architecture

Preserve Domain → Engine → Orchestrator → Controllers/AI/UI ownership. M8 diagnoses and fixes bounded integration defects; it does not replace the accepted M5 responsive system or M6 tutorial framework.

# 3. Product Flow

Home → Play → Tutorial / Basic Game choice → guided scripted tutorial or normal five-Round gameplay → completion/results → replay/Home/normal game. Home → How to Play independently opens the comprehensive guide without starting gameplay. Verify choice cancellation, both execution paths, and guide access/return as well as later flow transitions.

# 4. Interaction and Authority Contract

Apply requirements §3.6, the expansion-plan §11 checklist and its approved addendum, tutorial.md, and the frozen M5–M7 decisions. Keyboard/focus and reduced motion are mandatory. No full accessibility-standard certification is implied.

# 5. Lifecycle and Results Contract

Verify no stale request, pause, subscription, focus, or tutorial restriction leaks between modes of presentation or separate runs. Normal Basic remains five Rounds with the production continuation/results contract.

# 6. Responsive and Accessibility Contract

Reuse the frozen matrix, including real mobile/browser coverage and accepted landscape-phone sizing exception. Missing devices/browsers or human checks remain NOT VERIFIED; do not shrink acceptance targets to match available tooling.

# 7. Testing Contract

- Vitest/React Testing Library: component, objective, and application/production-boundary behavior.
- Playwright: high-value real-browser interactions and layout/focus/pause/navigation regressions on the frozen matrix; no duplicate rules engine in fixtures/assertions.
- Human: observable usability/comprehension and assigned real-device/browser acceptance. Automated execution does not count as human verification.
- Each code task runs focused tests, `npm test`, and `npm run typecheck`; UI/integration changes also run `npm run build` and affected `npm run test:browser -- <test-file-or-filter>` checks. Replace the placeholder with the actual new/existing test path/filter; report the exact command used.
- Milestone gates run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`, and `npm run test:acceptance:m3`. Also run the M3 acceptance command after changes affecting Engine/runner/setup reliability. Additional approved browser coverage must be executed or marked NOT VERIFIED.
- Contract-only tasks verify documents/approval records, not runtime functionality; runtime commands are N/A for those tasks. Current package has no lint script. Use Node >=24, the existing lockfile, and `npm ci` if installation is needed.
- Tests use deterministic setup/action sequences, physical card uniqueness, and meaningful state/event assertions. Do not assert exact animation durations or fabricate accepted results.

# 8. Milestone Definition of Done

- [ ] M5–M7 are accepted and every Phase 2 requirement/DoD item maps to implementation and verification evidence.
- [ ] Portrait phone/tablet and landscape five-Round gameplay, full tutorial, reference, and cross-flow navigation work across approved targets.
- [ ] Keyboard/focus, reduced motion, contrast/non-color communication, readable/usable sizing, and all required input paths meet the approved criteria.
- [ ] Real new-player and device/browser human acceptance is executed, with no unresolved blocking usability/progression defect.
- [ ] Full Vitest/RTL, Playwright, typecheck, production build, and deterministic M3 reliability gates pass.
- [ ] No deferred feature is needed for completion, and no next-phase roadmap or implementation is started.

# 9. Task Planning Principles

Read AGENTS.md, this milestone's §§1–10, the assigned task, and every Must Read document before implementation. Paths below are relative to md files/ except the repository-root AGENTS.md and HOW_TO_PLAY.md. Inspect relevant production code and tests, then implement only one assigned task on the user-prepared appropriate branch. Preserve existing changes; user performs all Git writes.

Each task uses the M4 format: Goal, Must Read, Work, Automated Tests, Manual Tests, Expected Result, Definition of Done. Dependencies below are explicit; no later task silently bypasses an unresolved contract gate. Complete each task's own checks and shared §7 verification. Required human checks are part of DoD: record MANUAL VERIFICATION PENDING until a human reports them and do not label that task COMPLETE prematurely.

Normal local implementation choices are delegated; substantial product/rule/API/ownership/dependency changes require clarification/approval. No speculative frameworks, runtime dependency upgrades, auto-pass, new game mode, advanced AI, persistence, networking, sandbox, or major art/audio redesign. Optional polish is not a completion requirement and is not authorized by this breakdown.

# 10. Task Map

| Task | Technical checkpoint | Dependencies |
|---|---|---|
| M8-T01 | Integrated Acceptance Inventory and Reproduction Matrix | Accepted M5, M6, and M7 |
| M8-T02 | Responsive, Cross-Browser, and Cross-Flow Hardening | M8-T01 |
| M8-T03 | Keyboard, Focus, Motion, and Visual Accessibility Verification | M8-T02 |
| M8-T04 | Integrated Human Acceptance and Usability Corrections | M8-T02, M8-T03 |
| M8-T05 | Final Phase 2 Acceptance and Regression Gate | M8-T01 through M8-T04; all M5–M7 DoD satisfied |

---

# M8-T01 — Integrated Acceptance Inventory and Reproduction Matrix

**Dependencies:** Accepted M5, M6, and M7

### Goal

Make every acceptance obligation and evidence gap explicit before the final sweep.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md), [m5-portrait-mobile-task-breakdown.md](m5-portrait-mobile-task-breakdown.md), [m6-tutorial-framework-task-breakdown.md](m6-tutorial-framework-task-breakdown.md), [m7-tutorial-rules-task-breakdown.md](m7-tutorial-rules-task-breakdown.md).

### Work

- Map every requirements §3.6 and expansion-plan §11 item to owning milestone/task, tests, and human evidence.
- Confirm frozen viewport/browser/device/input and accessibility criteria; record versions/build/fixtures and any missing execution capability.
- Create the integrated manual checklist in this milestone’s acceptance notes, with actions/expected visible results and tester/result fields.
- Carry forward known defects and unverified criteria explicitly; do not redefine acceptance or defer known blockers merely because M8 began.

### Automated Tests

Documentation/evidence audit for complete requirement coverage and reproducible commands/fixtures. Runtime tests N/A for this inventory task; later tasks execute the matrix.

Documentation/approval verification from §7 applies; no runtime pass is claimed.

### Manual Tests

Checklist review confirms a human can follow each action and observe its expected result without developer tooling or millisecond measurement. Execution results are still pending.

### Expected Result

A complete acceptance map and actionable verification schedule.

### Definition of Done

- [ ] Every Phase 2 DoD item mapped with no silent omissions.
- [ ] Human checklist and automated commands reproducible.
- [ ] Missing evidence and known issues explicitly tracked.
- [ ] Required document approvals and consistency/link checks recorded.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M8-T02 — Responsive, Cross-Browser, and Cross-Flow Hardening

**Dependencies:** M8-T01

### Goal

Find and fix integration defects spanning gameplay, tutorial, Rules, and devices.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md), [orchestrator.md](orchestrator.md).

### Work

- Exercise the frozen viewport/browser matrix, real mobile available height/insets, orientation changes, long content, full hands, results, and tutorial/reference transitions.
- Verify pending human/bot work, overlays, Rules, resize, leave/restart, and normal-game startup do not leak execution or stale state.
- Add only focused high-value browser coverage missing from earlier milestones; do not duplicate every Engine rule in Playwright.
- Fix bounded in-scope defects with regressions; report substantial design changes for approval. Record unsupported execution environments as unverified, not passed.

### Automated Tests

Playwright across configured approved browser coverage plus RTL/integration for lifecycle failures; full regression/typecheck/build after fixes. Retain deterministic fixture/action reproduction. Chromium results alone do not certify Safari/iOS.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Run approved real-device touch/mouse checks through normal game, tutorial, Rules, overlays, results, rotation, and restart. Expected: no clipping, inaccessible control, stale instruction, or unintended action across flow changes.

### Expected Result

Integrated responsive/navigation behavior is stable across the agreed targets.

### Definition of Done

- [ ] Frozen responsive/browser coverage executed and blocking defects fixed.
- [ ] No cross-run/state/pause or critical layout regression.
- [ ] Human device evidence distinguished from emulation.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M8-T03 — Keyboard, Focus, Motion, and Visual Accessibility Verification

**Dependencies:** M8-T02

### Goal

Verify the approved accessibility contract across complete product flows.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [tutorial.md](tutorial.md), [testing-simulation.md](testing-simulation.md).

### Work

- Audit keyboard operation for Home, the Play choice window and its Tutorial/Basic Game/cancel paths, direct How to Play section navigation/return, selection/reorder/sort, Play/Pass, dialogs, results, and tutorial actions.
- Verify visible focus, sensible order and restoration, no background modal activation, and understandable status/feedback without color alone.
- Measure approved contrast/sizing criteria with documented exemptions; verify reduced-motion normal/tutorial/result flows complete without animation dependencies.
- Fix in-scope defects with targeted tests. Do not convert this task into a claim of full standards conformance or a general Settings project.

### Automated Tests

RTL/Playwright keyboard traversal/activation/reorder, focus containment/restoration after dynamic card removal and transitions, reduced-motion preference and lifecycle completion. Record measured contrast/sizing against approved values rather than relying only on screenshots.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Use the product with keyboard, then with reduced motion enabled; inspect focus and feedback on constrained targets. Expected: every required action is reachable, focus remains visible, and meaning/progression survives reduced animation and non-color cues.

### Expected Result

Mandatory accessibility support has end-to-end evidence and no blocking gap.

### Definition of Done

- [ ] All approved keyboard/focus and reduced-motion criteria verified.
- [ ] Contrast/sizing/non-color checks pass with only recorded approved exemptions.
- [ ] No required interaction remains pointer-only or animation-dependent.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M8-T04 — Integrated Human Acceptance and Usability Corrections

**Dependencies:** M8-T02, M8-T03

### Goal

Validate the complete product with actual players and required real-device evidence.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md).

### Work

- Execute T01’s checklist: Play choice/cancellation and both entry paths; direct comprehensive main-menu How to Play without game startup; full five-Round Sessions on portrait phone/tablet and supported landscape; full tutorial, wrong-attempt recovery, reference return, and required inputs.
- Include new-player tutorial completion without coaching followed by normal play to test transfer of understanding.
- Record tester/date/build/browser/device/viewport/input, observed results, and issues; separate functional defects from comprehension problems.
- Apply bounded approved corrections and repeat affected checks/tests. Leave unperformed checks MANUAL VERIFICATION PENDING; no self-certification by the implementation agent.

### Automated Tests

Focused regression tests for any correction, then npm test/typecheck/build and relevant browser coverage. Changes to execution/setup also rerun deterministic M3 acceptance.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

The complete approved manual protocol is the deliverable. Expected: a new player can learn then complete normal play, all critical touch/mouse/keyboard interactions work, and no blocking confusion or responsive defect remains.

### Expected Result

Phase 2 usability is supported by actual reported human observations.

### Definition of Done

- [ ] Required human acceptance actually executed on assigned targets.
- [ ] No unresolved blocking usability/comprehension defect.
- [ ] Corrections retested with reproducible automated and human evidence.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M8-T05 — Final Phase 2 Acceptance and Regression Gate

**Dependencies:** M8-T01 through M8-T04; all M5–M7 DoD satisfied

### Goal

Decide Phase 2 completion using complete evidence and preserve a reliable working product.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md), [ai.md](ai.md).

### Work

- Run npm test, npm run typecheck, npm run build, npm run test:browser, and npm run test:acceptance:m3 against the final change set.
- Reconcile every Phase 2 and M5–M8 DoD item with final automated/human evidence; skipped or missing required checks are NOT VERIFIED.
- Audit architecture, public contracts, deterministic behavior, private information, and deferred-scope exclusions; inspect final diffs for unrelated work.
- Synchronize README, current HOW_TO_PLAY instructions, and acceptance notes only with observed delivered behavior. Report completion/limitations and readiness for user commit/push.
- Stop. Do not start a Phase 3 roadmap, optional sound/settings project, or Git write operation.

### Automated Tests

All five exact commands above must pass, plus any approved additional browser execution needed for the frozen matrix. Retain final evidence and reproducible failed-seed/scenario data if a check fails; never weaken tests to pass the gate.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Confirm T04 final human evidence still applies to the tested build; rerun checks affected by subsequent fixes. Expected: all required observable criteria have reported passing results and no blocker.

### Expected Result

A production-integrated accepted Phase 2 product, or an honest incomplete/blocking report.

### Definition of Done

- [ ] Every requirements §3.6 / plan §11 / milestone DoD item PASS.
- [ ] Final automated suites and required human evidence complete.
- [ ] No blocking correctness, usability, progression, authority, or regression defect.
- [ ] No deferred system or uncommitted next phase required or started.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# 11. Dependency Order and Completion Evidence

Follow the task-map dependencies. Contract tasks block dependent implementation until required approval is recorded. Phase 2 completion requires every upstream milestone gate, not merely this milestone’s code.

For each task record automated command/results, scenario/seed where relevant, and human tester/date/build/browser/device/viewport/input plus actions and expected/observed results. Record approval decisions and acceptance evidence in the relevant task's implementation/acceptance notes when available; no acceptance is pre-filled by this planning document. Reuse existing canonical documents rather than creating an unapproved reporting subsystem.

# 12. Scope Guardrails and Next Checkpoint

After M8 acceptance, evaluate the completed Phase 2 working product with the user before selecting any next committed phase. Stop after the assigned task; do not automatically implement the next task or commit/push.

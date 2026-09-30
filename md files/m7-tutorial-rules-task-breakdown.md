# Pusoy Dos --- M7 Scripted Pusoy Dos Tutorial & Rules Reference

## Milestone Design + Task Breakdown (v1.0)

**Status:** Phase 2 implementation plan based on approved scope; detailed decisions gated by the named contract tasks  
**Last Modified:** October 1, 2026  
**Milestone:** M7 --- Scripted Pusoy Dos Tutorial & Rules Reference  
**Phase:** Phase 2 --- Mobile Accessibility, Onboarding, and Player Experience Expansion  
**Parent requirements:** requirements.md v1.17  
**Expansion plan:** phase-2-expansion-plan.md, including approved clarification addendum  
**Shared model:** domain-model.md v1.4  
**Engine design:** engine.md v1.8  
**Orchestrator design:** orchestrator.md v1.7  
**AI design:** ai.md v1.7  
**UI/UX design:** ui-ux.md v1.14  
**Tutorial design:** tutorial.md v1.0  
**Testing strategy:** testing-simulation.md v1.10

---

# 1. Milestone Goal

Deliver a complete coherent hands-on learning experience and comprehensive in-app How to Play using the accepted M6 framework and canonical house rules.

# 2. Architecture

Author scenarios, objectives, and guidance using M6. UI explains; production Engine validates and produces results. No one-off rule implementations, internal-state mutation, new GameMode, or hidden-information exception. Fix missing framework capability through a reviewed bounded M6 contract change rather than a content hack.

# 3. Product Flow

Home → Play → choice window → Tutorial or Basic Game. Tutorial starts one real five-Round Basic Session following tutorial-script.md → guided prefixes and open practice → unrestricted fifth Round → real Session result and tutorial completion → normal Basic game or Home; Basic Game starts a normal five-Round Session. Opening/cancelling the choice window starts neither. Comprehensive How to Play is directly accessible from the main menu without entering Play or starting a run, and remains accessible in gameplay/tutorial without losing the current run. Replay/restart and current-run progress are selected SHOULD deliverables, not persistent progression.

# 4. Interaction and Authority Contract

Cover tutorial.md §7, tutorial-script.md, and expansion-plan §§8–9 with explicit topic-to-lesson/reference mapping. Actions teach through play; rare comparison details may use contextual/reference explanation only where T01 explicitly allocates them. Wrong attempts normally teach with unchanged authoritative state. Later objectives accept all satisfying Engine-valid choices.

# 5. Lifecycle and Results Contract

Selecting Basic Game in the Play choice window invokes normal production startup; opening the window itself does not start a game. Tutorial completion is application progress and does not fabricate Engine Session results. Rules overlays pause active execution. Leaving/restarting follows the approved M6 cleanup contract and approved T01 user flow.

# 6. Responsive and Accessibility Contract

All content uses the frozen M5 portrait/landscape/input criteria, including long instructions/reference sections, focus stability, touch/mouse, and reduced motion. No tutorial highlight may obscure critical controls.

# 7. Testing Contract

- Vitest/React Testing Library: component, objective, and application/production-boundary behavior.
- Playwright: high-value real-browser interactions and layout/focus/pause/navigation regressions on the frozen matrix; no duplicate rules engine in fixtures/assertions.
- Human: observable usability/comprehension and assigned real-device/browser acceptance. Automated execution does not count as human verification.
- Each code task runs focused tests, `npm test`, and `npm run typecheck`; UI/integration changes also run `npm run build` and affected `npm run test:browser -- <test-file-or-filter>` checks. Replace the placeholder with the actual new/existing test path/filter; report the exact command used.
- Milestone gates run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`, and `npm run test:acceptance:m3`. Also run the M3 acceptance command after changes affecting Engine/runner/setup reliability. Additional approved browser coverage must be executed or marked NOT VERIFIED.
- Contract-only tasks verify documents/approval records, not runtime functionality; runtime commands are N/A for those tasks. Current package has no lint script. Use Node >=24, the existing lockfile, and `npm ci` if installation is needed.
- Tests use deterministic setup/action sequences, physical card uniqueness, and meaningful state/event assertions. Do not assert exact animation durations or fabricate accepted results.

# 8. Milestone Definition of Done

- [ ] An approved coverage map accounts for every required tutorial/reference topic and canonical house-rule distinction.
- [ ] Complete authored scenarios validate and replay deterministically through M6 and production authority, including supported alternative branches.
- [ ] The real fifth Round allows all Engine-valid actions without forced hints/strategy; completing the actual Session, not winning, ends the tutorial.
- [ ] Mistakes produce understandable feedback/retry; entry/exit/completion/replay and normal-game navigation are coherent.
- [ ] Comprehensive main-menu How to Play and HOW_TO_PLAY.md are synchronized with canonical rules and delivered app behavior.
- [ ] New-player human testing, responsive/accessibility checks, and full automated regression gates pass with no blocking issue.

# 9. Task Planning Principles

Read AGENTS.md, this milestone's §§1–10, the assigned task, and every Must Read document before implementation. Paths below are relative to md files/ except the repository-root AGENTS.md and HOW_TO_PLAY.md. Inspect relevant production code and tests, then implement only one assigned task on the user-prepared appropriate branch. Preserve existing changes; user performs all Git writes.

Each task uses the M4 format: Goal, Must Read, Work, Automated Tests, Manual Tests, Expected Result, Definition of Done. Dependencies below are explicit; no later task silently bypasses an unresolved contract gate. Complete each task's own checks and shared §7 verification. Required human checks are part of DoD: record MANUAL VERIFICATION PENDING until a human reports them and do not label that task COMPLETE prematurely.

Normal local implementation choices are delegated; substantial product/rule/API/ownership/dependency changes require clarification/approval. No speculative frameworks, runtime dependency upgrades, auto-pass, new game mode, advanced AI, persistence, networking, sandbox, or major art/audio redesign. Optional polish is not a completion requirement and is not authorized by this breakdown.

# 10. Task Map

| Task | Technical checkpoint | Dependencies |
|---|---|---|
| M7-T01 | Approve Lesson Coverage and Tutorial Product Flow | Accepted M6 and M5 |
| M7-T02 | Foundations, Opening, and Small-Combination Lessons | M7-T01 |
| M7-T03 | Five-Card Hierarchy and House-Rule Lessons | M7-T02 |
| M7-T04 | Pass, Finishing, Scoring, and Independent Application | M7-T03 |
| M7-T05 | Rules Reference and Tutorial Navigation Integration | M7-T04 |
| M7-T06 | New-Player Usability and Content Correction | M7-T02 through M7-T05 |
| M7-T07 | M7 Tutorial and Reference Acceptance Gate | M7-T01 through M7-T06 |

---

# M7-T01 — Approve Lesson Coverage and Tutorial Product Flow

**Dependencies:** Accepted M6 and M5

### Goal

Define a complete teachable sequence and navigation contract before extensive content authoring.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [engine.md](engine.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Map every tutorial.md §7 topic and expansion-plan §9 reference item to lesson/action/demonstration/reference coverage; identify exact-action versus multi-solution objectives.
- Review and finalize the authored tutorial-script.md: one five-Round Session, all complete deals, guided prefixes, explicit allowed branches, open-practice handoffs to the existing Baseline policy, and unrestricted fifth Round. Retain the Engine-checked evidence; validate shipping integration rather than independently inventing another curriculum.
- Preserve the approved Home → Play → Tutorial / Basic Game choice and direct main-menu How to Play entry. Specify remaining reference section/return navigation, mistake retry, replay/restart boundary, current-run progress, leave/completion, and transition to normal Basic play; these entry choices are already decided.
- Design new-player acceptance tasks and expected observations that test comprehension without explaining controls to the tester.
- Obtain approval and record the content/product flow in tutorial.md/ui-ux.md; no speculative framework or persistent progress.

### Automated Tests

Documentation coverage/consistency review against requirements §§2–3.6 and M6 capabilities. Validate proposed example sets are physically possible; runtime tests N/A for this planning task.

Documentation/approval verification from §7 applies; no runtime pass is claimed.

### Manual Tests

User reviews lesson sequence and navigation/retry/restart behavior. Expected: product choices and coverage allocation approved before dependent content implementation.

### Expected Result

A reviewable curriculum with no hidden omissions or unapproved navigation behavior.

### Definition of Done

- [ ] Every required topic mapped and sequence approved.
- [ ] Final guidance taper and multiple-solution lessons explicit.
- [ ] Navigation/restart/progress and new-player acceptance protocol approved.
- [ ] Required document approvals and consistency/link checks recorded.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T02 — Foundations, Opening, and Small-Combination Lessons

**Dependencies:** M7-T01

### Goal

Teach table context and initial play through connected authored gameplay.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [engine.md](engine.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Author approved objective/table/turn/rank/suit/opening lessons, including the 3♣ requirement.
- Teach Single, Pair, Triple and strict same-size/type response using valid unique-card situations and canonical comparison facts.
- Use constrained actions only where the lesson requires them; include corrective feedback distinguishing wrong lesson choices from illegal Moves.
- Integrate contextual instructions/highlights with keyboard and reduced-motion presentation; avoid supplying general hints to normal gameplay.

### Automated Tests

Validate/replay each scenario; assert taught opening and combination outcomes through Engine results. Cover illegal opening, wrong response size, rejected weaker play, successful correction, selection-order independence, and authored branches. RTL checks instruction/progress matches accepted events.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

A learner follows the foundation segment and explains whose Turn it is and what to play against. Expected: opening and small combinations are understandable without developer explanation; mistake feedback allows recovery.

### Expected Result

A playable introductory segment establishes the core interaction and rule concepts.

### Definition of Done

- [ ] Approved foundation topics delivered through M6.
- [ ] Valid setup and corrective/alternate paths tested.
- [ ] Required human comprehension and accessibility observations recorded.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T03 — Five-Card Hierarchy and House-Rule Lessons

**Dependencies:** M7-T02

### Goal

Teach five-card categories and project-specific comparison behavior accurately.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [engine.md](engine.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Author Straight, Flush, Full House, Four-of-a-Kind with kicker, and Straight Flush gameplay/demonstrations per the approved map.
- Teach higher-category response regardless of internal rank and same-type comparisons from requirements §2.4.
- Include special low Straights and invalid wraps, suit-first Flush versus rank-first Straight Flush, strongest applicable classification, and triple/quad rank comparisons in their mapped teaching/reference locations.
- Check physical uniqueness across every coexisting hand/example; use M6 facts/predicates, never custom rule logic.

### Automated Tests

Scenario replay and coverage-map assertions for all categories and mapped distinctions; negative near-misses rejected without progress, valid higher-category responses accepted, alternative satisfying sets continue. Engine outputs support displayed type/reason; no impossible duplicate-card comparison fixtures.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Learner completes five-card lessons and consults the mapped comparison explanation. Expected: categories/hierarchy and distinctive house rules are understandable; text/highlights remain readable on minimum portrait.

### Expected Result

The tutorial teaches this project’s five-card rules rather than generic Big Two assumptions.

### Definition of Done

- [ ] All five-card categories/hierarchy and allocated house-rule details covered.
- [ ] Examples physically valid and authoritative outcomes verified.
- [ ] No duplicated comparison authority or inaccessible guidance.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T04 — Pass, Finishing, Scoring, and Independent Application

**Dependencies:** M7-T03

### Goal

Complete the curriculum and demonstrate independent rule application.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Author voluntary/strategic Pass, no-legal-Play, Trick reset/Free Lead, and finished-player continuation with explicit remaining-player response Turns.
- Teach real Basic Round placements/points and normal five-Round Session context using authoritative results, not fabricated completion.
- Deliver Round 4’s Play-versus-Pass finisher branches and the unrestricted fifth Round from tutorial-script.md. Accept every Engine-valid final-Round action, retain optional reference/tool access, and complete the real Session without requiring a win.
- Provide understandable completion and recovery using the approved M7 flow; reference covers complete Session tiebreak details.

### Automated Tests

Deterministic replay through finishing and scoring; strategic Pass with legal alternatives, no-valid-Play explicit Pass, no auto-pass or premature reset, rejected attempt unchanged, multiple final solutions and each continuation, completion only after accepted objective. RTL verifies final guidance is actually reduced.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Learner completes the final segment without being shown every exact card choice. Expected: they can recover from mistakes, understand Pass/Free Lead and results, and recognize tutorial completion.

### Expected Result

A complete tutorial progresses from instruction to demonstrated rule application.

### Definition of Done

- [ ] Pass/Trick/finishing/scoring topics delivered accurately.
- [ ] Final guidance taper and multiple accepted solutions verified.
- [ ] Tutorial terminal state distinct from authoritative Session completion.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T05 — Rules Reference and Tutorial Navigation Integration

**Dependencies:** M7-T04

### Goal

Expose the scripted tutorial and comprehensive How to Play through the approved main-menu navigation.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Replace the main-menu immediate Start Game entry with **Play**, opening a modal choice window labeled **Tutorial** and **Basic Game**. Start only the selected execution; closing/cancelling starts neither. Preserve normal Basic production startup and five-Round behavior.
- Add a directly visible main-menu **How to Play** entry, independent of Play. Deliver the comprehensive content in tutorial.md §8 with navigable sections, explanations, physically valid worked examples, and current app-control guidance. Do not substitute a short summary or repository-file link for the in-app guide.
- Integrate Rules access/return during gameplay/tutorial with pause/focus restoration; implement approved replay/restart/progress, exit, completion, and normal-game navigation.
- Synchronize HOW_TO_PLAY.md current app instructions and rule explanations; avoid parallel inconsistent prose or treating either reference as rule authority.
- Keep keyboard/focus and reduced-motion behavior consistent across navigation; teardown old executions before new startup.

### Automated Tests

RTL/integration: Play opens the choice without starting a run; cancel/close starts neither; Tutorial and Basic Game each start the correct execution exactly once under rapid/repeated activation; direct How to Play starts no run; reference return preserves pending input; replay uses fresh identity; exit cleanup and normal Baseline remain intact. Playwright: keyboard/touch choice-window focus and dismissal, both entry paths, direct main-menu guide section navigation/return, reference mid-run, tutorial completion/replay/exit, responsive long content.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

From the main menu press Play, cancel, reopen, and choose Tutorial; separately choose Basic Game. Open How to Play directly from the main menu and find a combination comparison, scoring/tiebreak explanation, and control instructions without starting a game. Consult it during play and return. Expected: each choice has the stated result, the guide is comprehensive and navigable, focus returns sensibly, and normal gameplay has no tutorial restrictions/scripts.

### Expected Result

Players can learn, look up rules, and move into normal Basic play.

### Definition of Done

- [ ] Comprehensive guide coverage, worked examples, control instructions, and HOW_TO_PLAY.md accuracy reviewed.
- [ ] Play choice starts only the selected Tutorial/Basic execution; close/cancel starts neither.
- [ ] Main-menu How to Play is directly accessible without Play/game startup.
- [ ] Approved navigation/replay/progress paths work with clean lifecycles.
- [ ] Rules pause/focus and supported input/viewport contracts pass.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T06 — New-Player Usability and Content Correction

**Dependencies:** M7-T02 through M7-T05

### Goal

Test whether the tutorial teaches people, not just whether scripted paths execute.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Have a new player use the tutorial without developer coaching, then attempt normal Basic gameplay; follow the approved protocol.
- Record confusion, incorrect interpretations, inaccessible controls, failed alternate choices, and navigation/recovery problems with reproducible context.
- Make bounded content/usability corrections and add regression tests for behavioral defects; seek approval for material curriculum/contract changes.
- Revalidate every affected authored scenario and reference passage; do not weaken final independence requirements to make completion easier.

### Automated Tests

Focused regressions and deterministic validation of all affected scenarios/branches after corrections; run browser checks for changed guidance/navigation. Automated completion is not comprehension evidence.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

New player completes tutorial, explains relevant rule/feedback in their own words, finds Rules when uncertain, and attempts normal play. Expected: no blocking misunderstanding or dependence on developer guidance; confusion notes and follow-up retest results recorded.

### Expected Result

Teaching quality is supported by actual learner observations and corrected content.

### Definition of Done

- [ ] Real new-player testing performed and documented.
- [ ] Blocking comprehension/navigation defects resolved and retested.
- [ ] Coverage and final independent application retained.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M7-T07 — M7 Tutorial and Reference Acceptance Gate

**Dependencies:** M7-T01 through M7-T06

### Goal

Accept complete authored learning content without compromising normal gameplay.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [tutorial.md](tutorial.md), [testing-simulation.md](testing-simulation.md), [ui-ux.md](ui-ux.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md). Also read repository-root HOW_TO_PLAY.md as existing explanatory content.

### Work

- Audit topic coverage, all scenario setup/branch validation, Engine authority/privacy, reference consistency, and lighter final guidance.
- Run complete tutorial browser flows on representative portrait/landscape and required keyboard/reduced-motion paths.
- Run full milestone regression/browser/typecheck/build/M3 acceptance gates and record human evidence.
- Map all M7 DoD items to results and stop before M8.

### Automated Tests

Full milestone gate commands and deterministic all-scenario validation; full tutorial success, mistake/retry, alternative solution, reference-return, restart, and normal-game smoke flows.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Verify completed M7 human records cover new-player tutorial completion, Rules discovery, accessibility, and portrait/landscape readability. Missing evidence remains pending.

### Expected Result

An accepted tutorial/reference checkpoint ready for Phase 2 integration acceptance.

### Definition of Done

- [ ] Every M7 milestone DoD item passes with evidence.
- [ ] No blocking rule-content, progression, privacy, or usability issue.
- [ ] Normal Basic and headless reliability remain green.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# 11. Dependency Order and Completion Evidence

Follow the task-map dependencies. Contract tasks block dependent implementation until required approval is recorded. The final task is the milestone gate; passing isolated tasks does not replace integrated acceptance.

For each task record automated command/results, scenario/seed where relevant, and human tester/date/build/browser/device/viewport/input plus actions and expected/observed results. Record approval decisions and acceptance evidence in the relevant task's implementation/acceptance notes when available; no acceptance is pre-filled by this planning document. Reuse existing canonical documents rather than creating an unapproved reporting subsystem.

# 12. Scope Guardrails and Next Checkpoint

After M7 acceptance, the next checkpoint is M8 integrated acceptance. Stop after the assigned task; do not automatically implement the next task or commit/push.

## Authored Script Readiness

Every M7 task must also read [tutorial-script.md](tutorial-script.md). T02 implements Round 1; T03 implements Rounds 2–3 and the mapped comparison explanations; T04 implements Round 4, all finisher alternatives, final free play, and real five-Round completion. T05 integrates the complete script into Play → Tutorial and comprehensive How to Play. T06/T07 verify actual new-player comprehension and whole-Session completion. Engine-checked authoring fixtures do not replace runtime/controller/UI tests or human acceptance.

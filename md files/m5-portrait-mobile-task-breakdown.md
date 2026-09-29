# Pusoy Dos --- M5 Portrait & Mobile Experience

## Milestone Design + Task Breakdown (v1.1)

**Status:** Phase 2 implementation plan based on approved scope; detailed decisions gated by the named contract tasks  
**Last Modified:** September 29, 2026  
**Milestone:** M5 --- Portrait & Mobile Experience  
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

Make the existing five-Round Basic game fully playable on approved portrait phone/tablet layouts while retaining supported landscape/desktop play, production authority, and existing player actions.

# 2. Architecture

Reuse SessionPresentation, HumanController, GameRunner, and the production Engine. Portrait is a presentation composition over the same state and intents, not a second game loop. Keep layout/selection/manual order in UI; authoritative Turn, legality, scores, and results remain production-owned.

# 3. Product Flow

Home → immediate Start Game → responsive Basic table → 4th-place reveal → Round Result → explicit Next Round for Rounds 1–4 → automatic Round 5 Summary → Play Again/Home. Supported orientation changes keep this execution intact. This immediate entry remains the M5 checkpoint only. M7 replaces it with Play → Tutorial / Basic Game and adds comprehensive How to Play directly on the main menu.

# 4. Interaction and Authority Contract

Preserve current Turn, current combination/Free Lead and attribution, opponent counts, PASS/DONE, scores, Round context, history access, selection/elevation, bounded reorder, Rank/Suit sorting, Play/Pass, and readable Engine-derived feedback. Cards keep their ratio and common unselected baseline. Reduced motion and keyboard/focus are delivered alongside affected controls, not deferred wholesale to M8.

# 5. Lifecycle and Results Contract

Overlays and unsupported layouts coordinate pause without dropping other pause reasons. Leave/restart must preserve cancellation and stale-input protections. Result ordering, fourth-hand reveal permissions, points, tiebreaks, and normal five-Round continuation semantics remain unchanged.

# 6. Responsive and Accessibility Contract

M5-T01 approves/freezes portrait dimensions, minima, sizing, card exposure, and input/accessibility criteria. Retain all existing supported landscape matrix cases, 844×390 minimum, full-scale constraints, and the approved landscape-phone text/target exemption. Portrait cannot inherit that exemption silently. Do not claim support by removing rotate guidance alone. The approved contract is frozen in [ui-ux.md](ui-ux.md) §19.6 and the testing-simulation.md frozen M5 matrix (see the M5-T01 Approval Record).

# 7. Testing Contract

- Vitest/React Testing Library: component, objective, and application/production-boundary behavior.
- Playwright: high-value real-browser interactions and layout/focus/pause/navigation regressions on the frozen matrix; no duplicate rules engine in fixtures/assertions.
- Human: observable usability/comprehension and assigned real-device/browser acceptance. Automated execution does not count as human verification.
- Each code task runs focused tests, `npm test`, and `npm run typecheck`; UI/integration changes also run `npm run build` and affected `npm run test:browser -- <test-file-or-filter>` checks. Replace the placeholder with the actual new/existing test path/filter; report the exact command used.
- Milestone gates run `npm test`, `npm run typecheck`, `npm run build`, `npm run test:browser`, and `npm run test:acceptance:m3`. Also run the M3 acceptance command after changes affecting Engine/runner/setup reliability. Additional approved browser coverage must be executed or marked NOT VERIFIED.
- Contract-only tasks verify documents/approval records, not runtime functionality; runtime commands are N/A for those tasks. Current package has no lint script. Use Node >=24, the existing lockfile, and `npm ci` if installation is needed.
- Tests use deterministic setup/action sequences, physical card uniqueness, and meaningful state/event assertions. Do not assert exact animation durations or fabricate accepted results.

# 8. Milestone Definition of Done

- [ ] The approved portrait/landscape matrix and keyboard/reduced-motion contracts are frozen and reused by tests.
- [ ] A human can complete all five Basic Rounds on supported portrait phone and tablet classes; supported landscape remains functional.
- [ ] Every gameplay-critical action/status, all overlapped human cards, history overlays, and result actions are usable with required inputs.
- [ ] Supported orientation/resize preserves state and below-minimum pause/recovery is coherent.
- [ ] M5 keyboard/focus, sizing/contrast/non-color, and reduced-motion criteria have automated and required human evidence.
- [ ] Required regression, browser, typecheck, build, and headless acceptance checks pass; required human checks are executed with no blocking defect.

# 9. Task Planning Principles

Read AGENTS.md, this milestone's §§1–10, the assigned task, and every Must Read document before implementation. Paths below are relative to md files/ except the repository-root AGENTS.md and HOW_TO_PLAY.md. Inspect relevant production code and tests, then implement only one assigned task on the user-prepared appropriate branch. Preserve existing changes; user performs all Git writes.

Each task uses the M4 format: Goal, Must Read, Work, Automated Tests, Manual Tests, Expected Result, Definition of Done. Dependencies below are explicit; no later task silently bypasses an unresolved contract gate. Complete each task's own checks and shared §7 verification. Required human checks are part of DoD: record MANUAL VERIFICATION PENDING until a human reports them and do not label that task COMPLETE prematurely.

Normal local implementation choices are delegated; substantial product/rule/API/ownership/dependency changes require clarification/approval. No speculative frameworks, runtime dependency upgrades, auto-pass, new game mode, advanced AI, persistence, networking, sandbox, or major art/audio redesign. Optional polish is not a completion requirement and is not authorized by this breakdown.

# 10. Task Map

| Task | Technical checkpoint | Dependencies |
|---|---|---|
| M5-T01 | Freeze Portrait, Input, and Accessibility Contracts | Completed Phase 1 baseline |
| M5-T02 | Responsive Layout Classification and Safe Orientation Transitions | M5-T01 |
| M5-T03 | Portrait Table, Opponent Status, and Gameplay Controls | M5-T02 |
| M5-T04 | Portrait Hand Selection, Sorting, and Bounded Rearrangement | M5-T03 |
| M5-T05 | Portrait History, Leave Dialogs, and Focus-Safe Pause | M5-T03, M5-T04 |
| M5-T06 | Portrait Results and Reduced-Motion Presentation | M5-T04, M5-T05 |
| M5-T07 | Full Responsive and Input Regression Sweep | M5-T02 through M5-T06 |
| M5-T08 | M5 Five-Round Acceptance and Regression Gate | M5-T01 through M5-T07 |

---

# M5-T01 — Freeze Portrait, Input, and Accessibility Contracts

**Dependencies:** Completed Phase 1 baseline

### Goal

Resolve the measurable M5 product contract before changing layout behavior.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md), [m4-playable-ui-task-breakdown.md](m4-playable-ui-task-breakdown.md).

### Work

- Inspect current layoutThresholds/useLayoutSupport/playAreaScale, HumanHand, overlays, README matrix, and tests/browser/viewportMatrix.ts; record baseline and existing exemptions.
- Propose representative portrait phone/tablet CSS viewports and exact minimum/boundary cases, including fine/coarse input, browser chrome/safe insets, and supported orientation transitions. Retain existing supported landscape targets.
- Specify a workable 13-card portrait composition with fixed ratio, common baseline, selected elevation, exposed-card targetability, readable text/control minima, and overflow behavior. Obtain approval before choosing values or relaxing an invariant.
- Specify keyboard card navigation/selection/reorder bindings, visible instructions, dialog focus/return, disabled-feedback access, measurable contrast/non-color criteria, and reduced-motion result/progression behavior.
- Map Chrome/Edge/Firefox/Safari/Android Chrome/iOS Safari to reproducible browser/device coverage and automated versus human checks; do not silently narrow requirements §12.5.
- Record approved decisions in ui-ux.md/testing-simulation.md and this milestone after user approval; no runtime implementation in this task.

### Automated Tests

Documentation verification: all target classes, exact thresholds, input bindings, accessibility criteria, and browser evidence responsibilities are specified and internally consistent. Runtime tests: N/A for this contract-only task.

Documentation/approval verification from §7 applies; no runtime pass is claimed.

### Manual Tests

User/design approval of the proposed matrix and interaction specification. Any prototype usability observations are recorded as observations, not evidence that production portrait already passes.

### Expected Result

An approved measurable contract that implementation agents can follow without inventing support criteria.

### Definition of Done

- [ ] Exact portrait matrix/minima and geometry/sizing contract approved.
- [ ] Keyboard/reorder/focus, contrast, and reduced-motion requirements approved.
- [ ] Existing landscape exceptions preserved explicitly; browser/human coverage recorded.
- [ ] All blocking product choices resolved before T02.
- [ ] Required document approvals and consistency/link checks recorded.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

### Approval Record (M5-T01)

**Approved:** by the user, September 29, 2026, in the M5-T01 session, on branch `dev/M5/T1-Freeze_Portrait_Input_and_Accessibility_Contracts` at base `27abb0d`. The decisions below were selected explicitly; the remaining proposal was approved as written. The full contract is in [ui-ux.md](ui-ux.md) §19.6, and the matrix and evidence assignments are in [testing-simulation.md](testing-simulation.md) under "Frozen M5 acceptance matrix and evidence assignments".

**Decisions:**

- **Portrait minimum:** 360×560 CSS px, for any pointer type.
  - Landscape is when width > height; a square viewport counts as portrait.
  - Phone portrait is 360–599px wide; tablet portrait is 600px or wider.
- **Portrait hand geometry:**
  - card ratio 5:7, card width 56–96px;
  - all 13 cards in one row on one baseline;
  - at least 24px exposed per overlapped card;
  - a selected card rises at least 16px;
  - 14px text and 44×44px controls apply literally in portrait. Portrait does not inherit the landscape phone-tier exemption.
  - Excluded by this decision: an iPhone SE-class screen in Safari with its toolbars shown (about 375×550) is below the minimum. With Safari's toolbars shown, an SE-class viewport (375×553) is below the portrait minimum and its 553×375 landscape is also unsupported, so that state gets 'This screen is too small to play'. With the toolbars collapsed the device is supported (375×667, or 667×375 which rotates to it). The frozen matrix row `portrait-phone-se-toolbar` (375×553) asserts this.
- **Keyboard:**
  - the hand is a listbox with a roving `tabindex`;
  - ←/→ and Home/End move focus;
  - Space/Enter select;
  - Shift+←/→ and Shift+Home/End reorder the focused card;
  - a visible hint is shown while the hand has focus;
  - Play and Pass use `aria-disabled` so their disabled reason can be reached.
- **Dialog focus:**
  - focus moves in on open, stays inside, and returns on close; Escape closes only the dismissible dialogs (for Leave, Escape means Stay);
  - Round Result never focuses Next Round automatically.
- **Contrast:**
  - WCAG 2.2 AA everywhere, including card suits;
  - Diamonds `#c2410c`, enabled Play `#1f7a43`, Pass `#1d5fc4`.
- **Reduced motion:** Round Result opens already settled, and every explicit continuation is kept.
- **Phone portrait opponents:** compact panels without the card fan or the per-seat Play trail. Tablet portrait keeps the trail.
- **Browsers:**
  - Playwright Chromium, plus mobile emulation, is the automated gate. Firefox and WebKit are not added to Playwright in M5.
  - Edge, Firefox, and macOS Safari are covered by human checks.
  - Real Android Chrome, iOS Safari, and portrait-tablet sessions are required human evidence for M5-T08.
- **Landscape:** unchanged. The 844×390 minimum, the 896×656 full-scale threshold, the phone-tier 14px/44×44px exemption, and the 28px exposure rule all stand.

**Baseline observations:** recorded in ui-ux.md §19.6.1. They describe the code before M5 and are not portrait acceptance evidence.

**Remaining limitations:**

- No runtime behavior has changed.
- The vertical budget at 360×560 is an estimate that M5-T03 must confirm. If it does not fit, M5-T03 reports a contract conflict rather than relaxing a minimum.
- Real-device availability for iOS, macOS Safari, and tablets is not yet confirmed.

# M5-T02 — Responsive Layout Classification and Safe Orientation Transitions

**Dependencies:** M5-T01

### Goal

Recognize approved portrait support and transition safely between supported and unsupported layouts.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md).

### Work

- Implement the approved orientation/size classification and shared production constants; extend the browser matrix without importing test code into production.
- Adapt layout selection to portrait versus landscape without restarting the Session or replacing controllers.
- Retain below-minimum interaction gating and device-appropriate guidance. Compose unsupported-layout pause with modal and Turn gates.
- Update old portrait-rejection assertions only where the new support contract supersedes them; retain below-minimum and landscape regressions.

### Automated Tests

Vitest/RTL: threshold and immediately-below cases, fine/coarse guidance, selection/order preservation, pause-reason composition. Playwright: supported portrait↔landscape and supported↔undersized while a human Turn, bot Turn, and overlay are active; no duplicate commits or Session reset.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Resize/rotate at a human Turn and with a history dialog open. Expected: same cards/selection/run remain, unsupported controls cannot act, and recovery does not dismiss the dialog or release its pause.

### Expected Result

One execution survives layout changes and rejects only genuinely unsupported geometry.

### Definition of Done

- [ ] Approved supported/unsupported classification implemented.
- [ ] Transitions retain execution and input state with no hidden advancement.
- [ ] Focused browser and component regressions pass.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T03 — Portrait Table, Opponent Status, and Gameplay Controls

**Dependencies:** M5-T02

### Goal

Present all critical gameplay information in an intentional portrait composition.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [domain-model.md](domain-model.md), [testing-simulation.md](testing-simulation.md).

### Work

- Compose narrow-screen opponent panels, current Turn, current combination/type/player or Free Lead, counts, PASS/DONE, scores, and Round/Session context from the existing adapter.
- Keep Event Log, Discard Pile, Leave, Sort Rank/Suit, and Play/Pass reachable without critical clipping; use the approved overflow rules.
- Reuse Engine-derived combination/disabled-action feedback and no-valid-Play Pass wording; never auto-pass or calculate rules in layout code.
- Implement approved control focus order, accessible names, visible focus, non-color cues, and text/target/contrast constraints for this surface.

### Automated Tests

RTL: turn/status/score variants, long names, large counts, Free Lead versus response, legal/illegal Play and strategic/no-valid Pass labels. Playwright: matrix geometry, controls targetable, keyboard activation, current five-card combination readable, no overlap hiding critical controls.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

On portrait phone and tablet, identify whose Turn it is, what must be beaten and who played it, opponent counts, and scores. Reach controls by touch and keyboard. Expected: all answers and disabled-action reasons are understandable without color alone.

### Expected Result

Portrait reorganizes the table without losing information or rules feedback.

### Definition of Done

- [ ] All requirements §3.6 gameplay information/actions remain accessible.
- [ ] Portrait layout is intentional and production authority unchanged.
- [ ] Applicable keyboard/focus and measured sizing/contrast criteria pass.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T04 — Portrait Hand Selection, Sorting, and Bounded Rearrangement

**Dependencies:** M5-T03

### Goal

Make the human hand reliably operable by touch, mouse, and the approved keyboard interactions.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md).

### Work

- Adapt hand geometry for 13→0 cards using the frozen portrait exposure/ratio/baseline contract; selected cards remain raised without reordering.
- Keep click/tap selection separate from drag/reorder; bounded movement preserves selected identities and supports cancellation/pointer loss.
- Implement approved keyboard navigation/selection/reorder equivalents with stable focus after sort/reorder and card removal.
- Preserve Sort Rank/Suit and selection, prevent gestures resolving obsolete Turns, and retain scaled landscape drag behavior.

### Automated Tests

Vitest/RTL: 0/1/13 cards, selected/unselected reorder, both sort orders, pointer cancellation, keyboard reorder boundaries, focus after played cards disappear, rapid input. Playwright: target every overlapping card at minimum approved portrait and landscape; drag first/middle/last and selected cards; keyboard equivalents preserve identities.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Select every card in a full hand, move selected and unselected cards within/beyond the hand boundary, sort both ways, then repeat with keyboard. Expected: every card remains targetable, selection is unchanged by arrangement, selected cards visibly rise, and controls remain reachable.

### Expected Result

Narrow-screen hand interaction preserves all Phase 1 semantics with a usable keyboard equivalent.

### Definition of Done

- [ ] All 13 cards targetable under the frozen contract.
- [ ] Baseline, ratio, elevation, selection/order independence preserved.
- [ ] Touch/mouse/keyboard reorder and sort evidence recorded.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T05 — Portrait History, Leave Dialogs, and Focus-Safe Pause

**Dependencies:** M5-T03, M5-T04

### Goal

Make dialogs usable on portrait without background actions or focus loss.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md).

### Work

- Adapt Event Log, Discard Pile, and Leave confirmation to portrait and the approved scroll/overflow contract.
- Keep history public-only, log chronology, discard grouping, and overlay pause semantics unchanged.
- Implement focus entry/containment/return, keyboard close where dismissible, scroll locking, and readable target sizes.
- Verify closing one gate cannot release another; confirmed leave invalidates pending requests while cancelled leave preserves the run.

### Automated Tests

RTL/integration: open/close/confirm/cancel, focus return, no background keyboard activation, public-only history, composed pause. Playwright: long log/discard content at minimum portrait, scroll isolation, keyboard loop/close, leave during pending human and bot activity.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Open each dialog using touch and keyboard, scroll long content, close/cancel, and confirm leave in a separate run. Expected: controls remain reachable, focus returns sensibly, gameplay waits behind the dialog, and cancelled leave loses no progress.

### Expected Result

Portrait overlays retain safe lifecycle behavior and usable focus.

### Definition of Done

- [ ] History/leave surfaces fit and remain usable across matrix.
- [ ] Focus and pause/cancellation contracts pass.
- [ ] No private information or background input leakage.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T06 — Portrait Results and Reduced-Motion Presentation

**Dependencies:** M5-T04, M5-T05

### Goal

Complete the portrait Round/Session lifecycle with reliable reduced-motion behavior.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [orchestrator.md](orchestrator.md), [testing-simulation.md](testing-simulation.md).

### Work

- Adapt fourth-place reveal, Round Result, and Session Summary to portrait, including official ordering/points, five-Round rows, Event Log, Home, and Play Again.
- Preserve explicit Next Round for Rounds 1–4 and automatic Round 5 Summary; tutorial work must not be introduced here.
- Apply reduced-motion preference across existing meaningful card/result motion and selection emphasis without removing required feedback or awaiting absent animation events.
- Ensure skip input is consumed once, keyboard focus lands sensibly through result transitions, and restart/leave cleanup remains intact.

### Automated Tests

RTL/integration: result ordering/ties, reduced-motion initial/change behavior, skip cannot activate Next Round, R5 auto-transition, no double startup, keyboard focus. Playwright: portrait reveal/results/Summary and reduced-motion completion; no clipped action or lifecycle deadlock.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Complete a Round and Session at portrait targets; enable reduced motion and repeat representative result flow. Expected: scores/placement remain clear, Next Round is deliberate, Summary appears, keyboard actions work, and unnecessary movement is reduced.

### Expected Result

A complete portrait Session ends and restarts coherently under both motion preferences.

### Definition of Done

- [ ] Official result content and continuation behavior preserved.
- [ ] Reduced-motion flow completes without hidden/omitted results.
- [ ] Portrait result dialogs and keyboard paths meet the approved contract.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T07 — Full Responsive and Input Regression Sweep

**Dependencies:** M5-T02 through M5-T06

### Goal

Find cross-component portrait/landscape regressions before milestone acceptance.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md).

### Work

- Exercise frozen viewport/input matrix including real mobile available height, safe insets, long content, resize during drag, and supported↔unsupported transitions.
- Inspect keyboard traversal, focus visibility/containment, non-color cues, measured sizing/contrast, and reduced-motion transitions across integrated M5 surfaces.
- Fix bounded M5 defects with focused regressions; report substantial rule/contract/scope conflicts rather than silently redesigning.
- Update README implemented matrix only to support actually delivered and verified behavior; retain known exemptions and record unresolved evidence.

### Automated Tests

Run the full existing and new Playwright suite plus component/integration tests. Assert geometry/interaction outcomes rather than exact animation duration; preserve meaningful landscape tests. Add regressions for each discovered fix.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Execute the frozen matrix checklist on assigned real devices/browsers. Expected: cards and controls stay usable, focus and feedback understandable, dialogs scroll correctly, and no supported layout asks the player to rotate unnecessarily.

### Expected Result

Integrated M5 is ready for complete-Session acceptance with documented evidence gaps.

### Definition of Done

- [ ] All supported matrix cases checked; failures fixed or explicitly blocking acceptance.
- [ ] No unnoticed landscape or input regression.
- [ ] Documentation reflects delivered support without invented manual passes.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# M5-T08 — M5 Five-Round Acceptance and Regression Gate

**Dependencies:** M5-T01 through M5-T07

### Goal

Prove portrait Basic gameplay is complete and the Phase 1 foundation remains reliable.

### Must Read

AGENTS.md; this milestone §§1–10 and this task; [requirements.md](requirements.md), [phase-2-expansion-plan.md](phase-2-expansion-plan.md), [ui-ux.md](ui-ux.md), [testing-simulation.md](testing-simulation.md), [engine.md](engine.md), [orchestrator.md](orchestrator.md).

### Work

- Trace every M5 milestone DoD item to tests and human evidence.
- Run full regression/browser/typecheck/build and deterministic M3 acceptance commands from §7.
- Have humans complete five-Round Basic Sessions on supported portrait phone and tablet classes and the documented landscape regression path.
- Record build/device/input, results, remaining issues, and manual status; do not begin M6 implementation automatically.

### Automated Tests

Full milestone gate commands; deterministic browser smoke through multi-Round/result flow and representative full Session where the production controller fixture makes it practical. Do not replace required real human play with automation.

Run the applicable exact commands in §7 and report observed results; task-specific suites should be named in the completion report.

### Manual Tests

Start and finish five Rounds, including selection/reorder/sort, Play/Pass, overlays, orientation changes, results, and restart. Expected: every required action is usable and Session completion is understandable on approved portrait/landscape targets.

### Expected Result

An accepted portrait/mobile checkpoint suitable for tutorial integration.

### Definition of Done

- [ ] Every M5 milestone DoD item has passing evidence.
- [ ] Required human acceptance executed with no blocking defect.
- [ ] Full automated gates pass; no deferred feature required.
- [ ] Shared §7 verification completed; required manual evidence recorded, or task remains incomplete.
- [ ] No unrelated/deferred work; completion report lists changes, evidence, remaining limitations, and stops.

# 11. Dependency Order and Completion Evidence

Follow the task-map dependencies. Contract tasks block dependent implementation until required approval is recorded. The final task is the milestone gate; passing isolated tasks does not replace integrated acceptance.

For each task record automated command/results, scenario/seed where relevant, and human tester/date/build/browser/device/viewport/input plus actions and expected/observed results. Record approval decisions and acceptance evidence in the relevant task's implementation/acceptance notes when available; no acceptance is pre-filled by this planning document. Reuse existing canonical documents rather than creating an unapproved reporting subsystem.

# 12. Scope Guardrails and Next Checkpoint

After M5 acceptance, the next checkpoint is M6 tutorial infrastructure. Stop after the assigned task; do not automatically implement the next task or commit/push.

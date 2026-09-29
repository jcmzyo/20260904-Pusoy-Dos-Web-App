# Pusoy Dos --- Phase 2 Expansion Plan

**Status:** Approved high-level Phase 2 plan\
**Phase:** Phase 2 --- Mobile Accessibility, Onboarding, and Player
Experience Expansion\
**Depends on:** Completed Phase 1 working product\
**Committed roadmap:** M5--M8

> Phase 2 expands the completed Phase 1 product. It must preserve the
> production Engine, Orchestrator, Baseline AI, simulator/reliability
> path, and gameplay authority rather than replace them.

------------------------------------------------------------------------

# 1. Phase Goal

Phase 2 turns the completed landscape-first Basic Mode game into a more
accessible and teachable product.

The Phase 2 working product must:

-   support complete Basic Mode gameplay on supported **portrait
    phones/tablets** as well as existing supported landscape/desktop
    layouts;
-   teach the project's Pusoy Dos rules through a **hands-on scripted
    tutorial**;
-   provide a concise **Rules / How to Play** reference;
-   improve responsive behavior, accessibility, usability, and selected
    player-facing polish;
-   preserve Phase 1 correctness and architectural boundaries.

Phase 2 is an expansion, not a rewrite.

# 2. Product Outcome

At Phase 2 completion, a player who does not already know the project's
Pusoy Dos rules can open the game on a supported device, complete a
guided scripted tutorial, consult the rules reference when needed, and
complete a normal five-Round Basic Session against three Baseline bots
in either supported portrait or landscape presentation.

Phase 2 does not require accounts, servers, online play, or saving an
unfinished Session.

# 3. Phase Principles

## 3.1 Preserve production authority

``` text
Presentation / Tutorial Guidance
            ↓ human intent
Human PlayerController / tutorial boundary
            ↓
GameRunner / Orchestrator
            ↓
Authoritative Game Engine
            ↑
authoritative state / events / views
```

The UI/tutorial may guide, constrain, explain, highlight, and observe
gameplay. The Engine remains authoritative for legal Moves, combination
recognition/comparison, opening requirements, Pass legality, Trick
behavior, finishing, scoring, and Session results.

## 3.2 Reuse before duplication

Portrait presentation should reuse existing game
state/actions/components where practical while allowing a different
narrow-screen composition.

Tutorial code may control scenarios and guidance but must not duplicate
the canonical rules engine.

## 3.3 Priority order

1.  correctness and architectural integrity;
2.  usability and comprehension;
3.  responsive/mobile accessibility;
4.  tutorial teaching effectiveness;
5.  accessibility;
6.  visual/presentation polish.

## 3.4 QA principle

Automated tests verify behavior and regressions. Human testers verify
human-observable qualities such as readability, practical card
selection/reordering, tutorial clarity, discoverability, and whether
feedback is understandable. Do not assign humans precise millisecond
timing or internal-state checks.

------------------------------------------------------------------------

# 4. Committed Phase 2 Roadmap

A **milestone** must produce a concrete, testable technical output. The
**phase** must end with an integrated working product. Phase 2 commits
to M5--M8.

## M5 --- Portrait & Mobile Experience

**Goal:** Make the existing Basic Mode game fully playable in supported
portrait phone/tablet layouts without regressing landscape/desktop play.

**Technical output:** a responsive presentation system supporting the
approved portrait and landscape viewport matrix through the same
production gameplay state/actions.

High-level scope:

-   intentional portrait composition rather than uniform shrinking;
-   narrow-screen opponent/status presentation;
-   readable current hand to beat and turn information;
-   portrait-compatible human hand;
-   card selection and selected-card elevation;
-   bounded manual hand rearrangement;
-   Sort by Rank / Sort by Suit;
-   Play/Pass and legality feedback;
-   Event Log and Discard Pile access;
-   scores, PASS/DONE, Round Result, and Session Summary;
-   touch-friendly interaction;
-   ratio-preserving cards and readable controls/text;
-   graceful below-minimum behavior;
-   landscape regression coverage.

**Working checkpoint:** a human can complete a five-Round Basic Session
in supported portrait layouts without losing Phase 1 gameplay
functionality.

## M6 --- Tutorial Framework & Scripted Scenario Infrastructure

**Goal:** Build the reusable technical foundation for deterministic
guided tutorial gameplay while keeping the production Engine
authoritative.

**Why M6 and M7 are separate:** M6 owns **how tutorial scenarios run**;
M7 owns **what is taught and the authored tutorial content**. This keeps
framework architecture separate from teaching/content iteration, makes
tasks smaller, and prevents one-off tutorial hacks.

**Technical output:** a tested scenario framework capable of running
authored deterministic tutorials through production gameplay boundaries.

The framework should support as needed:

-   predetermined/declarative hands or controlled deals;
-   controlled scenario/opening state;
-   scripted/scenario-controlled bot intentions;
-   normal Engine validation of every Move;
-   tutorial objectives/checkpoints;
-   contextual instructions/highlighting;
-   observation of authoritative Engine results/events;
-   acceptance of any valid action satisfying an objective when multiple
    solutions exist;
-   corrective feedback without corrupting state;
-   retry/continue behavior;
-   progressive reduction of guidance;
-   deterministic automated reproduction.

The framework must not bypass Engine legality, independently reimplement
hand classification/comparison, or change normal Basic Mode behavior.

**Working checkpoint:** at least one representative end-to-end scenario
proves guided human input, scripted bot behavior, Engine validation,
feedback, and progression.

## M7 --- Scripted Pusoy Dos Tutorial & Rules Reference

**Goal:** Deliver the actual hands-on learning experience using M6.

The tutorial should feel like a deliberately constructed game, not
disconnected flash cards or a long rules document.

``` text
Observe → Explain → Player acts → Authoritative validation
        → Immediate feedback → Continue
```

Guidance becomes lighter as the player progresses.

**Technical output:** a complete scripted tutorial plus a concise Rules
/ How to Play reference aligned with canonical project rules.

The tutorial should teach through controlled gameplay, as appropriate:

-   objective of shedding all cards;
-   turns/table context;
-   3♣ opening rule;
-   Singles, Pairs, Triples;
-   Straight, Flush, Full House, Four of a Kind, Straight Flush;
-   five-card hierarchy;
-   relevant same-type comparison behavior;
-   valid response size/type;
-   voluntary/strategic Pass;
-   no-legal-Play situations;
-   Trick reset / Free Lead;
-   players finishing;
-   Round placement/scoring;
-   Session context where useful.

Not every rule requires a separate Round. Optimize for clarity and
teaching efficiency.

Early steps may require a specific action when that action is the
lesson. Later objectives should accept any Engine-valid action
satisfying the lesson.

Incorrect attempts should normally teach rather than punish: keep
authoritative state unchanged, explain the issue concisely, and allow
retry.

**Rules reference purpose:** Tutorial means "teach me by letting me
play"; Rules reference means "remind me how this rule works."

**Working checkpoint:** a new player can complete the tutorial and
consult the rules/reference experience.

## M8 --- Player Experience, Accessibility & Phase 2 Acceptance

**Goal:** Integrate and harden Phase 2 across devices, inputs, tutorial
flows, and normal gameplay.

**Technical output:** an accepted Phase 2 build where portrait/mobile
gameplay, tutorial content, rules reference, landscape gameplay, and
accessibility requirements operate together without unresolved blocking
regressions.

High-level scope:

-   responsive hardening across approved viewports;
-   touch and mouse verification;
-   keyboard/focus behavior where applicable;
-   readable typography and usable control sizing;
-   sufficient contrast and non-color-only status communication;
-   reduced-motion handling where needed;
-   tutorial usability refinement from actual human testing;
-   appropriate cross-browser checks;
-   focused Playwright browser coverage;
-   React/component/integration coverage;
-   human manual acceptance checklists;
-   full Phase 1 regression verification.

M8 must not become an unrestricted visual redesign.

**Working checkpoint:** the integrated Phase 2 product is usable and
understandable across approved portrait/landscape targets and passes
automated and human acceptance.

------------------------------------------------------------------------

# 5. Phase 2 Functional Scope

## 5.1 MUST HAVE

-   Existing Phase 1 Basic Mode remains functional.
-   Supported portrait phone/tablet gameplay.
-   Existing supported landscape/desktop gameplay remains functional.
-   Intentional portrait composition rather than unreadable shrinking.
-   Human selection, manual hand rearrangement, Sort Rank/Suit, Play,
    and Pass remain usable on supported touch layouts.
-   Current turn, hand to beat/player attribution, PASS/DONE, opponent
    counts, scores, Event Log, and Discard Pile remain accessible.
-   Round Result and Session Summary work in portrait.
-   Hands-on deterministic scripted tutorial framework.
-   Tutorial uses production Engine authority.
-   Complete scripted tutorial with corrective feedback and
    progressively reduced guidance.
-   Rules / How to Play reference.
-   Responsive/accessibility QA.
-   Focused browser automation for high-value responsive/tutorial flows.
-   Human manual acceptance testing.
-   Phase 1 regressions remain green.

## 5.2 SHOULD HAVE

-   clear touch interaction feedback;
-   keyboard/focus accessibility for applicable controls;
-   reduced-motion accommodation for meaningful effects;
-   modest transitions/polish where they improve comprehension;
-   obvious tutorial replay/restart;
-   understandable progress within the current tutorial run.

## 5.3 OPTIONAL POLISH

Only after core M5--M8 work is stable:

-   basic non-essential sound feedback;
-   minor visual polish;
-   small accessibility/presentation preferences with demonstrated need.

Optional polish must not turn Phase 2 into a persistence, progression,
general-settings, or art-overhaul phase.

------------------------------------------------------------------------

# 6. Explicitly Out of Scope

Unless separately approved through a substantial scope change:

-   Competitive Mode;
-   Easy/Normal/Hard difficulty;
-   advanced/Hard AI or deep search;
-   AI personalities;
-   Mystery Bots / Surprise Me;
-   persistence / Resume;
-   persistent statistics;
-   progression, unlocks, achievements, mastery;
-   accounts, cloud saves, leaderboards;
-   online multiplayer/backend/networking;
-   sandbox/practice mode;
-   separate tutorial rules engine;
-   major visual/art overhaul;
-   large sound/music production;
-   auto-pass;
-   speculative infrastructure for uncommitted phases.

------------------------------------------------------------------------

# 7. Portrait Experience Requirements

Portrait presentation may reorganize the table rather than preserve
exact landscape geometry.

At supported portrait sizes, the player must be able to answer:

1.  Whose turn is it?
2.  What is the hand to beat, or is it Free Lead?
3.  Who played it?
4.  What cards do I have?
5.  Which cards are selected?
6.  Can I Play or Pass, and why is an action unavailable?
7.  How many cards do opponents have?
8.  Who has Passed or Finished?
9.  What is the current Round/Session context?
10. How do I access Event Log and Discard Pile?

Cards preserve their intended aspect ratio. Horizontal overlap is
allowed, but enough of every card remains exposed for reliable
selection/reordering.

Human cards remain on a common horizontal baseline; selected cards rise
to a higher horizontal level without changing order. Manual reordering
stays bounded to the hand region and does not change selection state.

------------------------------------------------------------------------

# 8. Tutorial Product Requirements

## 8.1 Scripted game, not sandbox

The tutorial uses deliberately authored game situations so the player
can **try and observe rules in context**.

## 8.2 Controlled but authentic gameplay

Scenarios may control dealt hands, scenario order, bot choices,
instructional timing, progression, and presentation/highlighting.
Gameplay outcomes remain subject to production Engine authority.

If a scripted bot action is illegal, the scenario is defective; the
Engine must not be bypassed.

## 8.3 Progressive player freedom

``` text
high guidance
    ↓
guided choice
    ↓
multiple valid solutions
    ↓
minimal guidance
```

Do not require one exact card choice when several choices satisfy the
lesson unless the exact choice is itself what is being taught.

## 8.4 Mistake handling

An incorrect attempt should normally:

1.  leave authoritative state unchanged;
2.  explain the relevant reason concisely;
3.  direct attention to the needed rule/UI information;
4.  allow another attempt.

Use existing production legality/combination information where possible.

## 8.5 Completion

The final portion should use materially less guidance so completion
demonstrates rule application rather than only following highlights.

------------------------------------------------------------------------

# 9. Rules / How to Play Reference

The reference is concise, scannable, and synchronized with canonical
requirements. It covers at minimum:

-   objective;
-   opening rule;
-   legal combinations;
-   five-card hierarchy;
-   response rules;
-   Pass;
-   Trick reset / Free Lead;
-   finishing / Round completion;
-   Basic scoring;
-   Session structure and relevant tiebreak information.

It is informational only and is not a second rules authority.

------------------------------------------------------------------------

# 10. Testing Strategy

## 10.1 Unit/component/integration

Use the existing test stack for responsive logic, tutorial progression,
scenario validation, objective recognition, UI behavior,
production-boundary integration, and regressions.

## 10.2 Playwright / real-browser automation

Use focused Playwright coverage for high-value flows such as:

-   portrait/landscape viewport transitions;
-   portrait gameplay smoke flow;
-   card selection/rearrangement where browser automation is reliable;
-   overlays;
-   tutorial start/progression/completion;
-   responsive Round Result / Session Summary;
-   critical navigation;
-   landscape regression smoke checks.

Do not duplicate every lower-level test in Playwright.

## 10.3 Human manual testing

Each applicable task should define observable manual checks such as:

-   Can the tester identify whose turn it is?
-   Can every overlapped card be selected?
-   Can cards be rearranged without changing selection?
-   Is the tutorial understandable without developer explanation?
-   After a mistake, does the tester understand what was wrong?
-   Can the tester complete the tutorial without knowing internal state?
-   Are important controls readable and usable?

Do not ask humans to verify internal state or precise millisecond
timings.

## 10.4 Regression

Retain Engine/rule, Orchestrator/controller, Baseline AI,
simulator/reliability, and existing UI regressions. Phase 2 is not
complete if Phase 1 becomes unreliable.

------------------------------------------------------------------------

# 11. Phase 2 Definition of Done

Phase 2 is COMPLETE only when:

-   [ ] M5--M8 satisfy their milestone Definitions of Done.
-   [ ] Normal five-Round Basic Sessions still work on supported
    landscape targets.
-   [ ] Normal five-Round Basic Sessions work on supported portrait
    phone/tablet targets.
-   [ ] Portrait preserves all gameplay-critical information/actions.
-   [ ] Selection, manual rearrangement, sorting, Play, and Pass are
    usable on supported touch layouts.
-   [ ] A new player can enter and complete the scripted tutorial.
-   [ ] Tutorial scenarios use the production Engine as gameplay
    authority.
-   [ ] Tutorial scripts cannot make illegal actions valid by bypassing
    production rules.
-   [ ] Tutorial mistakes provide understandable feedback and
    retry/recovery.
-   [ ] Guidance becomes materially lighter before tutorial completion.
-   [ ] Rules / How to Play reference is available and synchronized with
    canonical rules.
-   [ ] High-value portrait/tutorial browser flows have automated
    regression coverage.
-   [ ] Human manual acceptance has been performed for documented
    observable criteria.
-   [ ] Supported responsive targets have no known blocking clipping,
    overlap, unreadable text, or inaccessible critical controls.
-   [ ] Committed accessibility requirements are verified.
-   [ ] Phase 1 automated regressions remain green.
-   [ ] Deterministic headless reliability remains intact.
-   [ ] No Competitive Mode, advanced AI, persistence, online play,
    sandbox mode, or other deferred system is required for completion.
-   [ ] No known blocking Phase 2 correctness, responsive-usability,
    tutorial-progression, or architectural-authority defect remains.

**Technical deliverable:**

> A production-integrated Basic Pusoy Dos web game that preserves Phase
> 1 while adding supported portrait/mobile gameplay, a deterministic
> Engine-authoritative scripted tutorial, a player-facing rules
> reference, and verified responsive/accessibility improvements.

**Phase 2 working product:**

> A player can learn the project's Pusoy Dos rules through guided
> scripted play and then play a complete Basic Session on supported
> desktop, landscape, or portrait devices using the same authoritative
> production game system.

------------------------------------------------------------------------

# 12. Milestone Dependency Order

``` text
Completed Phase 1
      ↓
M5 Portrait & Mobile Experience
      ↓
M6 Tutorial Framework & Scenario Infrastructure
      ↓
M7 Scripted Tutorial & Rules Reference
      ↓
M8 Player Experience, Accessibility & Phase 2 Acceptance
      ↓
Phase 2 Working Product
```

M5 and early M6 design work may overlap if they do not modify
conflicting contracts/files. Final tutorial UI must be tested against
the Phase 2 responsive foundation.

M7 depends on a sufficiently stable M6 framework. Do not compensate for
missing M6 capability with one-off tutorial hacks.

M8 is integration/acceptance; it must not postpone known correctness
work from M5--M7.

------------------------------------------------------------------------

# 13. Scope-Change Rule

Stop and report before implementation if Phase 2 work unexpectedly
requires:

-   changing a canonical game rule;
-   changing Engine authority;
-   exposing hidden information outside an explicitly approved tutorial
    presentation;
-   persistence;
-   a new game mode;
-   advanced AI/difficulty/personality behavior;
-   backend/networking;
-   or another material expansion beyond M5--M8.

Do not silently reinterpret Phase 2 as permission to implement
previously deferred systems.

------------------------------------------------------------------------

# 14. Post-Phase-2 Planning Rule

Phase 2 commits only to M5--M8.

Competitive Mode, stronger AI/difficulties/personalities,
persistence/statistics/progression, and online multiplayer remain future
candidates rather than implied Phase 3 commitments.

After Phase 2 is complete and evaluated, select the next committed phase
based on the working product and current priorities.

# 15. Approved Planning Clarifications — September 29, 2026

The supplied plan above is preserved. The user subsequently approved these clarifications for its repository documentation and task breakdowns:

- Keyboard/focus support and reduced-motion handling are mandatory Phase 2 acceptance requirements within the scope defined in requirements.md §3.6 and ui-ux.md §19. This supersedes their original SHOULD classification in §5.2; it does not commit full accessibility-standard certification or a Settings screen.
- Retain the existing landscape-phone exemption from literal 14px text / 44×44px control sizes. M5-T01 must approve/freeze portrait viewport/minimum and sizing criteria separately; portrait does not automatically inherit that exemption.
- Create tutorial.md as the tutorial subsystem contract alongside the four M5–M8 task breakdowns. Existing canonical documents are synchronized while M1–M4 task plans remain historical.

requirements.md remains the highest product authority. Exact scenario setup/public API changes and detailed responsive contracts must pass their designated planning/approval tasks before implementation. These documents plan functionality; they do not assert that Phase 2 has been implemented or accepted.

# 16. Approved Main-Menu and Learning Flow Clarification

The user's subsequent product direction refines the Phase 2 plan:

- Main menu **Play** opens a choice window containing **Tutorial** and **Basic Game**. Only selecting an option starts its execution; cancelling returns to the main menu without starting gameplay.
- Tutorial is a deliberately scripted game that initially handholds the player through the rules using guided actions and explanations, then reduces guidance as already required by this plan.
- A directly accessible main-menu **How to Play** opens a comprehensive reference with organized rule explanations, valid examples, scoring/tiebreaks, and current app controls, without entering Play or starting a game. This supersedes the concise-only reference framing in §§1, 4 (M7), and 9; scannability remains a presentation requirement.
- M7 owns this navigation/reference delivery. M5 retains the existing entry as an intermediate checkpoint. Tutorial is an application flow, not a new rules GameMode, and Basic Game retains production five-Round gameplay.

requirements.md §3.6, ui-ux.md §19.2, tutorial.md §8, and the M7/M8 task plans carry the synchronized contracts and acceptance checks. The supplied original plan above remains preserved for provenance.

# 17. Five-Round Tutorial Script Direction

The user requested an authored five-Round tutorial Session covering 1/2/3/5-card hands, playing higher ranks/suits/categories, required and optional Pass, Event Log/Discard Pile and other controls, practical tips such as considering when to save 2♦, free play, and continuation after a finisher. tutorial-script.md supplies the concrete learning script. It includes all five-card categories as learner Plays, open-practice tails, and an unrestricted fifth Round. Tips explain tradeoffs rather than mandate strategy; winning is not required. This is a real five-Round Basic Session under production authority, not a new sandbox or rules mode.

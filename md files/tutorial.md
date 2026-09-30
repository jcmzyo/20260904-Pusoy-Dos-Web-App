# Pusoy Dos --- Tutorial Design

## Tutorial Framework and Content Contract (v1.0)

**Status:** Approved Phase 2 scope; detailed scenario/API/content decisions gated by M6-T01 and M7-T01  
**Last Modified:** October 1, 2026  
**Parent document:** requirements.md v1.17  
**Shared model:** domain-model.md v1.4  
**Engine / Orchestrator:** engine.md v1.8 / orchestrator.md v1.7  
**Presentation / QA:** ui-ux.md v1.14 / testing-simulation.md v1.10  
**Milestones:** M6 framework; M7 authored tutorial/reference; M8 integrated acceptance

# 1. Purpose and Authority

Provide deterministic guided Basic gameplay that teaches the project's rules by doing. From the main menu, Play opens a Tutorial / Basic Game choice window. Tutorial starts an authored scripted game that initially handholds the learner through actions and explains the resulting rules; guidance becomes lighter as understanding develops. Basic Game starts normal play. Neither opening nor cancelling the choice window starts execution. Requirements owns product/rules truth, domain-model owns shared vocabulary, Engine owns legality/state/results, Orchestrator owns execution, and UI owns rendering/input. This document owns tutorial-specific scenario data, objectives, guidance, and content sequencing. It cannot override any higher-authority contract.

M6 owns how scenarios run; M7 owns what is taught. Build only the mechanisms needed by the representative scenario and committed lesson coverage. No generic scripting language, user scenario editor, sandbox, new GameMode, persistence, progress accounts, or separate rules engine.

# 2. Production Boundary

Tutorial UI → tutorial intent/objective boundary → HumanController / PlayerController → GameRunner → authoritative Engine; accepted results/events return to tutorial observation and safe presentation. This is a dependency/ownership contract, not permission for the tutorial to mutate Engine internals.

The existing Engine startup accepts RNG, the runner coordinates controller requests, and normal application startup constructs three Baseline controllers. These are integration candidates, not a guarantee that arbitrary authored setup is already exposed. M6-T01 inspects actual APIs/consumers and freezes the smallest compatible setup path. Prefer controlled production deals/legal replay; if a setup extension is necessary, specify Engine-owned validation and get approval for the substantial public-contract change before coding. Do not sneak arbitrary state restoration into a presentation adapter.

# 3. Scenario Definitions and Setup

Define only the data needed for deterministic setup, human seat, scripted bot intentions, objectives/checkpoints, guidance, and terminal/retry behavior. Exact TypeScript names/shapes are M6-T01 outputs, not frozen by this document.

Every scenario must use physical card uniqueness and valid production setup. A normal Round starts with a complete 52-card deck, four 13-card hands, and the authoritative 3♣ opener. Mid-Round teaching situations must be reached by valid production transitions or an explicitly reviewed Engine-owned validated setup contract; arbitrary partial hands or impossible history are not acceptable shortcuts. No scenario may make a canonical illegal opening/Pass/comparison legal.

Authoring data may describe the whole deal, but that data is privileged setup material. Give presentation and controllers only their authorized views and scoped script data. No explicit hidden-information presentation exception has been approved; seek approval before adding one. Completed-Round reveal remains governed by the production contract.

# 4. Scripted Controllers and Branching

Scripted actors act only when the runner requests their authoritative Turn. Their intentions must resolve to Engine-authorized legal Moves and still pass production submission. Scripts may branch on permitted state/events and objective progress to handle multiple accepted human solutions. They do not inspect unrevealed opponent hands to choose a response or retune Baseline AI.

An unavailable intended Move, exhausted nonterminal script, malformed card reference, or unreachable objective is a scenario defect. Fail with scenario/checkpoint/request context for developer reproduction and a safe player-facing failure path. Never substitute an arbitrary legal Move, silently auto-pass, mutate state, or loop indefinitely to repair it.

# 5. Objectives and Attempt Handling

Observe → explain → player acts → authoritative validation → feedback → continue. Distinguish tutorial admission checks from Engine legality:

1. A constrained early lesson may admit only its explicitly taught action. A different attempt remains uncommitted and gets instructional feedback, not a false claim that the Move is illegal.
2. A candidate admitted by the lesson still uses Engine legality; rejection leaves authoritative state unchanged and does not emit successful gameplay events or advance the objective.
3. Advance gameplay objectives only after observing the authoritative accepted result/event matching the current run/checkpoint. A click, selected card set, or resolved controller promise alone is not proof of an accepted Move.
4. For multi-solution lessons, accept every Engine-valid action satisfying the objective, independent of card-array/display order. Test at least two distinct satisfying actions and their continuations; ensure non-satisfying actions do not falsely pass.
5. Acknowledgment-only explanation steps may advance application guidance without submitting any Move; they cannot fabricate accepted gameplay events.

Use production legality/combination information. Predicates may recognize instructional goals over authoritative facts but must not implement their own hand classifier/comparator/scoring algorithm. The contract for pre-submission goal checks and post-acceptance checks must be frozen in M6-T01 so a legal off-objective attempt is not accidentally committed and then rolled back.

# 6. Run Lifecycle, Feedback, and Recovery

Tutorial run/checkpoint state is separate from Engine Round/Session state. Explanation pauses, retry, and continue use production execution gating; no invisible bot action should run behind a blocking lesson/Rules overlay. Repeated callbacks must not advance twice. Leave/restart/replacement must cancel pending inputs and invalidate prior-run responses/subscriptions.

Mistake retry leaves authoritative state unchanged; replaying a completed segment uses deterministic reconstruction of its setup/approved transitions, not undo by patching state. Freeze the restart boundary in M7-T01; do not add persistence. Scenario defect recovery is distinct from normal learner mistakes and remains diagnostic.

For the authored five-Round script, tutorial completion requires the real fifth Round and Engine Session result, materially reduced final guidance, and an explicit tutorial completion presentation. Winning is not required. It does not mark an unfinished Engine Session complete or fabricate scores. When teaching Round points/Session results, consume real Engine results; normal Basic Sessions still comprise five Rounds.

# 7. Content Coverage (M7)

The authored [five-Round tutorial script](tutorial-script.md) supplies player-facing copy, guided actions, allowed alternatives, all five complete deals, and Engine-checked reference traces. Deliver it as one real five-Round Basic Session: R1 small hands/passing/tools; R2 Straight/Flush/hierarchy; R3 Full House/Four-of-a-Kind; R4 finisher continuation/Straight Flush; R5 unrestricted play. Open practice follows the guided prefix in R1–R4. All eight combination types are played by the learner before final free play.

M7-T01 authors a coherent playable sequence and maps every item below to an observable learner action, demonstration, and/or reference explanation. Avoid one Round per rule and disconnected flash cards. The final Round must allow every Engine-valid action without required highlights or optimal-strategy gates. Reference/tool use remains available; winning or a quiz is not required.

| Topic | Required teaching/verification concern |
|---|---|
| Objective and table | Shed cards, identify current Turn/hand to beat/player attribution, distinguish selected cards |
| Ranking and opening | Canonical rank/suit order, 3♣ required in the first Play; Engine decides opener |
| Small combinations | Single/Pair/Triple, strict improvement, same response size/type, canonical tie behavior |
| Five-card combinations | Straight, Flush, Full House, Four-of-a-Kind with kicker, Straight Flush; final strongest category |
| Five-card comparison | Strict category hierarchy; higher categories beat all lower ones; relevant same-type rules |
| House-rule distinctions | Special low Straights and invalid wraps; suit-first Flush; rank-first Straight Flush; Full House triple/quad rank only |
| Pass and Trick | Voluntary strategic Pass, no-legal-Play, explicit input rather than auto-pass; reset and Free Lead |
| Finishing | Finished players leave rotation; remaining active players take explicit response Turns before reset |
| Round / Session | Official placements and +5/+3/+2/+0, five-Round normal Session, canonical tiebreak explanation |
| Independent application | Multiple valid solutions, lighter final guidance, understandable retry without punishment |

Core actions should be hands-on. Rare comparison details may be concise contextual/reference explanations with valid examples; M7-T01 must make that allocation explicit and demonstrate complete coverage without silently omitting a topic. Every example must respect physical card uniqueness.

# 8. Rules / How to Play

Provide a comprehensive in-app **How to Play**, directly accessible from the main menu independently of Play and without starting a game. Organize it into scannable sections with clear navigation, complete explanations, and physically valid worked examples: objective and table context; rank/suit order; opening; every legal combination and same-type comparison; five-card hierarchy and response restrictions; special Straights and invalid wraps; Pass, reset/Free Lead, and finished-player continuation; Basic Round scoring; five-Round Session structure and all tiebreak steps; and current app controls, including selection, sorting, rearrangement, Play/Pass, history, results, and leaving. A short quick reference is supplementary, not the whole deliverable.

Allow return to the main menu and access/return from an active game/tutorial using production pause/focus behavior. Reuse and synchronize HOW_TO_PLAY.md where appropriate; the in-app guide must be usable without opening a repository Markdown file. It is explanatory content, not a second source of rules truth. M7 owns content/format and delivery-time synchronization of current app instructions.

# 9. Responsive and Accessibility Integration

Use M5's frozen matrix and ui-ux.md §19. Guidance/highlights must not cover critical hand/control areas. Keyboard focus remains stable and actionable; every tutorial/reference control is keyboard accessible. Reduced-motion preference removes unnecessary movement without omitting lessons, results, or completion. Normal gameplay never acquires tutorial restrictions/hints, scripted opponents, or access to authored private hands.

# 10. Verification and Milestone Gates

M6 proves a representative deterministic scenario end to end: guided human input, scripted actors, real validation, rejection/retry, accepted-event progression, at least one multi-solution objective, and clean exit/restart. Validate malformed definitions, illegal scripts, physical invariants, duplicate/stale observations, cancellation, pause, and reproducibility; assert unchanged normal startup and headless behavior.

M7 validates every authored scenario and supported branch, coverage mapping, complete tutorial flow with lighter final guidance, reference accuracy, navigation, and actual new-player feedback. M8 verifies integration across approved devices/inputs/browsers plus full Phase 1 reliability. Follow testing-simulation.md; human comprehension cannot be certified by automated tests. Required human evidence remains MANUAL VERIFICATION PENDING until reported.

# 11. Decisions to Freeze Before Dependent Implementation

- M5-T01: portrait dimensions/minimums, target exposure/sizing, contrast criteria, exact keyboard/reorder bindings, focus behavior, browser/device coverage, and reduced-motion presentation contract.
- M6-T01: deterministic setup and any approved public extension, definition validation, scripted branching, admission versus completion predicates, request/run identity, and diagnostic/recovery boundaries.
- M7-T01: lesson sequence/coverage allocation, authored deals and reachable starting situations, guidance taper, comprehensive reference organization and remaining navigation details within the approved Play → Tutorial / Basic Game flow, and retry/restart/completion UX.

These are explicit planning tasks, not permission for implementation agents to decide substantial product/API changes silently. Preserve higher-authority contracts and obtain approval where required by AGENTS.md.

## Authored open-practice policy

During the exact guided prefix, bots follow tutorial-script.md. At each named handoff they explicitly use the existing Baseline decision policy for subsequent requests in the same Round; Round 5 uses it throughout. This planned transition is not fallback/repair for a defective script and does not change normal Baseline behavior. M6-T01 owns the minimal integration review; instructions/actors must remain information-safe.

# Pusoy Dos --- M2 Baseline AI + Headless Game

## Milestone Design + Task Breakdown (v1.1)

**Status:** Approved milestone design and implementation task plan  
**Last Modified:** September 11, 2026  
**Milestone:** M2 --- Baseline AI + Headless Game  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.13  
**Shared model:** `domain-model.md` v1.3  
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.6  
**AI design:** `ai.md` v1.5  
**Testing strategy:** `testing-simulation.md` v1.7

---

# 1. Milestone Goal

M2 proves that the production game system can autonomously play a complete Basic Pusoy Dos Session without React or another UI.

The milestone adds the application-control and AI layers around the M1 Engine:

```text
Game Engine
    ↓
GameRunner / Orchestrator
    ↓
PlayerController
    ↓
Deterministic Baseline Bot
```

The technical outcome is four deterministic Baseline controllers completing a real five-Round Basic Session through the production Engine and Orchestrator.

M2 is not intended to produce strong or human-like AI. It establishes a rational, deterministic, testable baseline that later AI can replace or extend without changing Engine authority.

---

# 2. Scope

M2 includes:

- the production `GameRunner` / Orchestrator;
- the asynchronous `PlayerController` boundary;
- safe controller turn requests;
- stale-response and invalid-controller handling;
- headless Round and Session progression;
- one deterministic Baseline Bot strategy;
- strategic PASS evaluation when responding;
- exact memoized remaining-hand decomposition;
- lightweight tactical/context evaluation;
- canonical deterministic tie-breaking;
- decision instrumentation needed for debugging and later M3 analysis;
- unit and integration tests proving deterministic, legal autonomous play.

M2 supports **Basic Mode only** for Phase 1 execution.

---

# 3. Explicit Non-Goals

M2 does not implement:

- Competitive Mode AI;
- Easy / Normal / Hard difficulty levels;
- AI personalities;
- controlled/random personality variation;
- sophisticated opponent modeling;
- hidden-hand inference assigned to specific opponents;
- deep lookahead;
- Minimax / MaxN;
- hidden-hand determinization;
- Monte Carlo rollouts;
- MCTS / ISMCTS;
- machine learning or neural networks;
- advanced card counting;
- persistent player statistics;
- React/UI;
- M3 batch-simulation infrastructure.

Known future techniques may inform clean extension seams, but must not expand M2 implementation scope.

---

# 4. Architectural Boundaries

## 4.1 Engine authority

The Engine remains authoritative for:

- rules;
- combination inspection/classification;
- comparison;
- Move legality;
- legal Move generation;
- Trick/Turn transitions;
- Round lifecycle;
- Session lifecycle;
- scoring;
- authoritative events/state.

The AI selects among Engine-authorized actions. It must not become a second rules engine.

## 4.2 Orchestrator authority

The Orchestrator owns:

- mapping players to controllers;
- asking the correct controller to act;
- supplying safe view + legal Moves;
- serializing controller turns;
- rejecting/handling stale controller responses;
- forwarding proposed Moves to the Engine;
- Round Result checkpoint handling;
- headless auto-continuation between Rounds;
- Session lifecycle coordination.

It does not decide whether a Move is legal or strategically good.

## 4.3 Controller authority

A `PlayerController` supplies player intent only.

Conceptually:

```ts
interface PlayerController {
  readonly playerId: PlayerId;
  chooseMove(request: PlayerTurnRequest): Promise<Move>;
}

interface PlayerTurnRequest {
  readonly playerId: PlayerId;
  readonly view: PlayerView;
  readonly legalMoves: readonly Move[];
  readonly requestId: string;
}
```

The final concrete contract may refine names/fields, but must preserve the boundary.

---

# 5. Baseline Bot Algorithm Decision

The selected Phase 1 Baseline Bot is:

> **A deterministic hybrid Move evaluator using exact memoized hand decomposition as the primary hand-structure signal, combined with lightweight tactical/context evaluation, strategic PASS evaluation, and canonical deterministic tie-breaking.**

Decision outline:

```text
PlayerView + Engine legal Moves
        ↓
Determine free-lead / response context
        ↓
Build candidate actions
        ↓
Canonicalize candidate ordering
        ↓
Immediate-finish check
        ↓
Evaluate candidates
        ├─ exact remaining-hand decomposition
        ├─ resource cost / preservation
        ├─ immediate shedding value
        ├─ PASS opportunity cost
        ├─ Trick/control context
        └─ public opponent-card-count pressure
        ↓
Structured deterministic comparison
        ↓
Canonical deterministic tie-break
        ↓
PLAY or PASS
```

The exact evaluator ordering/constants may be refined during detailed M2 design and implementation, but must remain explicit, deterministic, understandable, and covered by behavior tests.

---

# 6. Strategic PASS

PASS is a first-class candidate whenever the bot is legally responding to another player's Move.

```text
responding:
    candidates = legal beating Plays + PASS

free lead:
    candidates = legal Plays only
```

The bot may therefore PASS even when one or more beating Plays exist.

PASS must not be modeled merely as the fallback used when no beating Play exists.

The evaluator should consider the tradeoff between preserving strategic resources and surrendering an immediate shedding/control opportunity.

Examples that may favor PASS include wasting a high 2 or damaging useful hand structure under low pressure. Examples that may favor Play include a cheap response, immediate finish, material hand-structure improvement, or an opponent close to going out.

A public opponent PASS must not be interpreted as proof that opponent lacked a legal response.

---

# 7. Exact Remaining-Hand Decomposition

For each Play candidate:

```text
remainingHand = currentHand - playedCards
```

For PASS:

```text
remainingHand = currentHand
```

The primary structural metric is:

> minimum number of valid future Plays required to partition and empty the remaining hand, ignoring opponent interference.

This is a hand-structure estimate, not a prediction of actual Turns required to finish.

## 7.1 Bitmask model

A hand contains at most 13 cards, so local subsets can be represented with a bitmask.

```text
2^13 = 8192 possible subset masks
```

Conceptual solver:

```text
solve(mask):
    if mask == 0: return 0
    if cached: return cached

    pivot = one fixed remaining card
    best = infinity

    for each valid combination contained in mask that contains pivot:
        best = min(best, 1 + solve(mask without combination))

    cache and return best
```

Restricting expansion to combinations containing a fixed pivot avoids exploring permutations of the same partition while preserving the exact minimum.

Memoized subset results should be reusable across candidate Moves within a decision. Cache state must never alter the selected action.

---

# 8. Candidate Evaluation

The initial evaluator should prefer an understandable structured/lexicographic comparison over one opaque weighted formula full of arbitrary constants.

The design direction is:

1. immediate finish / terminal opportunity;
2. resulting-hand efficiency via exact decomposition;
3. urgent public opponent pressure;
4. resource cost / preservation;
5. immediate shedding progress;
6. lightweight Trick/control value;
7. canonical deterministic tie-break.

This ordering is a design baseline, not an immutable formula. Detailed task design may refine precedence where concrete behavior examples reveal conflicts.

Important constraint:

> Exact decomposition is the primary hand-structure signal, but not an absolute rule that can never be overridden by obvious tactical context.

Avoid double-counting structural damage already reflected by decomposition when adding resource-preservation heuristics.

---

# 9. Permitted AI Information

The Baseline Bot may use only legitimate player-facing information, including:

- own hand;
- Engine-provided legal Moves;
- current hand/combination to beat;
- free-lead/response state;
- publicly played cards/history;
- public pass history;
- each player's remaining-card count;
- active/finished players;
- turn order;
- Round number;
- current Session scores/standings.

It may derive unseen cards as:

```text
52-card deck - own cards - publicly played cards
```

but must not assign unseen cards to specific opponents as known holdings.

Lightweight Session-standing use is permitted if retained during final evaluator design, but sophisticated Session strategy is not required for Baseline M2.

---

# 10. Determinism Contract

Required property:

```text
same permitted PlayerView
+ same private hand
+ same candidate action set
+ same Baseline configuration
= same selected action
```

The choice should also remain identical if the same legal Move set arrives in a different array order.

The implementation must not rely on:

- `Math.random()`;
- timing-dependent choices;
- unstable collection order;
- incidental object insertion order;
- unordered tie handling;
- cache traversal order;
- floating-point equality without an explicit tie policy.

Every candidate must have a canonical total ordering. The exact key may be finalized during M2 detailed design, but should ultimately use stable semantic/card identifiers rather than input order.

Required determinism tests include:

- repeated identical execution;
- shuffled legal-Move input ordering;
- cold vs warm decomposition cache.

---

# 11. Performance and Instrumentation

No arbitrary millisecond SLA is frozen for M2.

The actual TypeScript implementation must be measured on representative and adversarial/high-choice states.

Useful metrics include:

- hand size;
- legal candidate count;
- Play candidate count;
- PASS availability;
- candidate evaluations;
- decomposition states visited;
- valid combination masks considered;
- cache hits/misses;
- decision duration;
- selected action.

Particular benchmark cases should include:

- 13-card hand;
- free lead with many legal Moves;
- many overlapping five-card combinations;
- many candidate remaining hands;
- cold decomposition cache;
- declining hand sizes.

Correctness and reproducibility outrank micro-optimization. Memoization is encouraged where it preserves semantics.

---

# 12. Headless Game Flow

M2 must exercise the same production boundaries intended for M4:

```text
Engine state
→ Orchestrator identifies current player
→ safe PlayerView + legal Moves
→ PlayerController.chooseMove(...)
→ stale-response check
→ Engine.submitMove(...)
→ process authoritative result/events
→ repeat
```

At Round completion:

```text
Engine official Round result
→ Orchestrator ROUND_RESULT checkpoint
→ headless runner may auto-continue
→ next Round
```

After exactly five Rounds, the Session must terminate with the Engine's official Session result.

---

# 13. Testing Strategy

M2 testing must include both AI unit behavior and complete Orchestrator integration.

Required behavior areas include:

- immediate finish;
- free lead with many combinations;
- cheap response vs unnecessarily strong response;
- PASS despite a legal beating Play;
- cheap Play preferred over unnecessary PASS;
- PASS preferred over wasting a major control resource when evaluator rules imply it;
- opponent with one card remaining changing pressure behavior;
- small own-hand endgame;
- preserving/breaking Pairs and five-card structures;
- different remaining minimum decompositions;
- strategically equivalent candidates;
- deterministic tie-break;
- shuffled legal-Move ordering;
- repeated execution;
- cold/warm cache consistency;
- special Straight structures involving A and 2;
- high-value 2 usage;
- information-safety / hidden-hand isolation.

Expected Moves must follow the documented evaluator, not arbitrary test authorship.

Integration tests must prove:

- four Baseline controllers finish a Round;
- four Baseline controllers finish a five-Round Session;
- controllers cannot mutate authoritative Engine state;
- all submitted accepted Moves are legal;
- controller errors do not silently corrupt game state;
- M1 regression suite remains green.

---

# 14. Risks and Controls

## 14.1 Evaluator ambiguity

Risk: structured priorities can conflict in edge cases.

Control: document concrete precedence and behavior examples before encoding them. Material ambiguity becomes `CLARIFICATION REQUIRED` rather than hidden magic weights.

## 14.2 Accidental rules duplication

Risk: decomposition needs valid combination knowledge and could become a parallel rules engine.

Control: reuse Engine-compatible authoritative combination semantics/utilities where architecturally appropriate. AI-specific decomposition may analyze partitions, but must not redefine what constitutes a valid canonical combination.

## 14.3 Performance surprise

Risk: repeated exact decomposition across many legal Moves may be slower than expected.

Control: benchmark actual <=13-card TypeScript workloads and exploit shared memoized subset states before considering approximation.

## 14.4 Strategic PASS overuse

Risk: resource preservation could make the bot pass excessively.

Control: explicit shedding/opportunity cost and opponent-pressure behavior; behavioral tests for both appropriate Pass and appropriate Play.

---

# 15. Definition of Done

M2 is COMPLETE only when all applicable items below are satisfied:

- [ ] A stable `PlayerController` abstraction exists for AI and future human control.
- [ ] Orchestrator requests actions from the correct controller using safe player-facing information.
- [ ] Orchestrator serializes turns and protects against stale asynchronous responses.
- [ ] Orchestrator does not duplicate Engine legality, scoring, or lifecycle rules.
- [ ] Baseline Bot chooses only Engine-authorized candidate actions.
- [ ] PASS is evaluated as a first-class candidate whenever responding and remains unavailable on free lead.
- [ ] Baseline Bot uses exact memoized remaining-hand decomposition as its primary hand-structure signal.
- [ ] The decomposition algorithm returns exact minimum valid-play partitions for covered hands and respects canonical combination semantics.
- [ ] Tactical evaluation includes only lightweight, documented factors needed by the Baseline design.
- [ ] The bot uses no hidden opponent hands or prohibited Engine-private information.
- [ ] A public PASS is not interpreted as proof of inability to respond.
- [ ] Immediate legal finish is preferred over PASS/non-finishing alternatives.
- [ ] Identical permitted decision inputs produce the same selected Move.
- [ ] Reordering an otherwise identical legal-Move set does not alter the selected action.
- [ ] Cold and warm cache behavior produce the same selected action.
- [ ] No uncontrolled/random decision mechanism is used.
- [ ] Decision/decomposition instrumentation is available for tests/debugging and later M3 integration without changing decision semantics.
- [ ] Representative and adversarial decision performance is measured; no known unbounded or obviously unusable interactive behavior remains.
- [ ] Four Baseline controllers can autonomously complete a valid Basic Round through production Engine + Orchestrator.
- [ ] Four Baseline controllers can autonomously complete exactly five Basic Rounds and reach an official Session result.
- [ ] Representative AI unit and Orchestrator integration tests pass.
- [ ] Full M1 regression suite passes.
- [ ] Typecheck and applicable build/test commands pass.
- [ ] No M3/M4/deferred AI feature is required for M2 completion.

**Technical deliverable:**

> A deterministic headless Basic Pusoy Dos game in which four rational Baseline controllers complete a real five-Round Session through the production Engine and Orchestrator, using exact memoized hand decomposition, lightweight contextual evaluation, strategic PASS, and deterministic tie-breaking.

---

# 16. M2 Task Breakdown

## 16.1 Planning Rules

Tasks are sized for short, isolated coding-agent cycles: one main responsibility, one observable result, focused tests, and no automatic continuation into the next task. They should be small enough to avoid excessive coding-agent context consumption, but large enough that repository rediscovery, document rereading, verification, and reporting do not outweigh the implementation work.

T08 and T11 are intentionally the largest tasks in M2. Their internal stages must be completed incrementally rather than splitting them into many low-value microtasks unless implementation evidence shows they are too large.

A task is COMPLETE only when every task-specific DoD item is satisfied; unavailable verification must be reported as NOT VERIFIED.

| Mini-milestone | Tasks | Technical checkpoint |
|---|---|---|
| Controller boundary | M2-T01–T02 | Safe asynchronous controller request contract |
| Orchestrator turn loop | M2-T03–T05 | Controller Moves safely reach the Engine |
| Headless lifecycle | M2-T06–T07 | Round and five-Round Session run headlessly |
| AI structural analysis | M2-T08–T09 | Exact decomposition works and is measured |
| Baseline policy | M2-T10–T12 | Deterministic PLAY/PASS policy works |
| Integration/acceptance | M2-T13–T14 | Four Baseline bots complete production Sessions |

**Total: 14 tasks.**

## M2-T01 — PlayerController and Turn Request Contracts

**Goal:** Create the minimal async boundary usable by Baseline AI and the future human controller.

**Work:** Define `PlayerController`, `PlayerTurnRequest`, request identity, and minimal controller-facing types. Do not implement orchestration or AI policy.

**Tests:** Contract compiles; request data is read-only where appropriate; no mutable authoritative Engine state is exposed; separately created requests can be distinguished.

**Expected result:** Any controller can receive permitted turn information and asynchronously return a `Move`.

**DoD:**
- [ ] Async controller contract compiles.
- [ ] Request carries player identity, safe `PlayerView`, legal Moves, and request identity (or finalized equivalents).
- [ ] No mutable authoritative state is exposed.
- [ ] Focused tests/typecheck and M1 regressions pass.
- [ ] No Orchestrator lifecycle or AI policy is implemented.

## M2-T02 — Safe Controller Request Construction

**Goal:** Build a controller request from authoritative state using only Engine-approved safe information.

**Work:** Implement this as a narrow request-construction seam/helper: obtain the current player, safe `PlayerView`, Engine legal Moves, and fresh request identity, then return the controller-safe request. Do not invoke the controller and do not build GameRunner lifecycle behavior in this task.

**Tests:** Correct acting player; legal Moves originate from Engine; opponent hands/private state absent; request IDs are fresh; request construction does not mutate gameplay state.

**Expected result:** The application layer can construct exactly what a controller is permitted to see.

**DoD:**
- [ ] Uses Engine safe-view/legal-Move APIs.
- [ ] Hidden/private information is absent.
- [ ] Request creation is gameplay-state side-effect free.
- [ ] Focused tests, regressions, and typecheck pass.
- [ ] No controller invocation/AI logic is added.

## M2-T03 — Serialized Single Controller Turn

**Goal:** Execute one normal controller-driven Turn through the production Engine.

**Work:** Map current player to controller → build request → await `chooseMove` → submit returned Move to Engine → surface result/events.

**Tests:** Correct controller invoked; request is safe; returned Move goes through Engine; missing/mismatched controller fails explicitly without mutation.

**Expected result:** One controller Turn can complete through the real application boundary.

**DoD:**
- [ ] Correct controller is selected.
- [ ] Move is forwarded to Engine, never independently applied.
- [ ] Orchestrator does not decide legality.
- [ ] Mapping errors are explicit and safe.
- [ ] Focused integration tests/regressions/typecheck pass.
- [ ] No stale-response/full-loop behavior yet.

## M2-T04 — Stale and Duplicate Response Protection

**Goal:** Prevent delayed async responses from applying to a newer Turn/state.

**Work:** Validate request identity/current-turn context before Engine submission.

**Tests:** Current response works; old request rejected; no-longer-current player rejected; duplicate consumed response cannot submit twice; rejected response leaves state unchanged.

**Expected result:** Old async controller results cannot mutate newer authoritative state.

**DoD:**
- [ ] Freshness rule is explicit.
- [ ] Stale/duplicate responses cannot reach accepted transition.
- [ ] Rejection leaves state unchanged.
- [ ] Focused tests/regressions/typecheck pass.
- [ ] No M4 UI-specific cancellation system is added.

## M2-T05 — Controller Failure and Invalid-Response Handling

**Goal:** Make controller failures safe and diagnosable.

**Work:** Handle controller rejection/exception, malformed or mismatched intent, Engine-rejected Move, and controller/request mismatch. Do not invent fallback Moves.

**Tests:** Each failure is explicit; state remains valid; no silent substitute Move; context identifies player/request.

**Expected result:** Bad controller behavior reports/stops safely rather than corrupting the game.

**DoD:**
- [ ] Controller exceptions/rejections are handled.
- [ ] Engine-rejected Moves are surfaced.
- [ ] No arbitrary fallback Move is selected.
- [ ] Failure context is diagnosable.
- [ ] Focused tests/regressions/typecheck pass.

## M2-T06 — Autonomous Headless Round

**Goal:** Repeatedly execute controller Turns until the Engine completes one Basic Round.

**Work:** Implement Round GameRunner loop using deterministic test controllers where useful. Do not duplicate Round/placement/scoring rules.

**Tests:** Only current active player requested; finished players handled through Engine; official Round termination/result reached; no extra request after completion.

**Expected result:** One complete Basic Round runs headlessly without depending on Baseline AI.

**DoD:**
- [ ] Round terminates only on Engine-defined completion.
- [ ] No Round/scoring rule is duplicated.
- [ ] Official Round result is surfaced.
- [ ] Deterministic integration fixture completes.
- [ ] Regressions/typecheck pass.

## M2-T07 — Five-Round Headless Session and Round Checkpoint

**Goal:** Extend headless orchestration to exactly five Rounds while preserving the explicit Round Result checkpoint needed by M4.

**Work:** Round end → `ROUND_RESULT` checkpoint → headless auto-continue → next Round → official Session result.

**Tests:** Checkpoint after each Round; headless continuation works; exactly five Rounds; no sixth Round; cumulative scores/Session result come from Engine.

**Expected result:** Production Orchestrator completes a Basic Session with deterministic test controllers.

**DoD:**
- [ ] Round Result checkpoint exists as an application lifecycle seam.
- [ ] Headless continuation works.
- [ ] Exactly five Rounds execute.
- [ ] Session completion is Engine-authoritative.
- [ ] Round-1 continuation and Round-5 termination tests pass.
- [ ] Regressions/typecheck pass.
- [ ] No React/UI is added.

## M2-T08 — Exact Minimum-Play Hand Decomposition

**Goal:** Implement the selected exact structural analyzer: minimum valid Plays required to partition/empty a <=13-card hand, ignoring opponents.

**Work:** Implement in two explicit internal stages while keeping T08 one cohesive task:

1. **Combination-mask preparation:** map the local hand to stable card indices/bitmasks and derive the valid playable combination masks using canonical Engine-compatible combination semantics.
2. **Exact partition solver:** consume those masks using memoization plus fixed-pivot/lowest-set-bit partitioning (or an equally exact approved alternative) to compute `minPlays`.

Complete and test Stage 1 before layering Stage 2. Do not add tactical AI scoring in either stage.

**Tests:** Empty hand; singles; Pair/Triple/five-card structures; overlapping combinations; special A/2 Straights; same-suit Straight overlap; representative 13-card hands. Where practical, cross-check small hands with a simple exhaustive reference solver.

**Expected result:** Exact deterministic `minPlays(hand)` for every valid <=13-card hand.

**DoD:**
- [ ] Supports 0–13 cards.
- [ ] Result is exact, not greedy.
- [ ] Memoization exists.
- [ ] Fixed-pivot optimization or approved exact equivalent exists.
- [ ] Canonical combination semantics are reused.
- [ ] Exactness tests, Engine regressions, and typecheck pass.
- [ ] No tactical scoring is implemented.

## M2-T09 — Decomposition Instrumentation and Benchmarks

**Goal:** Measure actual TypeScript decomposition cost and expose diagnostics useful for later M3 analysis.

**Work:** Collect states visited, combination masks considered, cache hits/misses, hand size, and benchmark duration where appropriate. Exercise 13-card/high-overlap and declining-hand fixtures. Do not freeze an arbitrary SLA.

**Tests:** Instrumentation on/off same result; cold/warm cache same result; repeated analysis deterministic; representative worst-looking fixtures terminate.

**Expected result:** Real performance evidence and non-semantic decomposition diagnostics.

**DoD:**
- [ ] Required metrics can be collected.
- [ ] Metrics do not alter semantics.
- [ ] Cold/warm exactness is verified.
- [ ] Representative <=13-card benchmarks run.
- [ ] Results are reported rather than converted into an invented SLA.
- [ ] Regressions/typecheck pass.
- [ ] No approximation is introduced without a new approved decision.

## M2-T10 — Deterministic Candidate Construction and Ordering

**Goal:** Build the stable action set consumed by the evaluator.

**Work:** Determine free-lead/response context; use Engine-authorized Plays; include strategic PASS when responding; exclude PASS on free lead; canonicalize into input-order-independent total order; detect immediate-finishing Plays.

**Tests:** Free lead Play-only; response includes PASS even with beating Plays; shuffled legal-Move input canonicalizes identically; immediate finish identified; canonical ordering respects semantic/card identity.

**Expected result:** A deterministic candidate set independent of incoming array order.

**DoD:**
- [ ] Candidates derive from Engine-authorized actions.
- [ ] PASS availability matches canonical rules.
- [ ] Input order cannot change canonical ordering.
- [ ] Immediate finishes are identifiable.
- [ ] No randomness/unstable iteration dependency exists.
- [ ] Focused tests/regressions/typecheck pass.
- [ ] No tactical evaluator yet.

## M2-T11 — Core Baseline Candidate Evaluation

**Goal:** Implement the approved deterministic PLAY/PASS evaluator without advanced opponent modeling/search.

**Work:** Build the structured evaluator incrementally in this order:

1. immediate finish / terminal opportunity;
2. resulting-hand `minPlays`;
3. immediate shedding and PASS opportunity cost;
4. lightweight resource preservation/cost;
5. lightweight Trick/control context;
6. canonical deterministic fallback/tie-break.

Add focused tests as each layer is introduced before adding the next layer. Avoid opaque magic-weight formulas and structural double-counting. This remains one cohesive task because these dimensions together define the core evaluator.

**Tests:** Immediate finish; better decomposition; cheap response vs major-resource waste; strategic PASS; cheap Play over unnecessary PASS; Pair/five-card preservation; high 2 use; deterministic tie-break.

**Expected result:** Rational deterministic choices from own-hand structure and immediate context.

**DoD:**
- [ ] Immediate finish has terminal priority.
- [ ] Exact decomposition is primary hand-structure signal.
- [ ] PLAY and PASS share one documented evaluation framework.
- [ ] Resource/shedding/control signals are lightweight and explicit.
- [ ] Tie-break is canonical.
- [ ] Behavioral tests/regressions/typecheck pass.
- [ ] No hidden information/deep search is introduced.

## M2-T12 — Public Opponent Pressure and Final Determinism

**Goal:** Complete the Baseline policy with lightweight public card-count pressure and prove full decision reproducibility.

**Work:** Treat this task as two explicit parts:

- **Part A — Policy extension:** adjust willingness to PASS/contest when public opponent card counts indicate endgame pressure. Do not infer specific unseen holdings.
- **Part B — Policy lock/verification:** run the full determinism matrix against the completed Baseline decision policy.

Do not add material Session-standing strategy unless separately approved.

**Tests:** One/few-card opponent pressure; no hidden-card assumptions; opponent PASS not treated as inability; repeated execution; shuffled legal Moves; cold/warm cache; instrumentation on/off all select same Move.

**Expected result:** Final Baseline policy uses only approved information and is deterministic for identical semantic input.

**DoD:**
- [ ] Public card-count pressure is implemented/documented.
- [ ] No specific hidden holdings are assumed.
- [ ] Voluntary PASS is not treated as inability.
- [ ] Repeated/input-order/cache/instrumentation determinism tests pass.
- [ ] No uncontrolled randomness exists.
- [ ] Regressions/typecheck pass.
- [ ] No difficulty/personality/search feature is added.

## M2-T13 — Production Baseline Headless Integration

**Goal:** Run four production Baseline Bot controllers through the real GameRunner.

**Work:** Replace test controllers with four Baseline controllers using the same Engine/Orchestrator boundaries intended for M4. Do not create an AI-only game loop.

**Tests:** Four bots complete a Round and exactly five-Round Session; bots receive no hidden state; bots cannot mutate Engine state; Round checkpoint auto-continuation works; official Session result reached.

**Expected result:** The real Baseline AI autonomously completes the production Phase 1 game flow.

**DoD:**
- [ ] Four Baseline controllers map correctly.
- [ ] Full Round completes.
- [ ] Full five-Round Session completes.
- [ ] No special AI-only rules/game loop exists.
- [ ] Information boundary remains safe.
- [ ] Integration is deterministic/reproducible.
- [ ] M1/M2 regressions/typecheck pass.
- [ ] No M3 batch simulator is added.

## M2-T14 — M2 Acceptance and Regression Verification

**Goal:** Perform milestone-level acceptance without turning the task into a catch-all feature task.

**Work:** Run AI tests, Orchestrator integration, complete headless Session, determinism suite, decomposition exactness, representative performance measurements, full M1 regression, typecheck, and applicable repository build/test verification. Add only missing acceptance/regression tests discovered during review.

**Defect-routing rule:** T14 is an acceptance task, not a catch-all repair task. If it exposes a substantial defect, route the fix back to the task/component that owns that behavior, add the appropriate focused regression there, then rerun T14. Small acceptance-test omissions may be corrected directly in T14.

**Tests:** Include representative free lead, strategic PASS, immediate finish, high-choice decomposition, opponent pressure, and full five-Round autonomous Session.

**Expected result:** Objective evidence that M2 satisfies its technical deliverable and M1 remains intact.

**DoD:**
- [ ] Every M2 milestone DoD item is PASS or explicitly unresolved.
- [ ] Focused M2 tests pass.
- [ ] Full M1 regression passes.
- [ ] Typecheck and applicable build/test verification pass.
- [ ] Representative performance measurements are reported.
- [ ] No known hidden-information leak or inconsistent duplicated rule remains.
- [ ] No deferred feature is required for M2 completion.
- [ ] Four Baseline bots demonstrably complete an official five-Round Session.
- [ ] Unrun verification is reported as NOT VERIFIED, never falsely PASS.

## 16.2 Dependency Model

The implementation order is intentionally sequential for a task-by-task coding-agent workflow, but the architecture has two conceptually separate workstreams after the controller boundary is established:

```text
                 T01–T02
                    │
           controller boundary
                    │
           ┌────────┴────────┐
           ▼                 ▼
       T03–T07            T08–T12
     Orchestrator             AI
           │                 │
           └────────┬────────┘
                    ▼
                   T13
             full integration
                    ↓
                   T14
               acceptance
```

T03–T07 prove application/game flow using simple deterministic controllers before the production Baseline AI exists. T08–T12 develop and test the Baseline decision subsystem without requiring a special AI-only game loop. T13 is the deliberate integration point.

This separation is architectural rather than an instruction to implement tasks in parallel. For the current coding-agent workflow, sequential execution remains preferred because it minimizes branch coordination, repeated context loading, and integration conflicts.

## 16.3 Recommended Order

```text
T01 Controller contract
 ↓
T02 Safe request construction
 ↓
T03 Single controller Turn
 ↓
T04 Stale response protection
 ↓
T05 Controller failure handling
 ↓
T06 Headless Round
 ↓
T07 Five-Round Session/checkpoint
 ↓
T08 Exact decomposition
 ↓
T09 Decomposition metrics/benchmarks
 ↓
T10 Candidate construction/order
 ↓
T11 Core evaluator + strategic PASS
 ↓
T12 Opponent pressure + determinism
 ↓
T13 Production Baseline integration
 ↓
T14 M2 acceptance
```

This intentionally proves the Orchestrator with simple deterministic controllers before adding AI complexity, then proves the AI structural primitive before tactical policy.

## 16.4 Per-Task Scope Guardrails

For every task:

1. Do not start the next task automatically.
2. Do not refactor unrelated M1 code unless a concrete blocker/defect is found and reported.
3. Do not weaken tests.
4. Do not duplicate canonical game rules in AI/Orchestrator.
5. Do not add difficulty, personality, Competitive AI, Monte Carlo/MCTS/ISMCTS, deep search, React, persistence, or M3 batch simulation.
6. Material ambiguity is `CONFLICT / CLARIFICATION REQUIRED`, not a silent choice.
7. Cache state, instrumentation, legal-Move order, timing, and collection iteration must not alter semantic decisions.
8. Never report tests/builds as passed unless actually executed.
9. Follow repository Git safety rules; Git writes remain user-controlled.

---

# 17. Research Basis and Decision Provenance

The algorithm decision is an engineering selection informed by Big Two rule-based AI research, imperfect-information search research, inspectable Big Two implementations using exact bitmask/set-partition decomposition, and the small <=13-card hand domain.

External algorithms are references only. Project house rules and Engine contracts override external suit orders, Straight definitions, category hierarchy, bomb rules, opening rules, legality, and comparison semantics.

The research handoff should be retained alongside project planning as the decision provenance for this milestone.

# Pusoy Dos --- Game Engine Design

## Game Engine Document (v1.5)

**Status:** Draft for implementation\
**Last Modified:** September 8, 2026
**Parent document:** `requirements.md` v1.10\
**Shared model:** `domain-model.md` v1.2\
**Module:** Game Engine\
**Language:** TypeScript

------------------------------------------------------------------------

> **Phase 1 implementation scope:** Basic Mode only. Competitive sections are preserved as deferred approved design. `RulesetConfig` remains a lightweight extension seam, but Phase 1 must not implement speculative mode/framework complexity merely to support future work.

# 1. Purpose

The Game Engine is the authoritative rules and state-transition core of
the Pusoy Dos application.

It answers:

> Given the current authoritative game state and a proposed action, what
> is legal, what authoritative state results, and what factual game
> events occurred?

`requirements.md` defines product truth and canonical gameplay rules.

`domain-model.md` defines shared concepts such as `Card`, `Rank`,
`Suit`, `PlayerId`, `GameMode`, `Combination`, and `Move`.

This document defines only the responsibilities, state, algorithms, and
public contracts specifically owned by the Game Engine.

------------------------------------------------------------------------

# 2. Engine Responsibilities

The Game Engine owns:

-   authoritative runtime game state;
-   deck construction, shuffle, and deal behavior;
-   card rank/suit comparison according to the active ruleset;
-   combination detection;
-   combination comparison;
-   legal move generation;
-   move validation;
-   turn and Trick state transitions;
-   finished-player handling;
-   Round lifecycle rules;
-   Session lifecycle rules;
-   Basic Mode rule execution and scoring;
-   Competitive Mode rule execution and scoring;
-   Session winner and tiebreak calculation;
-   ruleset configuration used by authoritative algorithms;
-   deterministic engine randomness;
-   information-safe game-state projections;
-   structured validation/results;
-   factual engine event contracts;
-   engine invariants.

The engine is the single authoritative implementation of these rules.

------------------------------------------------------------------------

# 3. Non-Responsibilities

The Game Engine does not own:

-   shared domain type definitions already specified by
    `domain-model.md`;
-   controller selection or lifecycle;
-   asking a Human/AI/Network Controller for a Move;
-   AI strategy, personality, or difficulty behavior;
-   React components or UI state;
-   manual card ordering or selection state;
-   animations or presentation delays;
-   persistence/storage implementation;
-   event storage, formatting, filtering, or UI log history;
-   headless simulation orchestration;
-   network transport.

These concerns belong to their respective subsystem documents.

------------------------------------------------------------------------

# 4. Architectural Boundary

``` text
                 Shared Domain Model
                        ↓
                 ┌────────────┐
                 │ GameEngine │
                 └────────────┘
                    ↑      ↓
           proposed Move   Engine result
                    ↑      ↓
                Orchestrator
               /     |      \
           Human     AI     Future Network
```

The engine may depend on `/domain`.

`/domain` must never depend on `/engine`.

The engine must not import from UI, AI, persistence, simulation, React,
DOM APIs, or browser storage.

------------------------------------------------------------------------

# 5. State Ownership

The engine owns complete authoritative game state.

External consumers must not directly mutate it.

Engine-owned state includes concepts such as:

``` text
EngineState / SessionState
RoundState
TrickState
InternalPlayerState
finish/pass/turn tracking
mode-specific scoring state
```

These are **not shared domain models**. They exist because the engine
needs them to enforce rules and perform transitions.

The exact internal representation may evolve without forcing other
modules to understand it.

Conceptually:

``` ts
const result = engine.submitMove(state, move);
```

A successful operation returns the resulting authoritative state and
factual events. A rejected Move leaves authoritative state unchanged.

The implementation may use immutable updates or controlled internal
mutation, but externally exposed state must behave as
engine-owned/read-only data.

------------------------------------------------------------------------

# 6. Engine-Specific Terminology

Canonical gameplay terms use `requirements.md`.

Shared data terms use `domain-model.md`.

This document adds only engine-specific concepts:

  -----------------------------------------------------------------------
  Term                                Meaning
  ----------------------------------- -----------------------------------
  **Authoritative State**             Complete runtime game truth
                                      controlled by the engine.

  **State Transition**                Legal engine-controlled change from
                                      one authoritative state to another.

  **Engine Result**                   Structured result of an engine
                                      operation.

  **Player View**                     Information-safe engine projection
                                      for one player/controller.

  **Public View**                     Projection containing only
                                      information public to all players.

  **Engine Event**                    Structured factual event emitted by
                                      an accepted engine operation.

  **Invariant**                       Condition that must hold for valid
                                      authoritative state.

  **Combination Strength**            Engine-internal normalized data
                                      used to compare valid combinations.
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 7. Engine Public Surface

The engine should expose a deliberately small API.

Conceptually:

``` ts
interface GameEngine {
  createSession(config: EngineSessionConfig): EngineResult;

  startRound(
    state: SessionState,
    rng: RNG
  ): EngineResult;

  submitMove(
    state: SessionState,
    move: Move
  ): MoveResult;

  getLegalMoves(
    state: SessionState,
    playerId: PlayerId
  ): readonly Move[];

  inspectCombination(
    cards: readonly Card[]
  ): CombinationInspectionResult;

  getPlayerView(
    state: SessionState,
    playerId: PlayerId
  ): PlayerView;

  getPublicView(
    state: SessionState
  ): PublicGameView;
}
```

The shared types referenced here come from `domain-model.md`.

The remaining types are engine-owned contracts.

These signatures are design guidance rather than frozen APIs.

------------------------------------------------------------------------

# 8. Engine Result Contracts

Normal engine operations return structured results.

Conceptually:

``` ts
interface EngineResult {
  readonly state: SessionState;
  readonly events: readonly GameEvent[];
}
```

Move submission distinguishes accepted and rejected player intent:

``` ts
type MoveResult =
  | {
      readonly accepted: true;
      readonly state: SessionState;
      readonly events: readonly GameEvent[];
    }
  | {
      readonly accepted: false;
      readonly state: SessionState;
      readonly error: MoveValidationError;
      readonly events: readonly GameEvent[];
    };
```

Ordinary illegal Moves should not use exceptions.

Exceptions are reserved for programming/configuration failures or
corrupted impossible state.

------------------------------------------------------------------------

# 9. Authoritative State Model

The engine may internally organize state approximately as:

``` text
SessionState
├── mode / ruleset reference
├── session status
├── current Round
├── completed Round results
├── cumulative scores
└── tiebreak-relevant results

RoundState
├── round number / status
├── InternalPlayerState[]
├── TrickState
├── current player
├── active players
├── finish information
├── publicly played cards
└── mode-specific Round data

InternalPlayerState
├── PlayerId
├── authoritative hand
└── engine-owned Round status
```

These structures should contain game truth only.

They must not contain UI-only data such as selected cards, card
coordinates, animations, avatars, or manual hand ordering.

They must not contain AI strategy state.

------------------------------------------------------------------------

# 10. Card and Deck Rules

`Card`, `Rank`, and `Suit` are defined in `domain-model.md`.

The engine owns the behavior applied to them:

-   standard 52-card deck construction;
-   uniqueness validation;
-   configured rank ordering;
-   configured suit ordering;
-   deterministic shuffling;
-   dealing exactly 13 cards to each of four players.

The engine must not attach presentation data to Cards.

------------------------------------------------------------------------

# 11. Combination Detection

`Combination` and `CombinationType` are shared domain types.

The engine owns authoritative detection:

``` ts
detectCombination(
  cards: readonly Card[],
  ruleset: RulesetConfig
): CombinationDetectionResult;
```

Detection must implement the combination definitions and Straight edge
cases confirmed in `requirements.md`.

A five-card set may satisfy multiple combination properties during inspection:

- **Straight** property: the ranks form a valid house-rule sequence, regardless of suits;
- **Flush** property: all five cards have the same suit;
- **Straight Flush** property: both Straight and Flush properties are satisfied.

The engine must preserve those underlying property checks while returning one final canonical `CombinationType`. If multiple five-card definitions apply, select the **highest-ranking applicable category** using the canonical hierarchy:

`Straight < Flush < Full House < Four-of-a-Kind < Straight Flush`

Therefore a same-suit valid house-rule sequence must pass Straight inspection and Flush inspection, while its final canonical classification is Straight Flush. Do not make lower-level property detectors reject a hand merely because a stronger overlapping category also applies.

Detection answers:

> Do these cards form a valid canonical Combination, and if so which
> one?

It does not answer whether that Combination may currently be played.

------------------------------------------------------------------------

# 12. Combination Strength and Comparison

`CombinationStrength` remains engine-owned.

Other modules should not need the engine's internal numeric or
normalized comparison representation.

The engine owns:

``` ts
compareCombinations(
  candidate: Combination,
  current: Combination,
  ruleset: RulesetConfig
): ComparisonResult;
```

and/or:

``` ts
canBeat(
  candidate: Combination,
  current: Combination,
  ruleset: RulesetConfig
): boolean;
```

Comparison must implement the canonical rules in `requirements.md`,
including:

-   same-size response requirements for Singles, Pairs, and Triples;
-   five-card hierarchy;
-   cross-type five-card responses;
-   Straight special ordering;
-   Flush comparison;
-   Full House comparison;
-   Four-of-a-Kind comparison;
-   Straight Flush comparison.

No AI preference belongs in this calculation.

------------------------------------------------------------------------

# 13. Legal Move Generation

The engine is the authoritative source of legal Moves.

``` ts
getLegalMoves(
  state: SessionState,
  playerId: PlayerId
): readonly Move[];
```

Legal move generation must account for:

-   card ownership;
-   active/finished status;
-   current Turn;
-   Opening Move requirement;
-   free lead vs response;
-   current Combination;
-   legal Singles, Pairs, Triples, and five-card Combinations;
-   cross-type five-card responses;
-   Pass legality.

It must use the same detection/comparison rules used by Move validation.

It must not:

-   choose the strategically best Move;
-   rank Moves according to personality;
-   weaken legality based on bot difficulty.

Those decisions belong to `ai.md`.

------------------------------------------------------------------------

# 14. Move Validation

`Move` is a shared domain type representing player intent.

The engine validates that intent authoritatively.

A Play validation flow should be equivalent to:

``` text
Receive Move
   ↓
Validate Session and Round accept Moves
   ↓
Validate player exists and remains active
   ↓
Validate correct Turn
   ↓
Validate submitted Cards are owned and unique
   ↓
Detect Combination
   ↓
Validate Opening Move rule if applicable
   ↓
Validate response against current Combination
   ↓
Accept
```

A Pass validates:

-   active Session/Round;
-   correct active player;
-   Pass is allowed in the current Trick state.

A player cannot Pass when making the Opening Move or when holding a free
lead.

------------------------------------------------------------------------

# 15. Validation Errors

Illegal gameplay should return machine-readable engine errors.

Initial error set:

``` ts
type MoveErrorCode =
  | 'SESSION_NOT_ACTIVE'
  | 'ROUND_NOT_ACTIVE'
  | 'PLAYER_NOT_FOUND'
  | 'PLAYER_NOT_ACTIVE'
  | 'NOT_YOUR_TURN'
  | 'CARD_NOT_OWNED'
  | 'DUPLICATE_CARD'
  | 'INVALID_COMBINATION'
  | 'OPENING_REQUIRES_THREE_OF_CLUBS'
  | 'PLAY_DOES_NOT_BEAT_CURRENT'
  | 'PASS_NOT_ALLOWED';
```

Conceptually:

``` ts
interface MoveValidationError {
  readonly code: MoveErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;
}
```

Human-readable wording belongs to UI/presentation, not the engine.

------------------------------------------------------------------------

# 16. Atomic State Transitions

An accepted Play should atomically perform all applicable rule
consequences:

1.  remove played Cards from the player's authoritative hand;
2.  record the accepted Combination;
3.  update Trick state;
4.  update public played-card information;
5.  update/reset pass tracking;
6.  determine whether the player finished;
7.  apply mode-specific finish behavior;
8.  determine resulting active Turn/lead state;
9.  determine whether the Trick ended;
10. determine whether the Round ended;
11. calculate Round results when required;
12. update Session totals;
13. determine whether the Session ended;
14. calculate final Session result when required;
15. emit factual events.

A rejected Move must not partially apply any of these effects.

------------------------------------------------------------------------

# 17. Turn and Trick Resolution

The engine owns rule-based Turn and Trick progression.

It determines:

-   next active player clockwise;
-   eligible active players;
-   pass tracking;
-   when all other eligible active players have passed;
-   when a Trick ends;
-   who receives the resulting free lead;
-   how finished players are skipped.

The Orchestrator reads the resulting state and asks the appropriate
controller to act.

The Orchestrator must not independently reimplement these rules.

------------------------------------------------------------------------

# 18. Finished-Player Handling

## 18.1 Basic Mode

When a player goes out, the engine must follow the confirmed
continuation behavior in `requirements.md`:

-   record their finish;
-   remove them from active rotation;
-   keep their final Combination as the current Combination;
-   continue clockwise through remaining active players;
-   allow a legal response if one exists;
-   if nobody can beat the final Combination, give the next active
    player a free lead;
-   continue until one active player remains.

## 18.2 Competitive Mode — Deferred Approved Design

The Round ends immediately when the first player goes out.

No further gameplay Move is accepted for that Round.

------------------------------------------------------------------------

# 19. Round Lifecycle

The engine should represent Round lifecycle explicitly, for example:

``` text
NotStarted
    ↓
Setup
    ↓
Dealt
    ↓
InProgress
    ↓
Completed
```

The engine owns authoritative operations for:

-   deck creation;
-   shuffle;
-   deal;
-   future authoritative setup modifiers;
-   determining the holder of 3♣;
-   enforcing the Opening Move;
-   normal gameplay state;
-   Round completion;
-   Round result creation.

The Orchestrator owns when these operations are invoked and when
controller input is requested.

------------------------------------------------------------------------

# 20. Session Lifecycle

The Session structure and five-Round requirement are defined in
`requirements.md`.

The engine owns the authoritative representation and calculation of:

-   current Round number;
-   completed Round results;
-   cumulative scores;
-   Session completion;
-   final winner;
-   tiebreak resolution;
-   genuine tie.

The Orchestrator drives execution between engine states but does not
calculate outcomes independently.

------------------------------------------------------------------------

# 21. Game Mode Implementation

`GameMode` is defined in `domain-model.md`.

The engine implements the behavior associated with each mode.

Basic and Competitive share the same core card/combination/Trick rules
but differ in Round completion, finish handling, result shape, and
scoring.

Avoid separate duplicated engines.

A possible internal abstraction is:

``` ts
interface GameModeRules {
  isRoundComplete(state: RoundState): boolean;

  resolvePlayerFinish(
    state: RoundState,
    playerId: PlayerId
  ): RoundState;

  calculateRoundResult(
    state: RoundState
  ): RoundResult;
}
```

This is an engine-internal design option, not a shared domain interface.

------------------------------------------------------------------------

# 22. Basic Mode Scoring

The engine must implement the Basic Mode scoring rules exactly as
specified in `requirements.md`.

It owns:

-   authoritative finish order;
-   final placement assignment;
-   Round score calculation;
-   Round result data used by Session totals and tiebreaks.

The engine should expose results rather than require UI, persistence, or
orchestration code to recalculate them.

------------------------------------------------------------------------

# 23. Competitive Mode Scoring — Deferred Approved Design

The engine must implement the Competitive Mode scoring rules exactly as
specified in `requirements.md`.

It owns:

-   loser remaining-card counts;
-   base penalty;
-   Unused Bomb qualification;
-   Winner Final Play qualification;
-   boolean multiplier stacking;
-   loser final scores;
-   winner positive score;
-   authoritative scoring breakdown.

The canonical meaning of Bomb-related terms remains in
`requirements.md`.

The UI must not recalculate Competitive scoring.

## 23.1 Scoring breakdown contract

The engine should expose enough factual data to explain the score.

Conceptually:

``` ts
interface CompetitivePlayerScoreBreakdown {
  readonly playerId: PlayerId;
  readonly remainingCardCount: number;
  readonly basePenalty: number;

  readonly unusedBomb: {
    readonly triggered: boolean;
    readonly qualifyingCards: readonly Card[];
    readonly multiplier: 1 | 2;
  };

  readonly winnerFinalPlayMultiplier: 1 | 2;
  readonly totalMultiplier: 1 | 2 | 4;
  readonly finalScore: number;
}
```

The UI decides how this information is presented.

------------------------------------------------------------------------

# 24. Session Winner and Tiebreaks

The engine applies the mode-specific Session winner/tiebreak rules from `requirements.md` v1.7.

First compare final Session totals. If still tied:

### Basic Mode

1. most Round wins;
2. best/lower average official placement across all five Rounds;
3. highest single best-Round score;
4. genuine tie.

### Competitive Mode

1. most Round wins;
2. highest single best-Round score;
3. genuine tie.

Competitive Mode must **not** manufacture 2nd/3rd/4th placements from remaining-card counts for tiebreaking. Remaining-card counts may remain factual result data only.

The engine should expose structured outcome/tiebreak facts so consumers can explain which rule resolved a tie without reimplementing the calculation.

------------------------------------------------------------------------

# 25. Ruleset Configuration

The engine owns `RulesetConfig` because it directly controls
authoritative rule algorithms.

Conceptually:

``` ts
interface RulesetConfig {
  readonly rankOrder: readonly Rank[];
  readonly suitOrder: readonly Suit[];
  readonly fiveCardOrder: readonly CombinationType[];
  readonly straightRules: StraightRules;
}
```

The values referenced by this configuration use shared domain types, but
the configuration itself belongs to the engine.

Do not turn every constant into configuration. Only meaningful rule
variation should be configurable.

The v1 default must match `requirements.md`.

------------------------------------------------------------------------

# 26. Future Setup Modifiers

Future authoritative Round setup modifiers may be supported through an
engine extension point.

Examples already identified in requirements include Reveal One and Card
Exchange.

A possible engine-owned interface is:

``` ts
interface RoundSetupModifier {
  readonly id: string;

  apply(
    state: RoundState,
    rng: RNG
  ): RoundState;
}
```

This is an extension point, not a v1 implementation requirement.

Exact Card Exchange behavior remains undefined until confirmed in
`requirements.md`.

------------------------------------------------------------------------

# 27. Deterministic Randomness

Authoritative engine randomness must be injectable.

``` ts
interface RNG {
  next(): number;
}
```

The engine must not rely directly on uncontrolled `Math.random()` for
authoritative random behavior.

This includes at least:

-   deck shuffling;
-   future random setup modifiers.

Given equivalent configuration, RNG behavior, and submitted Move
sequence, engine outcomes should be reproducible.

AI randomness remains owned by the AI subsystem.

------------------------------------------------------------------------

# 28. Engine Events

The engine produces structured factual events from accepted transitions.

Possible event categories include:

``` text
SESSION_STARTED
ROUND_STARTED
CARDS_DEALT
TURN_CHANGED
CARDS_PLAYED
PLAYER_PASSED
TRICK_ENDED
PLAYER_FINISHED
ROUND_ENDED
SCORE_CALCULATED
SESSION_ENDED
```

The engine owns the **event contract and factual event production**
because events describe authoritative transitions.

`events-logging.md` owns:

-   storage;
-   retention;
-   filtering;
-   formatting;
-   debug output;
-   UI history presentation;
-   consumer behavior.

Events should contain structured domain/engine data rather than
presentation strings.

Event contracts must also respect information visibility. A public
consumer must not gain hidden hands merely because the engine internally
knows them.

------------------------------------------------------------------------

# 29. Player and Public Views

Authoritative engine state contains private information and must not be
handed directly to controllers or UI.

The engine should expose projections:

``` text
Authoritative State
       │
       ├── PublicGameView
       │
       ├── PlayerView(P1)
       ├── PlayerView(P2)
       ├── PlayerView(P3)
       └── PlayerView(P4)
```

A Player View may contain:

-   that player's own hand;
-   current Trick;
-   current Turn;
-   publicly played Cards;
-   opponent card counts;
-   scores;
-   Round/Session progress;
-   information explicitly revealed by future modifiers.

It must not contain unrevealed opponent hands.

`PlayerView` and `PublicGameView` are **public Engine contracts**, not
shared domain models.

The detailed consumer behavior belongs to AI, UI, Orchestrator, and
future networking documents.

------------------------------------------------------------------------

# 30. Orchestrator Boundary

The Game Engine does not call Player Controllers.

Conceptually:

``` text
Controller
    ↓ Move
Orchestrator
    ↓ submitMove(...)
GameEngine
    ↓ result + events
Orchestrator
```

The engine determines the resulting Turn as game truth.

The Orchestrator determines when to ask the corresponding controller for
its next Move.

Controller interfaces, asynchronous waiting, retries, pause/resume
behavior, and runner lifecycle belong to `orchestrator.md`.

------------------------------------------------------------------------

# 31. AI Boundary

The engine provides legal game truth.

The AI decides preference.

The engine must not know:

-   bot personality;
-   bot difficulty;
-   evaluation heuristics;
-   candidate scoring;
-   deliberate suboptimal behavior.

AI receives only permitted information through public engine contracts
and produces a shared `Move`.

Detailed behavior belongs to `ai.md`.

------------------------------------------------------------------------

# 32. UI Boundary

The UI may consume shared domain types and public engine/orchestrator
contracts.

It may:

-   render Cards and Combination information;
-   display Player/Public Views;
-   display legal/invalid selection feedback;
-   submit human intent;
-   display engine scoring breakdowns and formatted events.

It must not:

-   mutate authoritative hands;
-   advance Turns;
-   decide authoritative legality;
-   calculate authoritative scoring;
-   inspect private engine state.

Manual hand ordering remains UI state and must not be confused with the
authoritative set of Cards held by the player.

Detailed behavior belongs to `ui-ux.md`.

------------------------------------------------------------------------

# 33. Persistence Boundary

The engine must not access `localStorage` or another persistence
implementation.

Persistence may store a defined snapshot of resumable authoritative
state, but snapshot schema, versioning, migrations, storage keys,
statistics, and load/save behavior belong to `persistence.md`.

A persistence format should not automatically become the engine's
internal state representation.

The boundary for safe serialization/restoration should be designed in
`persistence.md` with an explicit engine contract where needed.

------------------------------------------------------------------------

# 34. Events/Logging Boundary

The engine emits facts.

The logging subsystem retains and presents those facts.

The engine must not call `console.log()` as its gameplay event mechanism
and must not format player-facing sentences.

For example, the engine may emit structured `CARDS_PLAYED` data. A
logger or UI may later render that as a human-readable history entry.

Detailed logging architecture belongs to `events-logging.md`.

------------------------------------------------------------------------

# 35. Simulation Boundary

Simulation is a consumer/wiring of the engine rather than an engine
mode.

A headless simulation may combine:

``` text
GameEngine
+ GameOrchestrator
+ 4 AIControllers
+ Event/metrics consumers
```

The engine must not intentionally sleep or introduce presentation
delays.

Mass-run configuration, metrics, balancing, and regression simulation
belong to `testing-simulation.md`.

------------------------------------------------------------------------

# 36. Invariants

The engine must preserve important invariants.

## 36.1 Cards

-   A standard Round uses 52 unique Cards.
-   No physical Card exists in two authoritative locations
    simultaneously.
-   A player cannot legally play a Card they do not hold.
-   An accepted Play removes exactly the submitted Cards from that
    player's hand.

## 36.2 Players

-   Exactly four players participate in a v1 Session.
-   A finished player has zero Cards.
-   A finished player is excluded from normal future Turn rotation.
-   Finish records contain no duplicate PlayerIds.

## 36.3 Turn and Trick

-   During normal input state, exactly one active player owns the Turn.
-   The Opening Move contains 3♣.
-   Every accepted response legally beats the current Combination.
-   A free lead has no previous Combination requirement.
-   Pass tracking does not incorrectly carry into a new Trick.

## 36.4 Round

-   Each normal Round deal gives 13 Cards to each player.
-   Basic Mode produces the required complete placement result.
-   Competitive Mode ends immediately when the first player goes out.
-   A completed Round accepts no further gameplay Moves.

## 36.5 Session

-   A normal v1 Session completes after exactly five Rounds.
-   Session totals equal authoritative Round results.
-   A completed Session accepts no further gameplay Moves.

## 36.6 Scoring

-   Basic scoring follows the confirmed placement table.
-   Competitive multipliers follow the confirmed boolean rules.
-   Multiple Unused Bomb conditions do not repeatedly stack.
-   Multiple Winner Final Play qualifying properties do not repeatedly
    stack.
-   Competitive winner score equals the positive sum of loser penalties.

Internal invariant failure should be distinguished from ordinary invalid
player intent.

------------------------------------------------------------------------

# 37. Engine Testing Requirements

Project-wide testing strategy belongs to `testing-simulation.md`, but
engine design must support direct unit tests for:

-   deck construction and uniqueness;
-   deterministic shuffle;
-   rank/suit ordering;
-   every Combination type;
-   invalid combinations;
-   all Straight edge cases;
-   same-type comparison;
-   five-card hierarchy;
-   cross-type five-card comparison;
-   `canBeat`;
-   Opening Move validation;
-   Pass validation;
-   legal Move generation;
-   ownership validation;
-   rejection without state mutation;
-   Turn/Trick progression;
-   Trick reset;
-   finished-player rotation;
-   Basic Mode continuation and scoring;
-   Competitive termination and scoring;
-   Unused Bomb detection;
-   Winner Final Play multiplier;
-   multiplier stacking;
-   Session totals;
-   Session winner/tiebreaks;
-   Player/Public information safety;
-   event correctness;
-   invariant preservation.

------------------------------------------------------------------------

# 38. Performance Expectations

Engine operations must contain no intentional presentation delay.

No engine rule should use animation timing, AI thinking delay, or
`setTimeout` for pacing.

Legal Move generation should be practical for interactive play and
repeated headless simulation.

Correctness and maintainability take priority over premature
optimization.

------------------------------------------------------------------------

# 39. Proposed Engine Package Structure

With shared models moved to `/domain`, the engine package becomes:

``` text
src/
  domain/
    ...

  engine/
    index.ts
    GameEngine.ts

    state/
      SessionState.ts
      RoundState.ts
      TrickState.ts
      InternalPlayerState.ts

    cards/
      deck.ts
      cardComparison.ts

    combinations/
      detectCombination.ts
      compareCombinations.ts
      CombinationStrength.ts
      straightRules.ts

    moves/
      legalMoves.ts
      validateMove.ts

    turn/
      turnResolver.ts
      trickResolver.ts

    round/
      roundSetup.ts
      roundResolver.ts

    session/
      sessionResolver.ts
      sessionWinner.ts

    modes/
      basicMode.ts
      competitiveMode.ts

    scoring/
      basicScoring.ts
      competitiveScoring.ts

    config/
      RulesetConfig.ts
      defaultRuleset.ts

    events/
      GameEvent.ts

    views/
      PlayerView.ts
      PublicGameView.ts
      viewFactory.ts

    rng/
      RNG.ts
      seededRng.ts

    results/
      EngineResult.ts
      MoveResult.ts
      errors.ts

    validation/
      invariants.ts
```

This is a starting organization, not a requirement to create every file
immediately.

------------------------------------------------------------------------

# 40. Engine Public Package Surface

`/engine/index.ts` should expose only intentional contracts.

Likely public exports include:

-   `GameEngine`;
-   engine result types;
-   Move validation errors;
-   `GameEvent` contracts;
-   `PlayerView`;
-   `PublicGameView`;
-   engine configuration required by callers;
-   RNG interface when injection is required.

Shared types such as `Card`, `Combination`, and `Move` should be
imported from `/domain`, not re-exported as if the engine owns them
unless a convenience barrel is deliberately chosen later.

Internal state and helpers should remain unexported whenever external
consumers do not require them.

------------------------------------------------------------------------

# 40.1 Algorithm Adaptation, Correctness, and Optimization Priority

The Engine may borrow implementation techniques from poker/Big-Two/card-game evaluators, but **this Engine's confirmed house rules are authoritative**. External algorithms are references for representation or search efficiency only and must be adapted before use.

Combination detection/comparison and legal-Move generation must be validated against the configured `RulesetConfig`, including the project's special Straight ordering, Suit ordering, five-card hierarchy, same-type comparison behavior, and permitted use of 2s. A generic poker evaluator or Big-Two library must never be treated as a source of rule truth.

For the POC, prefer:

1. **accuracy and reliability**;
2. **speed after profiling**;
3. **memory reduction after correctness/performance needs are understood**.

Recommended internal techniques include:

- small Rank/Suit frequency tables or masks for combination classification;
- direct structure-aware generation for Singles/Pairs/Triples/five-card candidates where it improves clarity or measured performance;
- memoization/caching where deterministic results repeat;
- compact internal card masks where useful.

These are private implementation details. The Engine's public contracts remain domain-oriented and must not expose a particular bitmask/cache representation. POC caches may be comparatively generous; later profiling may introduce cache limits, precomputation changes, or more specialized generators without changing public contracts.

------------------------------------------------------------------------

# 41. Phase 1 Recommended Implementation Order

Phase 1 Engine implementation follows `m1-task-breakdown.md` and implements **Basic Mode only**:

1. shared M1 domain types;
2. RulesetConfig and primitive comparison;
3. combination inspection and comparison;
4. deck, injected deterministic shuffle, and deal;
5. complete legal Move generation;
6. validation and atomic transitions;
7. Turn/Trick/Pass/free-lead flow;
8. Basic finished-player continuation;
9. Basic Round placement/scoring;
10. five-Round Basic Session/tiebreak;
11. factual events;
12. information-safe views;
13. invariants and full M1 regression.

Competitive ending/scoring remains documented but is not implemented during M1. Tests accompany each stage.

------------------------------------------------------------------------

# 42. Open Engine Implementation Decisions

The following remain implementation decisions rather than product
requirements:

-   class facade vs primarily pure-function implementation;
-   immutable-state library vs plain controlled updates;
-   exact internal shape of `CombinationStrength`;
-   exact Trick/pass tracking representation;
-   exact event type hierarchy;
-   exact Round/Session state unions;
-   invariant-checking strategy in production;
-   seeded RNG implementation;
-   legal-Move enumeration optimizations;
-   exact internal file granularity.

These decisions should favor correctness, testability, readability, and clear ownership. For the POC, correctness/reliability outranks speed, and speed outranks memory optimization. Legal-Move enumeration optimization should be driven by profiling rather than by changing rule semantics.

------------------------------------------------------------------------

# 43. Cross-Document Responsibility Matrix

  -----------------------------------------------------------------------
  Document                            Owns
  ----------------------------------- -----------------------------------
  `requirements.md`                   Product truth, canonical game
                                      rules/terminology, scope, confirmed
                                      UX requirements, high-level
                                      architecture

  `domain-model.md`                   Shared implementation-independent
                                      game data concepts

  `engine.md`                         Authoritative runtime state, rules,
                                      legality, transitions, scoring,
                                      views, engine events

  `orchestrator.md`                   Game loop, PlayerController
                                      contract/lifecycle, async
                                      coordination, invoking the engine

  `ai.md`                             Bot strategy, personalities,
                                      difficulty, evaluation, permitted
                                      use of information

  `ui-ux.md`                          Presentation, interaction,
                                      selection/manual ordering,
                                      feedback, pacing, accessibility

  `persistence.md`                    Save/load, localStorage, statistics
                                      persistence, snapshot
                                      schema/versioning/migrations

  `events-logging.md`                 Event retention, formatting,
                                      history, debug logging, event
                                      consumers

  `testing-simulation.md`             Test organization,
                                      integration/headless execution,
                                      mass simulations, balancing

  `networking.md` *(future)*          Remote transport, synchronization,
                                      server authority, multiplayer
                                      protocol
  -----------------------------------------------------------------------

A type should live with its owner unless it is genuinely part of the
shared domain model or an intentional public subsystem contract.

------------------------------------------------------------------------

# 44. Definition of Engine Independence

The engine is sufficiently independent when:

-   it can run in TypeScript tests without React or DOM APIs;
-   it imports shared game concepts from `/domain`;
-   it does not own duplicate definitions of those shared concepts;
-   it owns authoritative state without exposing private mutable
    internals;
-   all submitted Moves are authoritatively validated;
-   legal Move generation and validation use the same rule
    implementation;
-   scoring comes only from the engine;
-   UI and AI do not reimplement game rules;
-   controllers are never called by the engine;
-   persistence is not called by the engine;
-   events are produced as structured facts rather than formatted logs;
-   deterministic inputs allow reproducible behavior;
-   Engine + Orchestrator + four AI Controllers can complete a
    five-Round Session headlessly;
-   replacing UI or adding a future Network Controller does not require
    rewriting core game rules.

------------------------------------------------------------------------

# 45. Architectural Summary

The **Shared Domain Model** owns:

> The common language used to describe Pusoy Dos data.

The **Game Engine** owns:

> What is true, what is legal, and what authoritative state results.

The **Game Orchestrator** owns:

> When game components act and how controllers are coordinated with the
> engine.

**Player Controllers** own:

> What action a participant intends to submit.

The **AI System** owns:

> Which legal action a bot prefers.

The **UI** owns:

> How permitted information is presented and human intent is collected.

**Persistence** owns:

> What data survives beyond the current runtime and how it is stored.

The **Event & Logging System** owns:

> How authoritative events are retained, formatted, inspected, and
> displayed.

Keeping shared domain concepts separate from engine-owned state prevents
both duplication and accidental leakage of engine internals.

# Pusoy Dos --- Game Orchestrator Design

## Game Orchestrator / Runner Document (v1.3)

**Status:** Draft for implementation  
**Last Modified:** September 5, 2026
**Parent document:** `requirements.md` v1.9  
**Shared model:** `domain-model.md` v1.2  
**Engine design:** `engine.md` v1.3  
**Module:** Game Orchestrator  
**Language:** TypeScript

---

# 1. Purpose

The Game Orchestrator coordinates the execution of a Pusoy Dos Session around the authoritative Game Engine.

It answers:

> Given the current authoritative engine state, who needs to act next, how is that action obtained, when should engine operations be invoked, and when should execution wait for an external continuation?

The Orchestrator is **not a second rules engine**. It does not decide whether a Move is legal, determine which player should own the next Turn, calculate scores, evaluate combinations, or infer Round/Session results.

Its job is to connect:

- the Game Engine;
- Human, AI, and future Network Player Controllers;
- the UI/application layer;
- event consumers;
- persistence integration points; and
- headless testing/simulation.

`requirements.md` remains the product source of truth.

`domain-model.md` owns shared implementation-independent data concepts such as `PlayerId` and `Move`.

`engine.md` owns authoritative rules, state transitions, safe player/public views, legal moves, validation, scores, and factual Game Events.

This document owns only orchestration behavior and orchestrator-specific public contracts.

---

# 2. Core Architectural Principle

The central execution relationship is:

```text
PlayerController
      │
      │ proposed Move
      ▼
Game Orchestrator / GameRunner
      │
      │ submit Move
      ▼
Game Engine
      │
      │ authoritative state + events / validation error
      ▼
Game Orchestrator / GameRunner
      │
      ├── route public results/events
      ├── wait when product flow requires it
      └── request the next controller action when appropriate
```

The responsibilities can be summarized as:

```text
Controller   → "This is the Move I want to make."
Orchestrator → "I will submit that intent to the authoritative engine."
Engine       → "This is whether it is legal and what actually happened."
Orchestrator → "I will now coordinate the next required action or wait state."
```

The Orchestrator must never replace an engine decision with its own duplicate implementation.

---

# 3. Orchestrator Responsibilities

The Game Orchestrator owns:

- constructing and managing a running game execution around an engine Session;
- associating each `PlayerId` with exactly one Player Controller for that execution;
- invoking engine lifecycle operations at the appropriate time;
- reading the engine-determined current player when a Turn is required;
- requesting an information-safe `PlayerView` for the acting player;
- obtaining legal Moves from the engine when required by controllers or UX behavior;
- asking the corresponding Player Controller for a proposed `Move`;
- asynchronously waiting for Human, AI, or future Network input;
- submitting the proposed `Move` to the Game Engine;
- handling accepted and rejected engine results without duplicating validation rules;
- routing engine-produced events to registered consumers;
- exposing runner lifecycle state to the application/UI;
- stopping normal Turn execution when a Round reaches its result checkpoint;
- waiting for explicit continuation before starting the next Round in normal human gameplay;
- coordinating Session completion;
- supporting pause, resume, cancellation, and stale-input protection at the execution layer;
- supporting headless execution with four AI Controllers;
- exposing integration points for persistence and simulation without implementing either subsystem.

---

# 4. Non-Responsibilities

The Game Orchestrator does **not** own:

- card rank or suit rules;
- deck construction or shuffling;
- dealing;
- combination detection or comparison;
- legal Move rules;
- determining whether a submitted Move is valid;
- deciding which player becomes the next authoritative Turn owner;
- Trick completion rules;
- finished-player handling;
- Basic or Competitive scoring calculations;
- Session winner/tiebreak calculations;
- authoritative Round or Session state;
- AI move-selection strategy, personality, difficulty, or heuristic evaluation;
- React components, page navigation, animations, card selection, or manual hand ordering;
- user-facing presentation timing;
- `localStorage` or another persistence implementation;
- serialization schema or migration logic;
- formatted log history or event retention;
- network transport;
- simulation metrics or balancing analysis.

When the Orchestrator needs any authoritative gameplay answer, it asks or submits to the Game Engine rather than recalculating that answer itself.

---

# 5. Dependency Rules

The intended dependency direction is:

```text
/domain
   ↑
/engine
   ↑
/orchestrator
   ↑          ↑
/ui         /simulation
   ↑          ↑
Human      AI Controllers
```

More precisely:

- `/orchestrator` may depend on `/domain`.
- `/orchestrator` may depend on public `/engine` contracts.
- `/engine` must not depend on `/orchestrator`.
- `/domain` must not depend on `/orchestrator`.
- `/orchestrator` must not import React components.
- `/orchestrator` must not directly access `localStorage`.
- `/orchestrator` must not contain AI decision algorithms.
- UI, AI adapters, simulation, and future networking may depend on Orchestrator public contracts.

The Orchestrator may coordinate services from other subsystems through narrow interfaces, but it should not absorb those subsystem implementations.

---

# 6. Orchestrator-Specific Terminology

Canonical gameplay terminology comes from `requirements.md`.

This document adds the following orchestration-specific terms:

| Term | Meaning |
|---|---|
| **Game Orchestrator** | Architectural subsystem responsible for coordinating controllers with engine execution. |
| **GameRunner** | Primary concrete runtime coordinator that drives one Session execution. |
| **Player Controller** | Source of player intent for one `PlayerId`, such as Human, AI, or future Network control. |
| **Turn Request** | Orchestrator request asking one controller to choose a Move from information it is permitted to see. |
| **Round Result Checkpoint** | Waiting state after the engine completes a Round and before the next Round is explicitly started. |
| **Continuation** | External instruction to leave the Round Result checkpoint and start the next Round. |
| **Runner State** | Orchestrator-owned execution/lifecycle state. It is not authoritative game state. |
| **Stale Input** | A controller result that belongs to an older Turn request or obsolete runner state and must not be submitted. |
| **Headless Execution** | Running the engine and orchestrator without a UI, typically with AI Controllers. |

---

# 7. GameRunner

`GameRunner` is the primary concrete runtime coordinator for a single Session execution.

It should remain small enough that the execution loop can be understood and tested independently from UI code.

Conceptually:

```ts
interface GameRunner {
  start(config: RunnerSessionConfig): Promise<void>;

  continueToNextRound(): Promise<void>;

  pause(): void;

  resume(): Promise<void>;

  cancel(): void;

  getStatus(): RunnerStatus;
}
```

The exact API is not frozen. The important architectural requirements are:

1. the runner invokes the engine rather than implementing rules itself;
2. controller requests are asynchronous;
3. only one authoritative Turn request is active at a time;
4. Round completion creates a deliberate checkpoint;
5. cancellation/pause can prevent stale controller responses from advancing the game;
6. the same runner can execute with or without React.

---

# 8. Player Controller Contract

A Player Controller represents **where a player's Move comes from**.

The common contract should support Human, AI, and future Network control without changing the Game Engine.

A recommended conceptual contract is:

```ts
interface PlayerController {
  readonly playerId: PlayerId;

  chooseMove(
    request: PlayerTurnRequest
  ): Promise<Move>;
}
```

Where:

```ts
interface PlayerTurnRequest {
  readonly playerId: PlayerId;
  readonly view: PlayerView;
  readonly legalMoves: readonly Move[];
  readonly requestId: string;
}
```

`PlayerView` is an Engine-owned public contract.

`Move` and `PlayerId` are shared domain contracts.

The `legalMoves` list is produced by the engine. A controller may use it to select among legal options, but it does not become authoritative merely because the controller received it.

`requestId` is orchestrator-owned metadata used to reject stale asynchronous responses. It is not part of the shared Pusoy Dos domain model.

The exact identifier type may change during implementation.

---

# 9. Controller Types

## 9.1 HumanController

The Human Controller adapts UI input into the common `PlayerController` contract.

Its responsibilities include:

- receiving a safe Turn request;
- exposing the current request to the UI integration layer;
- waiting asynchronously for the human to choose Play or Pass;
- resolving the controller request with a shared `Move`;
- ignoring or rejecting input that no longer belongs to the active request.

The Human Controller does not:

- determine authoritative legality;
- mutate the engine state;
- decide scores or Turn ownership;
- render the UI itself.

The UI may provide selection feedback before submission using engine-supported information, but the final submitted Move is still validated by the engine.

## 9.2 AIController

The AI Controller adapts the AI System to the common Player Controller interface.

Its responsibilities include:

- receiving only the permitted `PlayerView` and engine-produced legal Move set;
- invoking the configured AI strategy/personality/difficulty implementation;
- returning the chosen shared `Move`;
- respecting cancellation/staleness from the runner integration.

AI evaluation behavior belongs in `ai.md`, not here.

The AI Controller must never obtain unrevealed opponent hands from authoritative engine state.

## 9.3 NetworkController — Possible Future Direction

A future Network Controller may:

- serialize the permitted Turn request for a remote player;
- wait for a remote Move;
- translate the received action into the shared `Move` contract;
- return it to the runner.

Transport, connection management, authentication, synchronization, and protocol design belong in future networking documentation.

The engine and core runner should not require rule changes merely because a controller is remote.

---

# 10. Controller Registration and Player Mapping

Each player participating in a running Session must have exactly one controller registered for that execution.

Conceptually:

```ts
interface ControllerRegistry {
  get(playerId: PlayerId): PlayerController;
}
```

For v1:

```text
Human Player → HumanController
Bot 1        → AIController
Bot 2        → AIController
Bot 3        → AIController
```

A controller's `playerId` must match the player it represents.

Missing controllers, duplicate mappings, or mismatched Player IDs are orchestration/configuration failures and should be detected before or at Session startup rather than treated as normal illegal Moves.

The registry is runtime coordination data, not authoritative game state.

---

# 11. Session Startup

The UI Game Setup screen gathers product configuration such as:

- selected `GameMode`;
- each bot's difficulty;
- any supported Session settings/configuration.

The high-level flow is:

```text
Game Setup UI
    ↓ configuration
Application / Orchestrator setup
    ↓
Create controller mapping
    ↓
GameRunner.start(...)
    ↓
GameEngine.createSession(...)
    ↓
GameEngine.startRound(...)
    ↓
route emitted events
    ↓
normal Turn execution
```

The Orchestrator owns the **timing of the calls**.

The Game Engine owns the authoritative result of Session creation and Round startup.

For example, the runner does not decide which player owns the opening Turn. It reads that result from the engine after the engine performs Round setup.

---

# 12. Round Startup

Starting a Round is an explicit engine lifecycle operation coordinated by the runner.

Conceptually:

```ts
const result = engine.startRound(state, rng);
```

The engine owns:

- deck creation;
- deterministic shuffle;
- dealing;
- the 3♣ opening rule;
- authoritative starting player;
- new Round state;
- Round-start events.

The runner owns:

- deciding **when** it is appropriate to request `startRound`;
- routing the returned events;
- transitioning from orchestration setup/checkpoint state into active Round execution.

The runner must not call `startRound` while a previous Round is still active.

---

# 13. Main Game Loop

The core Turn loop is:

```text
1. Read authoritative engine state/result.
2. Confirm the Round is active.
3. Read the engine-determined current PlayerId.
4. Find that player's registered controller.
5. Request PlayerView from the engine.
6. Request legal Moves from the engine.
7. Create one PlayerTurnRequest.
8. Await controller.chooseMove(request).
9. Verify the response still belongs to the active request.
10. Submit the returned Move to the engine.
11. Process accepted/rejected MoveResult.
12. Route returned factual events.
13. If Round remains active, repeat.
14. If Round completed, enter Round Result checkpoint.
15. If Session completed, enter Session Complete state.
```

The loop must use the engine's resulting authoritative state after every accepted operation.

The runner must not independently derive the next player by incrementing a player index or duplicating Trick logic.

---

# 14. Turn Request Lifecycle

Only one controller should be considered authoritative for input at a time.

A Turn request conceptually moves through:

```text
CREATED
   ↓
AWAITING_CONTROLLER
   ↓
RESPONSE_RECEIVED
   ↓
SUBMITTED_TO_ENGINE
   ↓
ACCEPTED or REJECTED
```

A Turn request becomes obsolete if, for example:

- the runner is cancelled;
- a loaded/restored execution replaces the current state;
- the current Turn changes before a delayed response is processed;
- a newer request supersedes it;
- the Session completes.

Obsolete responses must be discarded instead of submitted to the engine.

A monotonically increasing request counter, opaque request ID, or equivalent mechanism may be used.

---

# 15. Human Turn Handling

Human gameplay is inherently asynchronous.

The runner should not block the browser thread while waiting.

Conceptually:

```text
Runner creates Turn request
      ↓
HumanController waits
      ↓
UI displays enabled interaction for that Turn
      ↓
Human presses Play / Pass
      ↓
HumanController resolves Move
      ↓
Runner submits Move to Engine
```

The UI must not be able to submit a Move directly to internal engine state while bypassing the runner.

The runner/controller integration should also prevent:

- double-click submissions;
- multiple Play submissions for the same Turn;
- clicks arriving after a Turn has already changed;
- old UI callbacks resolving a newly active Turn.

---

# 16. AI Turn Handling

For an AI Turn:

```text
Runner
   ↓ PlayerTurnRequest
AIController
   ↓ safe view + legal moves
AI System
   ↓ selected Move
AIController
   ↓ Move
Runner
   ↓
Engine
```

The runner does not rank candidate Moves.

The AI subsystem does not receive authoritative private state outside the information represented in its allowed view/contracts.

AI randomness must be managed by the AI subsystem according to `ai.md`. Engine randomness remains separate and is used only for authoritative engine operations such as shuffling.

---

# 17. Invalid Move Handling

A rejected player Move is a normal structured engine result, not necessarily an application crash.

The runner must distinguish:

1. **Normal Move rejection** — engine returns `accepted: false` with `MoveValidationError`.
2. **Controller failure** — controller throws/fails to return a Move.
3. **Orchestration/configuration failure** — missing controller, impossible lifecycle transition, etc.
4. **Unexpected engine/programming failure** — invariant violation or exceptional bug.

For a normal Move rejection:

```text
Controller proposes Move
      ↓
Engine rejects without mutation
      ↓
Runner routes validation result as appropriate
      ↓
Runner requests another action for the same authoritative Turn
```

The runner must not attempt to "fix" the Move or manually apply part of it.

### Human rejection

For a human player, the UI should be able to present the engine's validation feedback and allow another choice.

### AI rejection

An AI-produced illegal Move indicates a likely bug or stale decision because AI should normally choose from engine-generated legal candidates.

The runner may retry according to a bounded implementation policy, but it must not create its own legality fallback rules.

Repeated AI invalid Moves should become a visible orchestration/AI failure rather than an infinite loop.

### Future Network rejection

A remote invalid/stale Move should be rejected through the same authoritative engine path. Network-specific retry/timeout/disconnect behavior belongs to networking design.

---

# 18. Human Auto-Pass Coordination — Deferred

The product supports an optional setting that auto-passes the human **only when zero legal plays exist**.

The engine remains authoritative about whether legal plays exist.

A suitable orchestration flow is:

```text
Human Turn begins
    ↓
Runner obtains legal Moves from Engine
    ↓
Are there zero legal Play moves?
    ├── No  → request HumanController input normally
    └── Yes
         ↓
     Is human auto-pass enabled?
         ├── No  → wait for explicit human Pass; UI may show pass hint
         └── Yes → runner submits a Pass Move on behalf of the human
```

Important boundaries:

- the runner does not independently calculate whether a Play exists;
- the optional preference comes from application/settings configuration;
- the authoritative Pass still goes through `engine.submitMove`;
- bots must observe only the public fact that the human passed;
- the private reason "auto-pass because no valid play existed" may be shown to the human/logging UI but must not leak to AI Player Views.

The detailed storage of the preference belongs to `persistence.md` / settings design.

---

# 19. Engine Result Processing

After every engine operation, the runner processes the returned result in a consistent order.

A recommended sequence is:

```text
1. Accept the returned authoritative state as current runner engine state.
2. Route engine-produced events to registered event consumers.
3. Update/expose runner lifecycle status derived from engine lifecycle state.
4. Decide whether execution should:
   a. request another Turn,
   b. enter Round Result checkpoint,
   c. enter Session Complete state, or
   d. stop because of cancellation/failure/pause.
```

The runner may interpret **engine lifecycle contracts** to determine what coordination step is needed next, but it must not recalculate the underlying rule result.

For example:

- acceptable: "Engine reports Round completed, so enter Round Result checkpoint."
- not acceptable: "I counted the cards myself and decided the Round is over."

---

# 20. Event Distribution

The engine produces factual `GameEvent` contracts.

The Orchestrator may act as the runtime distribution point for those events.

Conceptually:

```ts
interface GameEventSink {
  onEvents(events: readonly GameEvent[]): void | Promise<void>;
}
```

Potential consumers include:

- UI/application state adapters;
- event/logging system;
- persistence coordination;
- simulation metrics;
- test observers.

The Orchestrator should route events without converting them into authoritative game decisions.

`events-logging.md` will own:

- event retention;
- formatting;
- filtering;
- player-facing history text;
- debug logs;
- long-lived event consumers.

The Orchestrator may sequence event delivery, but factual event creation remains engine-owned.

---

# 21. Round Result Checkpoint

After every Round, normal human gameplay must stop at an explicit result checkpoint.

This is a confirmed product flow:

```text
Round ends
    ↓
Engine calculates official Round result
    ↓
Engine updates cumulative Session scores
    ↓
Runner enters ROUND_RESULT state
    ↓
UI displays:
  • official Round scores/results
  • updated cumulative Session scores
    ↓
User chooses "Next Round"
    ↓
Runner invokes startRound(...)
    ↓
next Round begins
```

The runner must **not automatically start the next Round** during normal human gameplay.

This prevents authoritative state from silently progressing while the user is still viewing the completed Round's result.

During the checkpoint:

- no Player Controller should receive a normal Turn request;
- the completed Round's authoritative result remains available for presentation;
- the UI may present scoring explanations defined in the requirements;
- presentation animations/timing remain UI responsibilities;
- only an explicit continuation action should advance to the next Round.

Conceptually:

```ts
interface RoundResultState {
  readonly roundNumber: number;
  readonly result: RoundResultView;
  readonly sessionScores: readonly PlayerSessionScoreView[];
}
```

The exact result view types should use or wrap engine-owned public result contracts rather than duplicating scoring structures in the Orchestrator.

---

# 22. Continuing to the Next Round

`continueToNextRound()` is valid only when:

- the runner is at the Round Result checkpoint;
- the Session has not completed;
- no newer execution has replaced the current Session;
- the runner has not been cancelled.

Conceptually:

```ts
await runner.continueToNextRound();
```

The runner then:

```text
1. Leaves ROUND_RESULT.
2. Invokes GameEngine.startRound(currentState, engineRng).
3. Accepts the returned authoritative state.
4. Routes Round-start events.
5. Enters active Round execution.
6. Requests the engine-determined starting player's controller action.
```

Calling continuation twice must not start two Rounds.

The runner should reject or ignore duplicate continuation attempts according to its public error policy.

---

# 23. Headless Round Continuation

Headless simulation uses the **same Round lifecycle**.

The difference is the continuation policy, not the rules.

For example:

```text
Round completed
    ↓
Runner enters Round Result checkpoint
    ↓
Headless simulation consumer immediately calls continueToNextRound()
    ↓
next Round starts
```

This avoids creating a separate simulation-only game flow.

A simulation helper may automatically continue whenever it observes the checkpoint, but that helper belongs to `testing-simulation.md`, not to the core game rules.

---

# 24. Session Completion

After exactly five completed Rounds, the engine determines Session completion and the final result according to `requirements.md` and `engine.md`.

The runner should then enter a terminal Session state:

```text
SESSION_COMPLETE
```

At Session completion:

- no additional Round may start;
- no Player Controller receives another Turn request;
- final engine results remain available to UI/persistence consumers;
- Session Summary may be shown by the UI;
- persistence may update cumulative statistics;
- Rematch/New Session/Home behavior is coordinated by the application layer around a new or replacement runner execution.

The runner does not calculate final rankings or tiebreaks itself.

---

# 25. Runner Lifecycle State

The Orchestrator needs execution state of its own, but this must remain distinct from authoritative game state.

A recommended public lifecycle is:

```ts
type RunnerStatus =
  | 'idle'
  | 'starting'
  | 'running'
  | 'waitingForPlayer'
  | 'roundResult'
  | 'paused'
  | 'sessionComplete'
  | 'cancelled'
  | 'failed';
```

This status answers questions such as:

- Is execution currently accepting a player action?
- Is the UI expected to display Round Result?
- Is execution paused?
- Has the Session finished?

It does **not** duplicate:

- hands;
- current Trick;
- scores;
- finish order;
- current authoritative player;
- Round rule state.

Those remain engine-owned.

Implementation may use a richer internal state machine or discriminated union if that makes invalid lifecycle transitions harder to represent.

---

# 26. Pause and Resume Execution

Pause/resume at the orchestration level means stopping or resuming **execution requests**, not altering Pusoy Dos rules.

When paused:

- the runner does not request new controller actions;
- the runner does not start the next Round;
- authoritative engine state remains unchanged;
- pending controller input should not be allowed to advance state unless the runner explicitly accepts it after resume.

A conservative implementation should invalidate or suspend pending Turn requests when entering pause so stale asynchronous results cannot progress the game unexpectedly.

`resume()` continues from the same authoritative engine state and lifecycle point.

This is distinct from **persistent save/resume across page reloads**, which belongs to `persistence.md`.

---

# 27. Persistent Save / Resume Boundary — Deferred

The requirements include resuming an unfinished Session.

The Orchestrator does not serialize or store the Session itself.

The intended separation is:

```text
Engine / Orchestrator execution
      ↓ state-change integration point
Persistence subsystem
      ↓
Durable resumable snapshot
```

When restoring later:

```text
Persistence loads validated snapshot
      ↓
Engine restoration contract reconstructs authoritative state
      ↓
Application reconstructs controller mapping/configuration
      ↓
GameRunner resumes coordination from the restored lifecycle point
```

Detailed snapshot schema, storage timing, versioning, migration, and validation belong to `persistence.md`.

An internal `SessionState` structure must not automatically be treated as a permanent storage schema.

A future persistence design must also define how a saved `roundResult` checkpoint is restored so a page reload does not accidentally skip directly into the next Round.

---

# 28. Cancellation and Leaving a Game

Cancellation terminates the current runner execution without changing the rules result of already accepted engine actions.

Possible causes include:

- user leaves the active game;
- user starts a different Session;
- application tears down the game screen;
- simulation intentionally aborts;
- unrecoverable controller/orchestration error.

On cancellation:

- pending Turn requests become invalid;
- late controller responses are ignored;
- no new engine Move is submitted by the cancelled runner;
- no next Round is started;
- external consumers may be informed of runner cancellation.

Whether leaving a game prompts the user, automatically saves, or discards progress is a UI/persistence product decision and should not be hard-coded into the runner.

---

# 29. Async and Concurrency Safety

Even though Pusoy Dos has one active Turn at a time, asynchronous controllers can create concurrency bugs if the runner is careless.

The runner must prevent:

- two active controller requests for one Turn;
- two different controllers acting simultaneously;
- a Human double-submit advancing two Moves;
- an old AI response being submitted after pause/cancel/restore;
- duplicate `continueToNextRound()` calls;
- re-entrant runner-loop execution;
- event callbacks accidentally causing a second concurrent advancement;
- a controller response for Player A being applied after the engine has advanced to Player B.

Recommended safeguards include:

- one active request ID/token;
- a serialized runner execution queue or equivalent guard;
- checking runner lifecycle before submission;
- checking that the engine's current authoritative player still matches the request;
- invalidating pending requests on cancel/pause/replacement;
- making continuation idempotent or explicitly rejecting duplicates.

These safeguards protect orchestration correctness; they do not replace engine Move validation.

---

# 30. Presentation Timing and Pacing

The requirements include presentation pacing such as **Relaxed** and **Fast**.

Game correctness must not depend on artificial delays.

Therefore:

- the Game Engine must never sleep or delay;
- AI intelligence must not change because of presentation pacing;
- the core runner should not require delays to remain correct;
- UI/application presentation code may delay when visualizing AI actions, transitions, or scoring;
- headless simulation should be able to run with no presentation delays.

If the application needs to pause advancement until a presentation completes, that should be expressed as an explicit application/orchestration continuation hook rather than a hard-coded engine timeout.

The confirmed Round Result checkpoint is one such explicit wait point.

Additional per-Move presentation gating may be introduced later if UI design requires it, but is not required for the initial runner design.

---

# 31. Event Delivery vs Presentation Completion

Engine events describe what **already happened authoritatively**.

Presentation may lag behind those events.

For example:

```text
Engine accepts bot Play
    ↓
CARDS_PLAYED + TURN_CHANGED emitted
    ↓
Runner routes events
    ↓
UI animates played cards
    ↓
UI becomes visually ready for the next displayed action
```

The Orchestrator must not reinterpret delayed presentation as delayed authoritative legality.

If future UX requires strict sequencing so the runner waits for a presentation acknowledgment before asking the next controller, that should be modeled as an explicit presentation gate with a headless immediate implementation.

This is intentionally not required in v1.0 of this document because current requirements specify pacing but do not require authoritative execution to wait after every Move.

---

# 32. Error Model

The runner should expose structured orchestration errors separately from engine Move validation.

Conceptually:

```ts
type RunnerErrorCode =
  | 'INVALID_RUNNER_STATE'
  | 'CONTROLLER_NOT_FOUND'
  | 'CONTROLLER_PLAYER_MISMATCH'
  | 'CONTROLLER_FAILED'
  | 'STALE_CONTROLLER_RESPONSE'
  | 'DUPLICATE_CONTINUATION'
  | 'ENGINE_OPERATION_FAILED';
```

Exact codes are implementation details to finalize later.

Normal engine `MoveValidationError` values should remain engine-owned and should not be duplicated into a second Orchestrator error hierarchy.

The runner should fail loudly for impossible orchestration/configuration bugs rather than silently choosing arbitrary behavior.

---

# 33. Event / State Observation Contracts

The UI and other consumers need a way to observe execution without gaining mutation access.

A minimal observer shape could be:

```ts
interface RunnerObserver {
  onStatusChanged?(status: RunnerStatus): void;

  onEngineEvents?(
    events: readonly GameEvent[]
  ): void | Promise<void>;

  onRoundResult?(result: RoundResultPresentationData): void;

  onSessionComplete?(result: SessionResultPresentationData): void;

  onError?(error: RunnerError): void;
}
```

The exact presentation data types should avoid copying authoritative scoring logic. Prefer engine public result/view contracts or thin Orchestrator wrappers that add execution metadata only.

The implementation may instead use subscriptions, callbacks, application state stores, async iterators, or another mechanism. The architectural requirement is one-way observation rather than unrestricted mutation.

---

# 34. Suggested Runner Session Configuration

The runner needs enough setup information to coordinate execution but should not absorb unrelated settings.

Conceptually:

```ts
interface RunnerSessionConfig {
  readonly engineConfig: EngineSessionConfig;
  readonly controllers: readonly PlayerController[];
  readonly engineRng: RNG;
  readonly humanAutoPass: boolean;
}
```

Potential event sinks/observers may be supplied separately through constructor dependencies or registration.

AI difficulty/personality configuration should normally be used when constructing AI Controllers rather than being interpreted by `GameRunner`.

Presentation pacing should not be an engine setting and does not need to be a core runner rule configuration.

---

# 35. Headless Execution

A core architectural requirement is that a complete Session can run without React.

A headless configuration should conceptually support:

```text
GameEngine
+ GameRunner
+ AIController P1
+ AIController P2
+ AIController P3
+ AIController P4
+ optional event/metrics observer
```

The same runner loop should execute all five Rounds.

At each Round Result checkpoint, a headless simulation consumer can immediately continue.

Headless mode must not require:

- DOM APIs;
- React;
- browser navigation;
- visual animations;
- user click events;
- `localStorage`;
- artificial timing delays.

This architecture is important for automated regression testing and future AI balancing simulations.

---

# 36. Determinism

The runner itself should not introduce gameplay randomness.

Authoritative random operations belong to the engine's injected `RNG`.

Initial v1 AI move selection is deterministic and does not require AI decision randomness. If future controlled AI variation is introduced, that randomness belongs to the AI subsystem and must use its own seeded/injected RNG design.

A reproducible headless game therefore requires enough configuration to reproduce:

- engine RNG seed/state;
- AI RNG seed/state only when future controlled AI randomness is enabled;
- each controller's configured personality/difficulty;
- game mode/ruleset configuration;
- initial/session configuration.

The exact replay/simulation metadata format belongs to `testing-simulation.md` and potentially `persistence.md`.

---

# 37. UI/Application Boundary

The UI/application layer owns:

- Home/Main Menu;
- Game Setup;
- Game Table rendering;
- human card selection and manual ordering;
- Play/Pass button interactions;
- Round Result presentation;
- Session Summary presentation;
- Stats screen;
- Settings screen;
- navigation between these screens;
- presentation pacing and animations.

The Orchestrator owns the execution coordination underneath active gameplay.

Important distinction:

```text
UI says: "The user chose Next Round."
Orchestrator says: "The runner is currently allowed to continue."
Engine says: "Here is the authoritative state of the new Round."
```

The Orchestrator does not decide how a Round Result screen looks or how long the user views it.

---

# 38. AI Boundary

The AI subsystem owns:

- candidate evaluation;
- move scoring;
- personality behavior;
- difficulty differences;
- opponent-aware heuristics;
- AI-specific randomness;
- difficulty-dependent reasoning breadth/depth and strategic capability; Easy must not intentionally make irrational Moves merely because it is Easy.

The Orchestrator owns only the act of requesting a Move from the AI Controller at the correct time.

The AI must not import or inspect engine-internal `SessionState` simply because the Orchestrator has access to it.

It receives information-safe contracts prepared for that controller.

---

# 39. Persistence Boundary

Persistence owns:

- save/load policy;
- `localStorage` access;
- settings storage;
- statistics storage;
- resumable snapshot schema;
- schema versioning;
- migration;
- recovery/error behavior.

The Orchestrator may expose lifecycle/state-change integration points so persistence knows **when** something changed, but it should not decide **how** or **where** data is stored.

A persistence consumer must not be allowed to mutate live engine state directly.

---

# 40. Events and Logging Boundary

The Game Engine owns factual event creation.

The Game Orchestrator owns runtime routing/sequencing of those events.

The Event & Logging subsystem owns retention and presentation-oriented processing.

```text
Game Engine
   ↓ GameEvent[]
GameRunner
   ↓
Event / Logging Consumers
   ↓
History / debug / metrics / formatted UI text
```

The logging subsystem must not become an alternate source of authoritative state.

---

# 41. Simulation Boundary

The Testing & Simulation subsystem owns:

- batch execution;
- number of Sessions to run;
- seed generation/selection;
- matchup configuration;
- automatic Round continuation;
- metrics aggregation;
- balance analysis;
- regression fixtures;
- failure reproduction.

The runner provides one reusable execution mechanism.

Simulation should not copy the rules loop into a separate implementation.

---

# 42. Future Networking Boundary — Possible Future Direction

Future online multiplayer should primarily replace or add controller and transport concerns rather than rewrite engine rules.

A possible future flow is:

```text
Local GameRunner / authoritative host
      ↓ Turn request
NetworkController
      ↓ network transport
Remote client
      ↓ Move
NetworkController
      ↓
GameRunner
      ↓
GameEngine
```

The exact authority model for online play has not been decided and belongs to future `networking.md`.

This document only requires that v1 controller abstractions do not assume every player is local or synchronous.

---

# 43. Proposed Package Structure

A suitable initial organization is:

```text
src/
  orchestrator/
    index.ts
    GameRunner.ts

    controllers/
      PlayerController.ts
      HumanController.ts
      AIController.ts
      ControllerRegistry.ts

    requests/
      PlayerTurnRequest.ts
      TurnRequestId.ts

    lifecycle/
      RunnerStatus.ts
      runnerTransitions.ts

    results/
      RunnerError.ts
      RunnerResult.ts

    events/
      RunnerObserver.ts
      GameEventSink.ts

    config/
      RunnerSessionConfig.ts
```

This structure is intentionally modest.

Do not create files merely to match the diagram if a smaller implementation is clearer.

Future `NetworkController.ts` should be added only when networking enters scope.

The Orchestrator should not become a generic `/application` dumping ground for unrelated UI navigation or persistence code.

---

# 44. Suggested Implementation Flow

A practical implementation order is:

1. Define `PlayerController` and `PlayerTurnRequest` contracts.
2. Define controller registry/mapping validation.
3. Define minimal `RunnerStatus` lifecycle.
4. Implement Session startup around `GameEngine.createSession` and `startRound`.
5. Implement the basic serialized Turn loop.
6. Implement accepted/rejected Move handling.
7. Implement `HumanController` asynchronous request resolution.
8. Implement `AIController` adapter contract with a placeholder/test AI.
9. Implement Round Result checkpoint.
10. Implement explicit `continueToNextRound()`.
11. Implement Session completion.
12. Add request IDs/stale-response protection.
13. Add pause/resume/cancel behavior.
14. Add event observers/sinks.
15. Add optional human auto-pass coordination.
16. Add headless four-controller execution tests.
17. Integrate UI/application layer.
18. Integrate persistence through defined hooks/contracts.
19. Integrate simulation/balancing tooling.

---

# 45. Testing Requirements

The Orchestrator should be testable using fake/stub controllers and the real Game Engine where practical.

At minimum, tests should verify:

## 45.1 Startup

- valid controller mapping starts a Session;
- missing controller fails clearly;
- controller/player mismatch fails clearly;
- Round 1 starts through the engine;
- runner does not independently choose the opening player.

## 45.2 Turn execution

- only the engine-determined current controller is asked to act;
- controller receives its permitted `PlayerView`;
- controller receives engine-generated legal Moves;
- returned Move is submitted exactly once;
- accepted Move advances from the engine's result;
- next controller comes from resulting engine state.

## 45.3 Human asynchronous behavior

- runner waits while the Human Controller has not resolved;
- human Play resolves one Turn request;
- double submission does not produce two engine Moves;
- stale UI response is ignored after cancellation or request replacement.

## 45.4 Invalid Moves

- engine-rejected Move does not mutate runner's authoritative engine state beyond the engine result;
- human receives another opportunity for the same Turn;
- repeated AI invalid Moves do not create an infinite loop;
- runner does not invent a replacement legal Move.

## 45.5 Auto-pass — Deferred

- auto-pass occurs only when engine legal Move information confirms no legal Play exists;
- disabled auto-pass still waits for human Pass;
- automatic Pass is submitted through the engine;
- private auto-pass reason is not injected into bot Player Views.

## 45.6 Round transition

- completed Round enters `roundResult` state;
- next Round does not start automatically in human gameplay;
- Round result and updated Session totals are available to observers/UI;
- one explicit continuation starts exactly one next Round;
- duplicate continuation cannot start two Rounds;
- no controller acts while waiting at Round Result.

## 45.7 Session completion

- runner stops after engine Session completion;
- no sixth Round starts;
- no controller is requested after completion;
- final result is observable by UI/persistence consumers.

## 45.8 Pause/cancel/stale input

- pause prevents state advancement;
- resume continues from the same engine state;
- cancellation invalidates pending requests;
- late AI/Human response after cancellation is ignored;
- a previous Turn's response cannot be applied to a later Turn.

## 45.9 Headless execution

- four AI Controllers can complete one Round without UI;
- four AI Controllers can complete all five Rounds;
- headless consumer can auto-continue Round Result checkpoints;
- deterministic configuration can reproduce the same execution when engine and AI determinism are configured identically.

## 45.10 Boundary tests

- Orchestrator imports no React components;
- Orchestrator performs no `localStorage` access;
- Game Engine never calls Player Controllers;
- controllers cannot mutate authoritative state directly;
- runner does not calculate scores or combination legality.

---

# 46. Invariants

The Orchestrator should maintain the following execution invariants:

1. A running Session has exactly one controller mapping per participating `PlayerId`.
2. At most one authoritative Turn request is active at a time.
3. Only the controller matching the engine's current player may supply the active Move.
4. Every authoritative player Move is submitted through the Game Engine.
5. A rejected Move never causes the runner to manually alter authoritative game state.
6. No normal controller Turn request exists during the Round Result checkpoint.
7. A next Round begins only after an explicit continuation in normal human gameplay.
8. Session completion prevents further Round starts and Turn requests.
9. Cancelled executions cannot be advanced by late controller responses.
10. Orchestrator lifecycle state does not become a duplicate representation of authoritative game rules/state.
11. Headless and UI-driven execution use the same GameRunner rules loop.
12. Events routed by the runner originate from authoritative engine results rather than being invented as substitutes for engine facts.

---

# 47. Cross-Document Ownership Matrix

| Concern | Owning document/module |
|---|---|
| Product rules, Session = 5 Rounds, UX requirements | `requirements.md` |
| `Card`, `PlayerId`, `Move`, `GameMode` | `domain-model.md` |
| Authoritative state | `engine.md` |
| Legal Move generation | `engine.md` |
| Move validation | `engine.md` |
| Turn/Trick result | `engine.md` |
| Round end determination | `engine.md` |
| Scores and Session totals | `engine.md` |
| `PlayerView`, public views | `engine.md` |
| Factual `GameEvent` contract | `engine.md` |
| When controller is asked to act | `orchestrator.md` |
| Controller interface | `orchestrator.md` |
| Async human/AI/network waiting | `orchestrator.md` |
| Round Result execution checkpoint | `orchestrator.md` + product requirement in `requirements.md` |
| Explicit Next Round continuation | `orchestrator.md` + UI behavior in `ui-ux.md` |
| AI strategy/personality/difficulty | `ai.md` |
| Screens/card interaction/presentation | `ui-ux.md` |
| Relaxed/Fast presentation pacing | `ui-ux.md` |
| Save/load schema and `localStorage` | `persistence.md` |
| Event retention/formatting/history | `events-logging.md` |
| Batch runs/metrics/balance analysis | `testing-simulation.md` |
| Network protocol/transport | future `networking.md` |

---

# 48. Explicit Design Decisions in v1.0

The following decisions are established by this document and current project requirements:

1. `GameOrchestrator` is the architectural subsystem; `GameRunner` is the primary concrete execution coordinator.
2. Player Controllers are asynchronous and return shared `Move` intent.
3. Human, AI, and future Network players share one controller abstraction.
4. The runner gets the acting player from authoritative engine state; it does not calculate Turn rotation independently.
5. The runner provides controllers only information-safe engine views/contracts.
6. Legal Moves come from the engine.
7. Invalid Moves are rejected by the engine; the runner coordinates retry rather than repairing them.
8. Human auto-pass is orchestration/application behavior built on engine legal-Move information.
9. After every Round, the runner enters an explicit Round Result checkpoint.
10. During that checkpoint, the UI displays the official Round result/scores and updated cumulative Session totals.
11. In normal human gameplay, the next Round starts only after the user explicitly chooses **Next Round**.
12. Headless execution uses the same checkpoint but may immediately continue through a simulation policy.
13. The runner does not own presentation delays, persistence implementation, AI logic, or logging storage.
14. Pause/cancel/stale-response handling belongs to orchestration because controllers are asynchronous.
15. The same core runner must work without React.

---

# 49. Open Decisions

These items are intentionally **not finalized** in this document:

1. **Exact GameRunner API style**  
   Class-based facade vs functional runner/service composition.

2. **Exact observer mechanism**  
   Callbacks, subscription store, async iterator, application state adapter, or another pattern.

3. **Exact Turn request cancellation mechanism**  
   Opaque request IDs alone, `AbortSignal`, both, or another cancellation token.

4. **Exact AI invalid-Move retry policy**  
   A bounded retry count/error escalation policy should be selected when AI integration is designed.

5. **Per-Move presentation gating**  
   Current requirements define pacing but do not yet require the runner to wait for UI animation acknowledgment after every Move. The Round Result checkpoint is confirmed; additional gates remain optional.

6. **Persistent restoration contract**  
   Exact engine/orchestrator APIs for restoring a saved Session will be defined with `persistence.md`.

7. **Runner lifecycle representation**  
   Simple status enum vs discriminated union/state machine.

8. **Event sink delivery semantics**  
   Whether event sinks are awaited sequentially, delivered synchronously, or isolated from execution failure should be finalized with `events-logging.md` and persistence integration.

9. **Leaving an unfinished Session**  
   Whether UI prompts, auto-saves, or immediately leaves is a product/UI/persistence decision not yet fixed here.

10. **Future online authority model**  
    Client-hosted, server-authoritative, or another model remains future networking design.

These open decisions should not be silently inferred during implementation if they materially affect public contracts or product behavior.

---

# 50. Cross-Document Synchronization Status

The previously recorded Round Result / explicit **Next Round** clarification and parent-version metadata mismatch have been synchronized in the September 5, 2026 documentation pass.

Current orchestration constraints relevant to AI/performance are:

- actual AI computation duration is distinct from simulated presentation delay;
- the Orchestrator may wait for configured presentation pacing after a bot result, but must not force the AI algorithm to burn CPU time;
- a slower device may take longer to compute a Hard decision; orchestration should remain cancellation/staleness-safe rather than assume a fixed compute duration;
- headless simulations bypass artificial presentation delay;
- AI-internal memoization, bitmasks, pruning, and search algorithms do not affect Orchestrator public contracts.

No known unresolved rule conflict is introduced by these changes. Future material conflicts discovered during implementation must be raised for product/design review rather than silently resolved in this document.


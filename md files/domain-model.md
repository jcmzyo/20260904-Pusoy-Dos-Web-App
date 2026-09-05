# Pusoy Dos --- Shared Domain Model

## Domain Model Document (v1.2)

**Status:** Draft for implementation\
**Last Modified:** September 5, 2026
**Parent document:** `requirements.md` v1.9\
**Scope:** Shared, implementation-independent game vocabulary and data
contracts\
**Language:** TypeScript

------------------------------------------------------------------------

> **Phase 1 implementation scope:** shared concepts needed by the Basic Mode playable product. Known future vocabulary may remain where it is cheap and stable (for example `GameMode`), but its presence does not require deferred features to be implemented.

# 1. Purpose

This document defines the **shared domain model** used across the Pusoy
Dos application.

`requirements.md` remains the source of truth for what the game must do
and for canonical gameplay terminology. This document translates the
stable, cross-module concepts from those requirements into shared
TypeScript-oriented data contracts.

The domain model exists so that the Game Engine, Game Orchestrator, AI,
UI, persistence, logging, simulation, and future networking code can
speak the same language without importing one another's internal
implementation models.

The domain model answers:

> What data concepts are fundamental to describing Pusoy Dos regardless
> of which application module is using them?

It does **not** define authoritative rule algorithms, runtime
orchestration, UI behavior, storage schemas, AI strategy, or internal
engine state.

------------------------------------------------------------------------

# 2. Authority and Dependency Rules

## 2.1 Document authority

The documentation hierarchy is:

1.  `requirements.md` --- product truth, canonical game rules, shared
    gameplay terminology, scope, and high-level architectural
    boundaries.
2.  `domain-model.md` --- shared application-wide domain types and
    contracts derived from those requirements.
3.  Subsystem documents --- implementation contracts and behavior owned
    by each subsystem.

If this document conflicts with a confirmed rule in `requirements.md`,
`requirements.md` wins.

If a shared domain type must change because the product meaning changed,
update `requirements.md` first when applicable, then this document, then
affected subsystem documents.

## 2.2 Dependency direction

The shared domain model must not depend on application subsystems.

``` text
                 requirements.md
                       ↓
                domain-model.md
                       ↓
        ┌──────────────┼──────────────┐
        ↓              ↓              ↓
      Engine       Orchestrator       AI
        ↓              ↓              ↓
       UI         Persistence     Logging
                       ↓
                 Simulation /
              Future Networking
```

In code, `/domain` must not import from:

-   `/engine`;
-   `/orchestrator`;
-   `/ai`;
-   `/ui`;
-   `/persistence`;
-   `/events-logging`;
-   `/simulation`;
-   browser APIs;
-   React.

Subsystems may depend on `/domain`.

------------------------------------------------------------------------

# 3. What Belongs in the Shared Domain Model

A type belongs in `/domain` when it describes a stable Pusoy Dos concept
that multiple modules legitimately need to understand.

Examples:

-   Card;
-   Rank;
-   Suit;
-   PlayerId;
-   GameMode;
-   CombinationType;
-   Combination;
-   Move.

A type does **not** belong here merely because several modules happen to
use it.

Engine implementation details such as `RoundState`, `TrickState`,
`CombinationStrength`, validation context, or turn-resolution data
remain engine-owned.

UI-only concepts such as selected cards, animation state, card
coordinates, themes, and display strings remain UI-owned.

AI evaluation scores and personality state remain AI-owned.

Persistence schemas and migration metadata remain persistence-owned.

------------------------------------------------------------------------

# 4. Canonical Terminology

Shared gameplay terms use the canonical definitions in
`requirements.md`, especially §1.4 Domain Terminology.

This document does not redefine Session, Round, Turn, Trick, Lead,
Finish, Bomb, Public Information, Private Information, or other gameplay
terms already defined there.

Instead, it defines only the shared data representations needed to
express those concepts across modules.

------------------------------------------------------------------------

# 5. Primitive Domain Types

## 5.1 PlayerId

Every player participating in a Session has a stable identifier.

``` ts
type PlayerId = string;
```

`PlayerId` identifies a game participant. It must not encode whether the
participant is human, AI-controlled, or network-controlled.

Controller type is not part of the fundamental player identity.

A branded string may be used later if stronger compile-time distinction
is useful, but that is an implementation choice.

## 5.2 Rank

Ranks follow the canonical ordering in `requirements.md`.

``` ts
type Rank =
  | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '10' | 'J' | 'Q' | 'K' | 'A' | '2';
```

The type defines the valid rank values.

The **authoritative comparison behavior and configured rank order**
belong to the Game Engine and its `RulesetConfig`, not to this type.

## 5.3 Suit

``` ts
type Suit =
  | 'clubs'
  | 'spades'
  | 'hearts'
  | 'diamonds';
```

The type defines the valid suit values.

The authoritative suit ordering belongs to the Game Engine ruleset.

------------------------------------------------------------------------

# 6. Card

A Card is a shared domain value representing one physical playing card.

``` ts
interface Card {
  readonly rank: Rank;
  readonly suit: Suit;
}
```

The rank/suit pair uniquely identifies a card in the standard deck.

A Card must contain only domain information.

It must not contain:

-   image paths;
-   CSS classes;
-   screen coordinates;
-   selection state;
-   animation state;
-   ownership;
-   visibility state;
-   AI evaluation values.

Those concerns belong to the subsystem using the Card.

## 6.1 Card identity

Modules that need stable card identity should derive it consistently
from rank and suit rather than introduce subsystem-specific card
identities.

For example:

``` ts
type CardId = `${Rank}-${Suit}`;
```

Whether `CardId` is stored explicitly or derived is an implementation
decision.

------------------------------------------------------------------------

# 7. Game Mode

The v1 game modes are:

``` ts
type GameMode =
  | 'basic'
  | 'competitive';
```

This type identifies the selected rules/scoring mode.

It does not contain the implementation of those rules.

Mode-specific behavior belongs to the Game Engine.

------------------------------------------------------------------------

# 8. Combination Type

The shared valid combination categories are:

``` ts
type CombinationType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'flush'
  | 'fullHouse'
  | 'fourOfAKind'
  | 'straightFlush';
```

The type names the canonical combination categories defined in
`requirements.md`.

It does not define:

-   how a combination is detected;
-   whether a set of cards is valid;
-   how combinations compare;
-   whether a combination can beat the current Trick.

Those are Game Engine responsibilities.

------------------------------------------------------------------------

# 9. Combination

A `Combination` is a shared description of a set of cards that the
authoritative Game Engine has recognized as a valid combination.

``` ts
interface Combination {
  readonly type: CombinationType;
  readonly cards: readonly Card[];
}
```

A subsystem must not assume that constructing this object itself proves
that the cards form a valid combination.

Authoritative creation/validation comes from the Game Engine.

For example, the UI may display a returned `Combination`, and the AI may
inspect one, but neither should reimplement combination detection merely
to construct authoritative combinations.

## 9.1 Engine-only comparison metadata

Normalized comparison data such as:

``` ts
interface CombinationStrength {
  // engine-specific comparison representation
}
```

does **not** belong in the shared domain model.

It is an engine implementation detail because other modules should not
need to understand how the engine numerically compares combinations.

If another module needs a human-readable description such as a
Straight's effective high card, the engine should expose an appropriate
public result/view rather than leak its internal comparison
representation.

------------------------------------------------------------------------

# 10. Move

A Move represents player intent submitted for authoritative processing.

``` ts
type Move =
  | PlayMove
  | PassMove;

interface PlayMove {
  readonly kind: 'play';
  readonly playerId: PlayerId;
  readonly cards: readonly Card[];
}

interface PassMove {
  readonly kind: 'pass';
  readonly playerId: PlayerId;
}
```

A Move is intentionally shared because:

-   a Human Controller produces one;
-   an AI Controller produces one;
-   a future Network Controller may transmit one;
-   the Game Orchestrator forwards one;
-   the Game Engine validates one;
-   logging may record an accepted one.

A Move represents **intent**, not proof of legality.

Only the Game Engine determines whether a submitted Move is legal.

------------------------------------------------------------------------

# 11. Player Identity vs Player Runtime State

The shared domain model should keep player identity minimal.

For example:

``` ts
interface PlayerRef {
  readonly id: PlayerId;
}
```

The project should not create one universal `Player` object containing
every concern.

The following belong elsewhere:

  -----------------------------------------------------------------------
  Concern                             Owner
  ----------------------------------- -----------------------------------
  Cards currently held                Game Engine authoritative state

  Active/finished status              Game Engine

  Current turn                        Game Engine

  AI personality/difficulty           Player configuration / AI /
                                      Orchestrator contract

  Human vs AI controller              Orchestrator

  Display name/avatar                 UI/player configuration

  Persistent statistics               Persistence

  Network connection                  Future networking
  -----------------------------------------------------------------------

This prevents a shared `Player` model from becoming a cross-module
dumping ground.

------------------------------------------------------------------------

# 12. Shared Configuration Identifiers

Only configuration concepts that are truly cross-module should be
shared.

For example, a mode selection may use `GameMode`.

Bot difficulty and personality may eventually have shared identifiers
because the UI, orchestrator, and AI all need to refer to the selected
values. Their behavioral meaning remains owned by `ai.md`.

The exact shared player/session setup contracts should be finalized with
`orchestrator.md` rather than prematurely placed in this document.

------------------------------------------------------------------------

# 13. What Is Intentionally Not Shared

The following types should remain owned by their subsystem unless a
later design demonstrates a genuine cross-module contract need.

## 13.1 Game Engine

Examples:

-   `EngineState`;
-   `SessionState`;
-   `RoundState`;
-   `TrickState`;
-   `InternalPlayerState`;
-   `CombinationStrength`;
-   `MoveValidationContext`;
-   `TurnResolution`;
-   internal scoring accumulators;
-   invariant-checking structures.

## 13.2 Game Orchestrator

Examples:

-   `PlayerController`;
-   controller lifecycle state;
-   runner state;
-   pending-input state;
-   orchestration commands;
-   controller registry.

## 13.3 AI

Examples:

-   evaluation scores;
-   candidate rankings;
-   personality strategy state;
-   difficulty-specific search state;
-   opponent inference state.

## 13.4 UI

Examples:

-   selected-card state;
-   manual hand ordering;
-   screen/view-model state;
-   animations;
-   pacing presentation state;
-   modal state;
-   human-readable messages.

## 13.5 Persistence

Examples:

-   storage keys;
-   snapshot envelopes;
-   schema versions;
-   migrations;
-   serialized statistics records.

## 13.6 Events and Logging

The factual event contracts produced by the engine are public engine
contracts because consumers need to read them.

Log entries, formatted messages, filters, retention metadata, and debug
records are owned by the Event & Logging subsystem.

## 13.7 Testing and Simulation

Examples:

-   simulation scenario;
-   batch-run configuration;
-   aggregate simulation statistics;
-   regression fixtures.

------------------------------------------------------------------------

# 14. Public Contracts Are Not Automatically Domain Models

A useful distinction is:

``` text
Shared Domain Model
    = concepts fundamental to the game

Public Subsystem Contract
    = data another module is intentionally allowed to exchange
      with a particular subsystem
```

For example:

-   `Card` is shared domain.
-   `Move` is shared domain because it is fundamental player intent
    across boundaries.
-   `PlayerView` is an Engine public contract.
-   `MoveValidationError` is an Engine public contract.
-   `PlayerController` is an Orchestrator public contract.
-   `GameEvent` is an Engine-produced public event contract.
-   `SavedGameSnapshot` is a Persistence public contract.

A public type does not need to be moved into `/domain` merely because
another module imports it.

------------------------------------------------------------------------

# 15. Proposed Source Structure

``` text
src/
  domain/
    index.ts

    cards/
      Card.ts
      Rank.ts
      Suit.ts

    players/
      PlayerId.ts

    combinations/
      Combination.ts
      CombinationType.ts

    moves/
      Move.ts

    game/
      GameMode.ts
```

This is intentionally small.

New types should be added only when they represent genuinely shared
domain concepts.

------------------------------------------------------------------------

# 16. Domain Package Rules

`/domain` should follow these rules:

1.  No React/browser dependencies.
2.  No engine algorithms.
3.  No AI strategy.
4.  No persistence implementation.
5.  No logging implementation.
6.  No orchestration logic.
7.  No mutable global state.
8.  Prefer simple serializable values and discriminated unions.
9.  Avoid methods that silently implement authoritative game rules.
10. Avoid a generic `shared/` or `common/` dumping-ground pattern.

A domain type may have harmless value-level utilities where appropriate,
but authoritative gameplay behavior must remain in the Game Engine.

------------------------------------------------------------------------


# 16.1 Internal Representation Boundary

Subsystems may convert shared `Card` collections into bitmasks, bitsets, rank-frequency tables, suit-frequency tables, memoization keys, or other optimized internal representations. Those representations are **not** shared domain types and must not leak into `/domain` merely because multiple algorithms find them convenient. Public/shared contracts continue to use the domain concepts defined here unless a future requirements change explicitly promotes a representation.

The POC optimization priority is correctness/reliability first, then speed, then memory. This priority does not change the shared model and leaves subsystem caches/representations free to evolve after profiling.

------------------------------------------------------------------------

# 17. Cross-Module Usage

Expected dependency examples:

``` text
Game Engine
  imports Card, Rank, Suit, Combination, Move, GameMode

Game Orchestrator
  imports PlayerId, Move, GameMode
  imports Engine public contracts

AI
  imports Card, Combination, Move, PlayerId
  imports PlayerView / legal-move contracts from Engine

UI
  imports Card, CombinationType, GameMode
  imports public Engine/Orchestrator view contracts

Persistence
  imports shared domain values where serialized
  imports explicit persistence/snapshot contracts

Events & Logging
  imports domain values referenced by GameEvent
  consumes Engine event contracts
```

This creates shared vocabulary without exposing internal subsystem
state.

------------------------------------------------------------------------

# 18. Change Rule

Before moving a type into `/domain`, ask:

> Does this describe Pusoy Dos itself, or does it describe how one
> subsystem implements or exposes Pusoy Dos?

If it describes the game independently of subsystem implementation, it
is a domain-model candidate.

If it describes internal behavior or a specific module boundary, it
should remain with that module.

When uncertain, prefer keeping the type with its owning subsystem. It
can be promoted to `/domain` later if a genuine shared abstraction
emerges.

------------------------------------------------------------------------

# 19. Initial Shared Domain Surface

For the first implementation, the intended shared domain surface is
deliberately limited to:

``` text
Card
Rank
Suit
PlayerId
GameMode
CombinationType
Combination
Move
PlayMove
PassMove
```

Additional shared types should be introduced only as implementation
reveals a clear cross-module need.

This keeps the domain model stable, understandable, and independent
while preserving strong subsystem boundaries.

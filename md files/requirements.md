# Pusoy Dos --- Offline Web Game

## Requirements & Planning Document (v1.17)

**Status:** Draft for implementation\
**Last Modified:** September 29, 2026
**Phase 1 scope:** Offline, single-device, Basic Mode, Human vs 3 Baseline bots, headless simulation, and minimal playable UI\
**Committed roadmap:** Completed Phase 1 M1–M4 baseline; Phase 2 M5–M8\
**Future scope:** Deferred or possible directions only; no committed timeline

------------------------------------------------------------------------

> **Committed delivery scope — Phase 2 M5–M8.** Preserve the completed Phase 1 Basic product while adding portrait/mobile gameplay, an Engine-authoritative scripted tutorial, Rules / How to Play, and scoped accessibility improvements. Competitive Mode, persistence, advanced AI, personalities, persistent statistics/general settings, and online play remain deferred. Historical Phase 1 sections describe the baseline; §1.6 and §3.6 define its approved expansion.

## 1. Overview

A web-based implementation of **Pusoy Dos** (Filipino "Big Two").
Version 1 is fully offline: one human player competes against 3
AI-controlled bots on a fixed 4-player table, with no server, account,
or internet requirement.

Phase 1 sessions use **Basic Mode**. **Competitive Mode** remains an approved deferred design and is not part of Phase 1 implementation.
Canonical gameplay terms such as **session**, **round**, and **trick** are defined in §1.4.

The codebase should preserve clean boundaries that do not unnecessarily block future extensions. Online multiplayer is only a possible future direction; no networking architecture, transport, server, or delivery timeline is committed by this document.

### 1.1 Goals

-   Fully playable, rules-accurate Pusoy Dos against AI in a browser.
-   Keep game logic, presentation, and player control cleanly separated.
-   Make the rules engine pure TypeScript with no UI dependencies.
-   Make AI behavior testable and reproducible.
-   Build a useful v1 quickly without creating an architecture that must
    later be discarded.

### 1.2 Non-Goals (v1)

-   Online multiplayer/networking.
-   Accounts, cloud saves, or leaderboards.
-   Multiple bot difficulty/personality systems in the Phase 1 release.
-   Sound design/music as a v1 requirement.


# 1.3 Documentation Structure

This document is the **main product and requirements source of truth** for the project. It defines what the game must do and the architectural boundaries that all subsystem designs must respect.

This document should remain focused on:

- confirmed Pusoy Dos rules and house rules;
- product scope, priorities, and non-goals;
- game modes, scoring, session behavior, and player-facing requirements;
- cross-cutting UX and quality requirements;
- high-level architecture and component boundaries;
- milestones, deferred features, and future compatibility requirements.

Detailed design and implementation decisions belong in dedicated subsystem documents. The planned documentation set is:

| Document | Module | Main responsibility |
|---|---|---|
| `requirements.md` | Overall Product | Main source of truth for scope, rules, features, constraints, and high-level architecture |
| `domain-model.md` | Shared Domain Model | Shared, implementation-independent TypeScript concepts used across modules, such as cards, ranks, suits, combinations, moves, player IDs, and game modes |
| `engine.md` | Game Engine | Authoritative game rules, validation, state transitions, scoring, engine-owned state, information-safe views, and engine event contracts |
| `orchestrator.md` | Game Orchestrator | Coordinates game flow, player controllers, engine execution, events, and round/session progression |
| `ai.md` | AI System | Phase 1 Baseline move selection, permitted game information, deterministic decision behavior, and deferred stronger-strategy extension boundaries |
| `ui-ux.md` | UI Layer | Screens, interactions, presentation, feedback, accessibility, responsive behavior, and quality-of-life features |
| `tutorial.md` | Tutorial | Scenario execution, objectives, guidance, content coverage, and production integration without rules ownership |
| `persistence.md` | Game Persistence | Saving/loading resumable state, settings, statistics, storage schema, versioning, and migrations |
| `events-logging.md` | Event & Logging System | Structured gameplay events, game history, debug logging, formatting, and event consumers |
| `testing-simulation.md` | Testing & Simulation | Unit/integration testing, headless games, deterministic reliability simulation, replay/regression testing, and future evaluation support |

Future online multiplayer may introduce a separate `networking.md` when that work enters scope. Shared domain concepts should be defined once in `domain-model.md` rather than duplicated inside subsystem documents. Player-controller contracts should initially be documented with the orchestrator, while engine configuration, authoritative state, ruleset configuration, player/public views, and engine event contracts should initially be documented with the engine.

### 1.3.1 Documentation authority

The documents follow this authority model:

1. **`requirements.md` defines product truth.** A lower-level document must not silently change a confirmed rule, scoring rule, product behavior, or architectural boundary defined here.
2. **`domain-model.md` defines shared implementation-independent domain contracts.** It translates stable cross-module concepts from the requirements into shared TypeScript-oriented data types without owning authoritative rule algorithms.
3. **Subsystem documents define subsystem-owned implementation contracts.** They may add internal types, APIs, algorithms, state models, workflows, and public contracts needed to satisfy this document and the shared domain model.
4. If implementation work reveals that a confirmed product requirement must change, **update `requirements.md` first**, then update `domain-model.md` when shared types are affected, then update the affected subsystem documents.
5. Details should live in their owning document rather than being duplicated. A public subsystem contract does not automatically become a shared domain model merely because another module consumes it.

### 1.3.2 High-level module boundaries

The v1 architecture is organized around the following major responsibilities:

- **Shared Domain Model:** defines the common application-wide vocabulary and simple shared data concepts, such as `Card`, `Rank`, `Suit`, `PlayerId`, `GameMode`, `Combination`, and `Move`. It contains no authoritative game algorithms and depends on no application subsystem.
- **Game Engine:** owns authoritative game truth, internal runtime state, rule validation, state transitions, scoring, legal-move generation, information-safe state views, and factual engine event contracts. It does not drive players, render UI, persist data, or choose AI moves.
- **Game Orchestrator:** drives game execution by coordinating player controllers and submitting their proposed actions to the engine. It does not reimplement game rules.
- **Player Controllers:** provide player intent from a human, AI, or future network source. Controllers cannot mutate authoritative game state directly.
- **AI System:** chooses among permitted actions using only the information available to that bot. It does not determine authoritative legality.
- **UI / Application Layer:** owns application navigation and screens, renders player-facing state, gathers human input, and presents results/settings/statistics. It does not own authoritative game rules or scoring.
- **Game Persistence:** stores and restores durable data such as resumable games, settings, and statistics. The engine must not depend on `localStorage` or another persistence implementation.
- **Event & Logging System:** retains, formats, and exposes structured gameplay events for UI history, debugging, testing, and simulation without changing game state. The authoritative factual event contracts themselves are produced by the engine.
- **Testing & Simulation:** exercises the same production engine and orchestrator headlessly. Four AI-controlled players must be able to complete games and sessions without React or another UI being present.

A central architectural requirement is that the **Game Engine remains independently executable and testable**. A headless setup consisting of the shared domain model, engine, orchestrator, four AI controllers, and event/logging consumers must be capable of running a complete game/session without UI or persistence dependencies.

## 1.4 Domain Terminology

This section is the **canonical glossary for shared game/domain terms** used across this document and all subsystem documents. Subsystem documents should reference these meanings rather than redefine them. Technical terms that are specific to one module may be defined in that module's own document.

| Term | Canonical meaning |
|---|---|
| **Session** | A complete match consisting of exactly **5 rounds** under one selected game mode. Session scores accumulate across those rounds and determine the overall session winner. |
| **Round** | One deal of the 52-card deck. Each player begins with 13 cards, and play continues until the selected game mode's round-ending condition is met. |
| **Turn** | One active player's opportunity to submit a move during normal gameplay. |
| **Trick** | A sequence beginning with a lead and continuing while active players either beat the current combination or pass. The trick ends when all other eligible active players have passed and control returns to the last player who successfully played, subject to finished-player handling defined by the game mode. |
| **Move** | A player's submitted gameplay action. A move is either a **Play** or a **Pass**. |
| **Play** | A move that submits one valid card combination from the player's hand. |
| **Pass** | A move in which the player declines to play cards for the current turn. Passing does not remove the player from the round. |
| **Combination / Hand Type** | A valid playable grouping of cards: Single, Pair, Triple, Straight, Flush, Full House, Four-of-a-Kind, or Straight Flush. In rules text, **combination** is preferred when referring to cards being played so it is not confused with a player's full hand. |
| **Player Hand / Hand** | The cards currently held by a player. When ambiguity with a playable combination is possible, use **player hand** explicitly. |
| **Lead / Free Lead** | The first play of a new trick, where the leader may choose any valid combination unless another rule imposes an additional restriction. |
| **Opening Move** | The first play of a round. It is a special lead that must contain **3♣**. |
| **Current Trick / Current Combination** | The most recent successfully played combination that the next play must legally beat. |
| **Active Player** | A player who still has cards and remains in the round's turn rotation. |
| **Finish / Go Out** | To legally play the last card(s) in a player's hand, leaving that player with zero cards. |
| **Finish Order** | In Basic Mode, the ordered record of players as they go out; the final remaining player is assigned 4th place. |
| **Round Winner** | The player recognized as the winner of a round according to the selected game mode. |
| **Session Winner** | The player with the highest final session total after five rounds and application of the defined tiebreakers. |
| **Bomb** | A **Competitive Mode scoring term**, not a separate move type or universal ability. A bomb-qualifying condition is based on a 2, Four-of-a-Kind, or Straight Flush as specified by the Competitive scoring rules. |
| **Unused Bomb** | A boolean Competitive Mode penalty condition triggered when a losing player's final hand still contains at least one qualifying bomb condition. Multiple qualifying bombs do not stack with each other. |
| **Winner Final Play** | The winner's last played combination in Competitive Mode. It triggers the winner-final-play multiplier when it satisfies one of the qualifying conditions defined in §2.6.2. |
| **Public Information** | Game information every player is entitled to know, such as publicly played cards, current trick, scores, and opponent card counts where applicable. |
| **Private Information** | Game information restricted to a particular player or authorized component, primarily the unrevealed cards in a player's hand. |
| **Game Mode** | The rule configuration governing round-ending and scoring behavior. Phase 1 implements **Basic Mode** only. **Competitive Mode** is a deferred approved design retained for future consideration. |
| **Ruleset** | The configured set of shared Pusoy Dos rule values and comparison behavior used by the authoritative engine. |

When a later section needs to specify the detailed behavior of one of these terms, it should define the **rule or algorithm**, not introduce a competing definition.

------------------------------------------------------------------------

# 1.5 Committed Phase 1 Roadmap

A **milestone** must produce a concrete, testable technical output. A **phase** must end with an integrated working version of the product. M1–M4 describe the completed Phase 1 baseline; the committed Phase 2 expansion is in §1.6.

## M1 — Basic Engine Core

**Technical output:** a tested authoritative Basic Mode engine covering cards, combinations, legal moves, turn/trick flow, finished-player continuation, Basic scoring, five-Round Sessions, safe views, events, and invariants.

## M2 — Baseline AI + Headless Game

**Technical output:** the production Engine and Orchestrator can complete a five-Round Basic Session autonomously with four deterministic Baseline controllers. The Baseline bot uses a deterministic hybrid policy: Engine-authorized candidates, strategic PASS when responding, exact memoized remaining-hand decomposition as the primary hand-structure signal, lightweight tactical/context evaluation, and canonical deterministic tie-breaking. It does not require deep search, difficulty profiles, personalities, Monte Carlo, or sophisticated opponent modeling.

## M3 — Headless Simulator + Reliability

**Technical output:** deterministic batch simulation of real production Sessions with reproducible seeds, invariant checking, structured diagnostic traces, failed-seed replay, termination/stuck detection, regression-fixture capture, and measured engineering performance. A failing deal must be treated as a diagnosable software/controller defect until shown otherwise, not silently skipped as an "unplayable" seed.

## M4 — Minimal Playable UI

**Technical output:** a landscape-first React/Vite UI integrated with the same Engine/Orchestrator used headlessly. A human can complete a five-Round Basic Session against three Baseline bots on supported desktop/laptop/tablet/phone landscape viewports, including non-fullscreen browser windows, with ratio-preserving cards and bounded readable typography/control sizing. Portrait/undersized gameplay fails gracefully with rotate/resize guidance.

### Phase 1 working product

At Phase 1 completion, a human can play a complete five-Round Basic Pusoy Dos Session in the browser against three Baseline bots. The initial version does not persist an unfinished Session across refresh/close. Leaving an active Session must warn that progress will not be saved where browser capabilities allow; in-app leave actions must provide an explicit confirmation.

### Post-Phase-1 planning rule

After the working UI exists, the product must be played and evaluated before a new committed phase or milestone roadmap is defined. Existing deferred designs may inform that decision, but they do not create a delivery promise.

# 1.6 Committed Phase 2 Roadmap

Phase 1 is the completed production baseline. Phase 2 commits to M5–M8 only, as described in [phase-2-expansion-plan.md](phase-2-expansion-plan.md). That plan records intent; this document remains product authority. Detailed task plans sequence implementation without changing canonical rules.

| Milestone | Required technical output | Task plan |
|---|---|---|
| M5 — Portrait & Mobile Experience | Full five-Round Basic gameplay in supported portrait phone/tablet layouts, retaining supported landscape behavior | [M5 breakdown](m5-portrait-mobile-task-breakdown.md) |
| M6 — Tutorial Framework & Scripted Scenario Infrastructure | Deterministic scenario execution through production Engine/Orchestrator/controller boundaries, proved by a representative scenario | [M6 breakdown](m6-tutorial-framework-task-breakdown.md) |
| M7 — Scripted Pusoy Dos Tutorial & Rules Reference | Complete progressively less-guided scripted tutorial and comprehensive in-app How to Play | [M7 breakdown](m7-tutorial-rules-task-breakdown.md) |
| M8 — Player Experience, Accessibility & Phase 2 Acceptance | Integrated responsive/input/accessibility verification, human acceptance, and full Phase 1 regression evidence | [M8 breakdown](m8-phase2-acceptance-task-breakdown.md) |

Dependency order: completed Phase 1 → M5 → M6 → M7 → M8. Early M6 design may overlap M5 without conflicting contract/file changes; tutorial presentation must use the accepted M5 responsive foundation. M8 does not postpone known M5–M7 correctness or accessibility work.

After Phase 2 is completed and evaluated, select the next committed phase. No Phase 3 roadmap is implied.

# 2. Game Rules Specification

These are the **confirmed house rules** for this implementation.

> Rule values should be represented through a configurable
> `RulesetConfig`, even though v1 has one fixed house ruleset. This
> keeps the engine data-driven and makes future variants easier to add.

## 2.1 Setup

-   Use a standard **52-card deck** with no jokers.
-   There are exactly **4 players**:
    -   1 human player
    -   3 AI players
-   There is no 2-player or 3-player mode in v1.
-   Session and round structure follow the canonical definitions in §1.4.
-   At the start of each round:
    -   The deck is freshly shuffled.
    -   13 cards are dealt to each player.
-   Turn order is **clockwise**.
-   The player holding **3♣** starts the round.
-   The opening move must contain **3♣**.
-   The opening move may be **any valid combination**, not only a
    single:
    -   single containing 3♣
    -   pair containing 3♣
    -   triple containing 3♣
    -   valid five-card combination containing 3♣

## 2.2 Card Ranking

### Rank order

Low → high:

`3, 4, 5, 6, 7, 8, 9, 10, J, Q, K, A, 2`

The **2** is the highest-ranked card.

### Suit order

Low → high:

`Clubs < Spades < Hearts < Diamonds`

Therefore:

-   3♣ is the lowest card.
-   2♦ is the highest card.

Suit ranking is used to break ties where the rules below specify it.

------------------------------------------------------------------------

## 2.3 Valid Combinations

A move must be a valid combination.

When responding to an existing trick:

-   A 1-card trick may only be answered by a strictly stronger Single.
-   A 2-card trick may only be answered by a strictly stronger Pair.
-   A 3-card trick may only be answered by a strictly stronger Triple.
-   A 5-card trick may be answered by any strictly stronger five-card
    combination according to the five-card hierarchy and comparison rules.

For five-card tricks, the response may change combination type. Once a
player successfully plays a different five-card combination type, that new
combination becomes the current trick. Subsequent players must then beat
that new current trick.

  -----------------------------------------------------------------------
  Combination                         Definition
  ----------------------------------- -----------------------------------
  Single                              Exactly 1 card

  Pair                                Exactly 2 cards of the same rank

  Triple                              Exactly 3 cards of the same rank

  Straight                            Exactly 5 cards forming a valid
                                      house-rule sequence according to
                                      §2.4, regardless of suits

  Flush                               Exactly 5 cards of the same suit

  Full House                          Exactly 3 cards of one rank +
                                      exactly 2 cards of another rank

  Four-of-a-Kind                      Exactly 4 cards of the same rank +
                                      1 kicker

  Straight Flush                      Exactly 5 cards of the same suit forming
                                      a valid house-rule sequence according
                                      to §2.4
  -----------------------------------------------------------------------

### Five-card combination ranking

Low → high:

`Straight < Flush < Full House < Four-of-a-Kind < Straight Flush`

A five-card card set may satisfy the defining properties of more than one combination type. When this occurs, its **final canonical classification is the highest-ranking applicable combination** under the hierarchy above.

For example, a same-suit valid house-rule sequence satisfies both Straight and Flush properties and therefore qualifies as a **Straight Flush**, the higher applicable category. Authoritative detection must evaluate applicable five-card definitions and return the strongest valid classification rather than rejecting a lower-type property merely because a stronger overlap exists.

Combination types cannot be mixed for 1-, 2-, or 3-card tricks.

Five-card tricks are different: the combination type may change only in the
direction of strictly greater strength.

Examples:

-   A Pair cannot be beaten by a Triple.
-   A Pair cannot be beaten by a five-card hand.
-   A Straight can be beaten by a stronger Straight, any Flush, any Full
    House, any Four-of-a-Kind, or any Straight Flush.
-   A Flush can be beaten by a stronger Flush, any Full House, any
    Four-of-a-Kind, or any Straight Flush.
-   A Full House can be beaten by a stronger Full House, any
    Four-of-a-Kind, or any Straight Flush.
-   A Four-of-a-Kind can be beaten by a stronger Four-of-a-Kind or any
    Straight Flush.
-   A Straight Flush can only be beaten by a strictly stronger Straight
    Flush.

Therefore, the five-card hierarchy is a strict ordering across all valid
five-card combinations, not a same-type-only restriction.

If no legal play can beat the current trick, the player may pass.

### 2.3.1 Single, Pair, and Triple comparison

For 1-, 2-, and 3-card combinations, the response must use the same combination type and must be strictly stronger.

- **Single:** compare Rank first. If the Ranks are equal, compare Suit using `Clubs < Spades < Hearts < Diamonds`.
- **Pair:** compare the Pair Rank first. If both Pairs have the same Rank, compare the **highest-Suit card contained in each Pair** using `Clubs < Spades < Hearts < Diamonds`. Example: `7♠ 7♦` beats `7♣ 7♥` because the highest-Suit card is `7♦` versus `7♥`.
- **Triple:** compare the Triple Rank only. Two distinct equal-Rank Triples cannot occur in normal play from one standard 52-card deck because only four cards of each Rank exist.

Physical deck uniqueness is part of the rules model. Tests and examples must not fabricate two distinct playable combinations that would require the same physical card to exist twice.

------------------------------------------------------------------------

## 2.4 Five-Card Combination Comparison Rules

Five-card comparison occurs in two stages:

1.  Compare final canonical combination type using the hierarchy in §2.3.
2.  If both combinations have the same final type, use that type's specific comparison rule below.

A stronger five-card category **strictly beats every weaker five-card category regardless of the cards' internal ranks, suits, or apparent strength**.

For same-type comparisons, apply only that category's documented comparison definition. Some apparent equality cases are physically impossible between two distinct playable combinations from one standard 52-card deck because cards are unique. Examples and tests must respect this constraint rather than duplicating physical cards merely to manufacture a tie.

### 2.4.1 Straight

A five-card set satisfies the **Straight property** when its ranks form one of the valid house-rule sequences below, regardless of suits. A same-suit valid sequence therefore satisfies both Straight and Flush properties; its final canonical classification is Straight Flush because Straight Flush is the highest-ranking applicable category.

A Straight is ranked by the **last/highest rank in its sequence**.

The special low straights are:

  Straight        Effective highest rank Strength
  ------------- ------------------------ ----------------
  `A-2-3-4-5`                          5 Weakest
  `2-3-4-5-6`                          6 Second weakest

Normal straights continue from there:

`3-4-5-6-7`, `4-5-6-7-8`, ..., `10-J-Q-K-A`, `J-Q-K-A-2`

Thus:

`A-2-3-4-5 < 2-3-4-5-6 < 3-4-5-6-7 < ...`

For example:

-   `A-2-3-4-5` is weaker than `3-4-5-6-7`.
-   `3-4-5-6-7` is weaker than `6-7-8-9-10`.

If two straights have the same highest rank, compare the **suit of the
highest card** using:

`Clubs < Spades < Hearts < Diamonds`

Example:

-   `3♦ 4♣ 5♣ 6♣ 7♣` is weaker than
-   `3♣ 4♥ 5♠ 6♦ 7♥`

because both are ordinary 7-high Straights and `7♥ > 7♣`.

For the special straights, the effective high card is:

-   `A-2-3-4-5` → the 5 is the high card, so its suit is the tiebreaker.
-   `2-3-4-5-6` → the 6 is the high card, so its suit is the tiebreaker.

#### Straight validity

Valid special straights:

-   `A-2-3-4-5`
-   `2-3-4-5-6`

Invalid wrap-around combinations:

-   `K-A-2-3-4`
-   `Q-K-A-2-3`

Only A and/or 2 may be interpreted as low cards, and only for the two
special straights above.

------------------------------------------------------------------------

### 2.4.2 Flush

A Flush is exactly five cards of one suit whose ranks **do not** form a valid house-rule Straight sequence. If the same-suit cards form a valid house-rule sequence, the combination is a Straight Flush instead.

A Flush is compared by **suit first**.

Suit order:

`Clubs < Spades < Hearts < Diamonds`

Therefore, any valid Diamonds flush beats any valid Hearts flush,
regardless of the individual card ranks.

If two flushes have the same suit, compare their cards from **highest
rank downward** until a difference is found.

Example:

-   A Clubs flush beats another Clubs flush if its highest differing
    card is higher.
-   Any Spades flush beats any Clubs flush.

------------------------------------------------------------------------

### 2.4.3 Full House

A full house is ranked by the **rank of its triple only**.

The pair does not affect the comparison.

Two distinct Full Houses with the same triple Rank cannot occur in normal play from one standard 52-card deck because each Full House already consumes three of the four cards of that Rank.

Example:

-   `77733` beats `555KK`
-   `KKK22` beats `QQQAA`

because 7 \> 5 and K \> Q.

------------------------------------------------------------------------

### 2.4.4 Four-of-a-Kind

A four-of-a-kind is ranked by the **rank of the four matching cards**.

The kicker does not affect the comparison.

Two distinct Four-of-a-Kind combinations with the same quad Rank cannot occur in normal play because there is only one four-card set of that Rank in the deck.

Example:

-   `7777 + X` beats `6666 + Y`

regardless of the kicker.

------------------------------------------------------------------------

### 2.4.5 Straight Flush

A Straight Flush is exactly five cards of one suit forming a valid house-rule Straight sequence. It follows the **same rank-first comparison logic as a Straight**.

1.  Compare the effective highest rank of the straight.
2.  If the highest rank is the same, compare the suit of the highest
    card.

Examples:

-   `3♠ 4♠ 5♠ 6♠ 7♠` beats `3♣ 4♣ 5♣ 6♣ 7♣`.
-   `6♣ 7♣ 8♣ 9♣ 10♣` beats `3♦ 4♦ 5♦ 6♦ 7♦`, because 10 \> 7.
-   If both are 10-high, the suit of the 10 determines the winner.

A straight flush is still stronger than every other five-card
combination because of the five-card type ranking in §2.3.

------------------------------------------------------------------------

## 2.5 General Trick and Turn Flow

1.  The player holding **3♣** makes the opening move and must include
    3♣.
2.  Play proceeds clockwise.
3.  On a normal turn, a player may:
    -   play a valid combination that is legal against and strictly beats
        the current trick, or
    -   pass.
4.  The engine is authoritative for move legality.
5.  When all other **active** players pass after the last player who
    played a combination:
    -   the last player to play becomes the leader of the next trick;
    -   they may play any valid combination.
6.  Passing does not remove a player from the round.
7.  A player who empties their hand is **removed from the active turn
    rotation** for the remainder of the round.
8.  `currentTurn`, pass counting, and turn advancement must always skip
    players who have already emptied their hands.
9.  Round-ending behavior after a player empties their hand depends on
    the selected game mode.

### 2.5.1 Basic Mode continuation after a player goes out

When a player empties their hand in Basic Mode:

1.  Record that player in `finishOrder`.
2.  Remove that player from the active rotation.
3.  Examine the final combination they played.
4.  Each remaining active player, in turn order starting from the next
    active player after the finisher, takes an **explicit Turn of
    their own** in response to that final combination:
    -   If that player has a legal combination that beats it, they
        may play it — normal trick flow continues from that Play, and
        pass count resets.
    -   If they have no such legal combination, or simply choose not
        to play a beating combination they do have (a strategic Pass
        remains available, consistent with this section's general
        Pass rules), they explicitly Pass on their own Turn. The
        Engine never determines this on a player's behalf, and never
        skips a remaining active player's own Turn.
5.  Once every remaining active player has, in turn, either played a
    beating combination or explicitly passed without one, the next
    active player after the finisher becomes the new leader and may
    play any valid combination; pass count resets.
6.  Continue until only one active player remains.
7.  That final remaining player is recorded as **4th place** and the
    round ends.

This means a player going out does **not** automatically end the current
trick in Basic Mode, and no remaining active player's own Turn is ever
silently skipped or Engine-computed on their behalf — each one either
plays a beating combination or produces a genuine Pass of their own
(M4-T12.5).

### 2.5.2 (retired — promoted into §2.5.1)

**Status:** Implemented and verified (M4-T12.5). This subsection previously recorded an approved-but-not-yet-implemented replacement for §2.5.1's earlier silent-determination behavior (the Engine computing, in one internal step, whether any remaining active player could beat the finisher's own final combination, and reassigning the free lead without any of those players ever taking a visible Turn). That replacement has since been implemented in `resolveBasicContinuation.ts` (each remaining active player now takes a real Turn and, where applicable, produces a genuine `PLAYER_PASSED` event) and its text has been promoted into §2.5.1 above, which is now the sole authoritative rule for this behavior. This subsection is kept only as a version-history marker; it carries no separate rule of its own.

------------------------------------------------------------------------

# 2.6 Game Modes

The two game modes differ in round-ending behavior and scoring.

## 2.6.1 Basic Mode

### Round ending

Play continues until only one player remains with cards.

The first three players to empty their hands receive 1st, 2nd, and 3rd
place respectively.

The final player who never emptied their hand is automatically assigned
4th place when the round ends.

### Scoring

  Placement     Points
  ----------- --------
  1st               +5
  2nd               +3
  3rd               +2
  4th               +0

The session score is the sum of the 5 round scores.

Maximum possible score:

`5 × 5 = 25`

Minimum possible score:

`0`

------------------------------------------------------------------------

## 2.6.2 Competitive Mode — Deferred Approved Design

### Round ending

The round ends **immediately when the first player empties their hand**.

The remaining three players do not continue playing.

The winner is the player who emptied their hand first.

For record-keeping, the remaining players may be ordered by their
remaining card counts, but this is **not treated as an official
placement** for scoring or session tiebreaking.

### Base penalty

Determine the number of cards remaining in each losing player's hand.

    Cards remaining   Base penalty
  ----------------- --------------
               0--9    `cards × 1`
             10--13    `cards × 2`

This is a mutually exclusive rule: a player with 10--13 cards has
**all** remaining cards multiplied by 2.

### Unused bomb doubling

A losing player receives a ×2 multiplier if their final hand contains at
least one **unused bomb**.

For this implementation, an unused bomb means the final hand still
contains at least one qualifying bomb condition:

-   a 2;
-   all four cards of the same rank, forming the four-of-a-kind portion
    of a valid four-of-a-kind; or
-   a valid straight flush contained in the remaining hand.

The unused-bomb condition is **boolean**:

> Having multiple qualifying bombs does not produce multiple doublings.

For example, if the final hand contains a 2 and a straight flush, the
player still receives only **one ×2 unused-bomb multiplier**.

A straight flush containing a 2 is still one qualifying unused bomb
condition, not two separate bomb doublings.

### Winner-final-play doubling

After the winner empties their hand, inspect the **final hand they
played**.

The winner-final-play condition is true if that final hand contains:

-   a 2;
-   a four-of-a-kind; or
-   a straight flush.

For the 2 condition, **any valid final combination containing a 2
qualifies**, including a flush containing a 2.

The condition is boolean: multiple qualifying properties in the same
final play do not create multiple winner-final-play doublings.

### Losing-player score

For each loser:

`final penalty = base penalty × unused-bomb multiplier × winner-final-play multiplier`

where each multiplier is either:

-   `1` if the condition is false;
-   `2` if the condition is true.

The two conditions are independent and may stack.

Therefore:

-   neither condition → ×1
-   unused bomb only → ×2
-   winner final play qualifies only → ×2
-   both → ×4

### Winner score

The winner receives the negative sum of all losing-player scores.

If the losers pay:

`−6, −36, −32`

the winner receives:

`+74`

### Worked example

North wins by playing a **2** as their final card.

-   East has 3 cards remaining and no unused bomb.
-   West has 9 cards remaining and an unused straight flush.
-   South has 8 cards remaining and an unused 2.

Winner's final play qualifies for winner-final-play doubling.

Therefore:

-   East: `3 × 1 × 1 × 2 = 6` → **−6**
-   West: `9 × 1 × 2 × 2 = 36` → **−36**
-   South: `8 × 1 × 2 × 2 = 32` → **−32**
-   North: `6 + 36 + 32 = +74`

------------------------------------------------------------------------

## 2.6.3 Session Winner and Tiebreakers

The session winner is the player with the **highest session total** after all 5 rounds. Tiebreak behavior is mode-specific because Basic Mode has official 1st--4th placements while Competitive Mode deliberately does not assign official loser placements.

### Basic Mode tiebreak order

If Basic Mode players are tied on Session total, resolve ties in this order:

1. **Most Round wins** --- number of official 1st-place finishes.
2. **Best average placement** across the 5 Rounds; lower average is better.
3. **Highest single best-Round score**.
4. If still tied, declare a **genuine tie**.

### Competitive Mode tiebreak order — Deferred

If Competitive Mode players are tied on Session total, resolve ties in this order:

1. **Most Round wins** --- number of Rounds won.
2. **Highest single best-Round score**.
3. If still tied, declare a **genuine tie**.

Competitive Mode **skips average placement entirely**. Only the Round winner has an official placement; the other three players are losers for scoring purposes and are not assigned official 2nd/3rd/4th placements. Remaining-card counts may be displayed as informational data but must not silently become official placements or a placement-based tiebreak.

------------------------------------------------------------------------

## 2.6.4 Phase 1 Session Flow

1. Start a new **Basic Mode** Session.
2. Use one human player and three deterministic Baseline bots.
3. Play exactly 5 Rounds.
4. Before each Round:
    - shuffle the full deck using the Engine's deterministic RNG path;
    - deal 13 cards to each player;
    - identify the player holding 3♣;
    - that player opens with a valid combination containing 3♣.
5. After each Round, calculate the official Basic Round result and update cumulative Session totals.
6. When the 3rd-place player finishes, the Round is complete. Before the result overlay appears, briefly reveal the 4th-place player's remaining hand on the table, sorted by Rank. After that presentation step, enter the **Round Result** checkpoint. The result appears as a modal/overlay over the dimmed completed table, initially ordered by the standings before the Round score is applied; Round points then appear, totals update, and rows rearrange by the new cumulative total.
7. In normal human gameplay, do **not** start the next Round until the user explicitly chooses **Next Round**. After Round 5, this explicit-action requirement does not apply: once the Round Result overlay's own scoring animation settles, the UI automatically transitions to the Session Summary after a short presentational delay, with no click required (Follow-up, M4-T13 UI refinement — a presentation-layer screen transition only; it starts no new Round and calls no Orchestrator continuation, so the explicit-action requirement above for points 2-5 is unaffected).
8. Headless execution/simulation may pass through the same checkpoint and continue immediately without an artificial wait.
9. After Round 5, show the Session Summary and apply Basic Mode Session tiebreakers if necessary.
10. Phase 1 does not select AI difficulty, persist unfinished Sessions, or update persistent player statistics.

Competitive Mode uses the deferred rules defined elsewhere in §2.6 when/if that feature enters committed scope; it is not selectable in Phase 1.

------------------------------------------------------------------------

# 2.7 Hand-Type Tracking — Deferred

Persistent/per-session player statistics are not required in Phase 1.

If statistics enter a future committed scope, combination counts may include Single, Pair, Triple, Straight, Flush, Full House, Four-of-a-Kind, and Straight Flush, with the two special low Straights counted under Straight. The exact persistence/statistics schema must be designed with that future work rather than implemented implicitly during M3 or M4.

------------------------------------------------------------------------

# 3. Functional Requirements

## 3.1 Phase 1 — Committed MUST HAVE

- [ ] One human and three deterministic Baseline bots on a fixed four-player table.
- [ ] Basic Mode only, using the canonical rules in §2.
- [ ] Exactly five Rounds per Session with +5/+3/+2/+0 Round scoring and Basic Session tiebreaks.
- [ ] Pure TypeScript authoritative Engine with no React dependency.
- [ ] Deterministic injected Engine randomness for shuffle/deal and reproducible headless execution.
- [ ] Engine-generated legal Moves and authoritative Move validation.
- [ ] Deterministic Baseline bot using Engine-authorized actions, strategic PASS evaluation, exact memoized hand decomposition, lightweight contextual evaluation, and canonical tie-breaking; no deep search/difficulty/personality requirement.
- [ ] Headless execution through the production Orchestrator/controllers.
- [ ] Reusable deterministic batch simulator with invariants and failure reproduction.
- [ ] Minimal React/Vite playable UI described by `ui-ux.md`.
- [ ] Human card selection, bounded drag/reorder manual hand arrangement, Play, voluntary Pass, Sort by Rank, Sort by Suit, and explicit feedback when no legal Play exists. Selection and visual hand order are independent: rearranging or sorting must not silently deselect selected cards.
- [ ] Current trick, turn, opponent face-down hands/card counts, PASS/DONE state, current running Session scores, a Discard Pile view containing every card already played this Round, and an Event Log containing chronological factual public events are accessible through the UI.
- [ ] End-of-Round presentation briefly reveals the 4th-place remaining hand after 3rd place finishes, then shows a dimmed-table Round Result overlay with previous standings, animated Round-score application, updated totals, and reordering by cumulative score; explicit Next Round for Rounds 1-4, or an automatic transition to the Session Summary after Round 5 once the scoring animation settles (Follow-up, M4-T13 UI refinement).
- [ ] Session Summary after Round 5 ordered by official final Session result, with final scores/tiebreak information and distinct gold/silver/bronze treatment for 1st/2nd/3rd plus Play Again and Home actions. Presents as a popup replacing the Round Result overlay in place, with the human player's own seat highlighted and the full Session Event Log embedded alongside the actions (Follow-up, M4-T13 UI refinement).
- [ ] Four-color suits by default: Hearts red, Diamonds orange, Clubs blue, Spades black; no Phase 1 toggle.
- [ ] Landscape-first responsive usability on documented desktop/laptop/tablet/phone landscape viewports, including non-fullscreen windows; cards preserve ratio, text/controls remain usable, and portrait/undersized states show rotate/resize guidance.
- [ ] No save/Resume in Phase 1. In-app leaving an unfinished Session warns that progress will be lost; browser close/refresh warning is used where supported.

## 3.2 Phase 1 — SHOULD HAVE

- [ ] Clear validation explanations for invalid/non-beating selections.
- [ ] Simple green Modern Casino Table visual foundation using reusable design tokens/components.
- [ ] Information overlays pause game progression while open.
- [ ] Deterministic simulation diagnostics include structured failure traces and failed-seed replay sufficient to identify the failing transition and create regression coverage.

A SHOULD item may be deferred within Phase 1 only if the Phase 1 working-product acceptance criteria remain satisfied and the deferral is explicitly recorded; it must not be silently dropped.

## 3.3 Explicitly Deferred — Approved Design, No Timeline

The following are intentionally not required for Phase 1 even where detailed design exists elsewhere:

- Competitive Mode.
- persistence/Resume and persistent statistics.
- Settings and auto-pass.
- Easy/Normal/Hard difficulty system and deeper Optimizer/search behavior.
- AI personalities, Mystery Bots, and Surprise Me.
- two-color/four-color suit preference toggle.
- richer animations, sounds, branding, progression, achievements, and other polish.

## 3.4 Possible Future Directions — Not Committed

Online multiplayer, backend/server infrastructure, additional modes/modifiers, PWA/product packaging, and other expansions are possibilities only. They have no committed phase, milestone, or timeline.

## 3.5 Explicitly Rejected / Guardrails

- No betting or real-money mechanics.
- No hidden-information cheating by AI.
- No duplicate rules authority in React or AI.
- No "Suggest a Move" feature in Phase 1.
- No speculative framework whose only purpose is an uncommitted future feature.

## 3.6 Phase 2 — Committed Scope and Acceptance

Phase 2 expands the existing offline Basic product; it does not rewrite Engine, Orchestrator, Baseline AI, or simulation. All §2 house rules and the five-Round normal Basic Session remain unchanged.

### Required product behavior

- Complete Basic Sessions on approved portrait phone/tablet targets and all existing supported landscape/desktop targets.
- Intentional portrait composition with ratio-preserving cards; common baseline for unselected human cards, selected cards raised, reliable selection, bounded reorder preserving selection, Sort Rank/Suit, Play/Pass and Engine-derived feedback.
- Accessible current Turn, current combination or Free Lead and player attribution, opponent counts, PASS/DONE, Round/Session context, scores, Event Log, Discard Pile, Round Result, and Session Summary.
- Supported orientation/viewport transitions preserve execution, selection, and display order. Below-minimum layouts prevent unsafe interaction and recover coherently.
- A deterministic hands-on scripted tutorial comprising one complete five-Round Basic Session, with Engine-authoritative validation, objectives, corrective feedback/retry, open-practice segments, and an unrestricted final Round. Winning is not required. Multiple Engine-valid solutions satisfying an objective are accepted unless the lesson explicitly requires a specific action.
- Main menu **Play** opens a choice window with **Tutorial** and **Basic Game**. Opening or dismissing this window starts no gameplay; selecting Tutorial starts the guided scripted game, while selecting Basic Game starts the normal five-Round Basic Session against three Baseline bots. This M7 navigation replaces the Phase 1 immediate Start Game entry while preserving production startup/gameplay semantics.
- A directly accessible **How to Play** entry on the main menu opens a comprehensive in-app reference, independently of Play or starting a game. Cover all current Basic house rules, comparisons, scoring/tiebreaks, and app controls with clear sections and physically valid worked examples. Keep it scannable, but do not limit it to a quick-reference summary; it remains explanatory, never another rules authority.
- Responsive, input, accessibility, automated-browser, human usability, and Phase 1 regression verification.

### Approved accessibility commitment (September 29, 2026)

Keyboard/focus support and reduced-motion handling are MUST requirements for Phase 2, promoted from SHOULD in the original plan by explicit user approval. Required keyboard scope includes navigation, card selection and bounded rearrangement, sorting, Play/Pass, dialogs, results, and tutorial actions. Focus must be visible, ordered sensibly, moved into dialogs and returned appropriately; background modal controls must not be operable. Reduced-motion preference must simplify or remove meaningful movement while preserving visible results, guidance, and progression. No Settings screen or full accessibility-standard certification is implied.

Readable typography, usable controls, sufficient contrast, and status/feedback that does not rely on color alone are required. M5-T01 must freeze measurable portrait sizing, contrast, focus, keyboard interaction, and reduced-motion criteria before dependent UI implementation. Preserve the existing landscape-phone exemption from literal 14px text / 44×44px controls; it does not extend automatically to portrait. Existing full-scale landscape minima and exposed-card targeting remain in force. Exact portrait viewport/minimum values require approval in M5-T01, not invention in this roadmap.

### Tutorial and reference boundaries

Tutorial execution is guided Basic gameplay, not a new GameMode or sandbox. Tutorial run progress is application-owned and is not an authoritative Session result; normal Sessions remain exactly five Rounds. Tutorial scenarios may be deliberately arranged, but setup must preserve physical card uniqueness and valid Engine state, and all gameplay transitions must go through production authority. M6-T01 freezes the concrete setup contract and obtains approval for any substantial public-contract change. No hidden-opponent-hand presentation is authorized by default.

Teach shedding, turns, 3♣ opening, Singles/Pairs/Triples, all five-card categories and hierarchy, relevant same-type comparisons, response size/type, voluntary Pass and no-legal-Play, Trick reset/Free Lead, finishing, Basic Round points, and Session context. The reference must also explain Session tiebreaks and canonical house-rule comparison details. Content must respect §2, including special Straights, suit-first Flush comparison, rank-first Straight Flush comparison, and explicit active-player response Turns after a finisher.

Tutorial replay/restart and understandable current-run progress remain SHOULD items; the M7 plan includes them as the selected delivery approach. Core mistake retry/continue is mandatory. Any later deferral must be explicitly approved and cannot prevent required tutorial completion. Basic non-essential sound, minor visual polish, and small presentation preferences remain optional and are not task-plan completion gates.

### Exclusions

No Competitive Mode, difficulty levels, advanced AI/search, personalities, Mystery Bots/Surprise Me, persistence/Resume, persistent statistics, progression/unlocks, accounts, networking, sandbox, separate tutorial rules engine, auto-pass, major art/audio redesign, or speculative future-phase framework. Optional polish requires a bounded task after core stability; it cannot introduce those systems.

### Phase 2 Definition of Done

- [ ] M5–M8 milestone Definitions of Done are satisfied.
- [ ] Five-Round Basic Sessions complete on approved portrait phone/tablet and existing supported landscape targets.
- [ ] Gameplay-critical information, selection/elevation, rearrangement, sorting, Play/Pass, overlays, and results remain usable.
- [ ] Supported orientation changes preserve coherent state; below-minimum behavior is graceful and recoverable.
- [ ] A new player can enter and complete the scripted tutorial, retry mistakes, and apply rules with materially less final guidance.
- [ ] Scenario setup and every accepted Move preserve production Engine authority; illegal scripts fail diagnostically rather than bypassing rules.
- [ ] Main menu Play opens the Tutorial / Basic Game choice; only selecting an option starts the corresponding execution.
- [ ] Comprehensive How to Play is directly accessible from the main menu, covers current Basic rules and controls, and is synchronized with §2.
- [ ] Keyboard/focus, reduced motion, contrast, non-color cues, and approved sizing criteria pass the defined checks.
- [ ] High-value portrait/tutorial flows have deterministic automated browser coverage.
- [ ] Real humans have performed the documented functional/usability checks; no blocking responsive, comprehension, or progression issue remains.
- [ ] Phase 1 automated regressions and deterministic headless reliability remain green.
- [ ] No unresolved blocking correctness or architecture defect, or dependency on excluded features, remains.

# 4. Non-Functional Requirements

## 4.1 Offline-first

The application must be playable without an active internet connection
after the application has been initially loaded and its required assets
have been cached.

No gameplay operation should require a network request.

## 4.2 Performance and POC Optimization Priority

For the initial POC, engineering tradeoffs follow this order:

1. **Accuracy and reliability** --- authoritative rules, legal-Move generation, scoring, state transitions, and AI analysis must be correct and reproducible.
2. **Speed** --- optimize computation after correctness is established and measured. A slower device may legitimately take longer, provided computation remains bounded and the application stays responsive.
3. **Memory usage** --- memoization/caching may use additional memory in the POC when it materially improves correctness, simplicity, or speed. Memory reduction and cache policies may be optimized later.

Additional requirements:

- Card selection should feel immediate.
- Game-state transitions should remain responsive.
- AI must not intentionally perform slow computation merely to simulate thinking.
- Actual AI computation time and simulated presentation delay are separate concerns.
- Target AI presentation delay is approximately 0.3--1.5 seconds and may be tuned independently from computation.
- Headless simulation uses no artificial thinking delay.
- AI implementations must provide room for future profiling, cache optimization, and stronger algorithms without changing public game contracts.
- The AI delay must not be part of the engine's game rules.

## 4.3 Portability

The application should work on modern:

-   Chrome
-   Edge
-   Firefox
-   Safari

It should support both desktop and mobile browser layouts.

## 4.4 Maintainability

The game engine must:

-   be written in pure TypeScript;
-   have no React or DOM dependencies;
-   be independently unit-testable;
-   own all game-rule validation;
-   expose deterministic behavior when provided with deterministic
    random input.

## 4.5 Extensibility

The architecture must allow:

-   Human player → local input
-   AI player → local decision-making
-   Network player → future remote input

without changing the core rules engine.

------------------------------------------------------------------------

# 5. Recommended Tech Stack

  -----------------------------------------------------------------------
  Layer                   Choice                  Purpose
  ----------------------- ----------------------- -----------------------
  Language                TypeScript              Strong typing for
                                                  card/rule state and
                                                  shared future backend
                                                  code

  UI                      React                   Component-based
                                                  card/table interface

  Build tool              Vite                    Development server and
                                                  production build

  Testing                 Vitest                  Unit and simulation
                                                  testing

  Component testing       React Testing Library   UI behavior testing

  Styling                 CSS Modules or Tailwind UI styling

  Persistence             `localStorage`          Offline stats and
                                                  resume data

  Packaging               Static site + optional  Offline browser
                          PWA                     application

  Possible backend        TBD                     Online multiplayer is not committed

  Future shared engine    Pure TypeScript package Shared server/client
                                                  rules
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5.1 Architecture

Recommended high-level source organization:

``` text
/src
  /domain
    cards
    players
    combinations
    moves
    game

  /engine
    state
    cards
    combinations
    moves
    turn
    round
    session
    modes
    scoring
    config
    events
    views
    rng
    results
    validation

  /orchestrator
    GameRunner
    PlayerController
    HumanController
    AIController
    NetworkController (future)

  /ai
    baseline
    analysis
    evaluation
    tracing

  /ui
    pages
    components
    navigation
    game

  /persistence (deferred)
    snapshots
    statistics
    settings
    migrations

  /events-logging

  /simulation
```

The source tree is illustrative rather than a requirement to create every folder immediately.

The main dependency rule is:

``` text
requirements.md
      ↓
domain-model.md
      ↓
domain types
      ↓
engine / orchestrator / AI / UI / persistence / logging
```

`/domain` contains shared game concepts only and must not import subsystem implementations. Engine-internal state and algorithms remain under `/engine`; public contracts remain with the subsystem that owns them unless they are genuinely implementation-independent domain concepts.

### Game mode and setup-modifier extensibility

The architecture must distinguish **core card/trick rules** from **mode
behavior** and **round setup modifiers**.

The two v1 game modes are:

-   Basic
-   Competitive

Future variants may alter setup, public information, scoring, or
round-ending behavior without requiring a rewrite of card detection or
five-card comparison.

Recommended round lifecycle:

`Session → Round Setup → Deal → Setup Modifiers → Determine Starting Player → Normal Gameplay → Round End`

A future extension may use interfaces conceptually similar to:

``` ts
interface GameModeConfig {
  id: string;
  name: string;
  setupModifiers?: RoundSetupModifier[];
  scoringRules: ScoringRules;
  roundEndRules: RoundEndRules;
}

interface RoundSetupModifier {
  id: string;
  apply(state: RoundState, rng: RNG): RoundState;
}
```

The exact types may evolve during implementation. The architectural
requirement is that setup modifiers are **composable** and do not require
special-case changes throughout the combination engine.

Planned future examples include:

1.  **Reveal One**
    -   Reveal one random card from each player to all players during setup.
    -   The revealed information must be tracked explicitly in round state.

2.  **Card Exchange**
    -   Each player chooses 2 cards to give to the player on their right.
    -   This occurs during setup before normal gameplay.
    -   Exact timing, simultaneity, visibility, and AI decision rules remain
        future design decisions.

3.  **Combined variants**
    -   Reveal One + Card Exchange.
    -   Additional setup modifiers may be composed later.

These modifiers are **not part of v1 implementation**. This section defines
an extension point only.

### Architectural boundary

Core dependency boundaries:

- `/domain` must not import from any application subsystem.
- `/engine` may depend on `/domain`, but must not depend on `/ui`, `/ai`, `/persistence`, `/simulation`, React, DOM APIs, browser events, animations, or visual presentation.
- `/orchestrator` coordinates controllers and engine operations but must not duplicate engine legality, turn, or scoring rules.
- UI and AI should consume engine-provided public contracts rather than inspect or mutate engine-internal state.
- Persistence should store explicit persistence/snapshot contracts rather than force the engine's internal state representation to become a storage schema.

The UI may use engine-provided legal-move information for responsiveness, but the engine remains authoritative.

------------------------------------------------------------------------

# 5.2 Move and PlayerController Boundary

`Move` is a shared domain concept defined in `domain-model.md`. It represents player intent and does not prove legality.

The architectural flow is:

``` text
Human / AI / Future Network Controller
                ↓
              Move
                ↓
        Game Orchestrator
                ↓
          Game Engine
                ↓
     result + factual events
```

Requirements:

- Controllers propose Moves; they do not mutate authoritative state.
- The Game Orchestrator coordinates when a controller is asked to act and forwards its proposed Move to the engine.
- The Game Engine authoritatively validates the Move, applies accepted state transitions, determines resulting turn/trick state, and returns structured results.
- Human UI and AI may consume legal-move information from the engine, but neither may independently redefine legality.
- Player-controller lifecycle, asynchronous behavior, and runner flow belong to `orchestrator.md`.
- Detailed validation, legal-move generation, state transitions, views, and engine result/error contracts belong to `engine.md`.

------------------------------------------------------------------------

# 5.3 Determinism and Randomness

The Phase 1 Baseline AI is **deterministic**: given the same permitted player-facing state, same private hand, same candidate action set, and same Baseline configuration, it must choose the same Move. Reordering an otherwise identical `legalMoves` collection must not alter the selected action. Cold/warm memoization state must also not alter the decision.

The Phase 1 Baseline Bot uses no decision randomness. If controlled AI variation is introduced later, it must use an injectable/seeded RNG and should normally vary only among strategically defensible candidates rather than force irrational play.

Determinism/reproducibility is particularly important for AI unit tests, simulations, bug reproduction, debugging, and later balancing.

Authoritative engine randomness such as deck shuffling must also be injectable/seedable for deterministic tests.

------------------------------------------------------------------------

# 6. AI Opponent Design

## 6.1 Phase 1 — Baseline Bot

Phase 1 implements one deterministic Baseline strategy shared by the three bots. Its purpose is to provide rational, reproducible play for headless execution and the first playable product without paying the cost of advanced imperfect-information search.

The selected M2 algorithm is a **deterministic hybrid Move evaluator**. It:

- chooses only among Engine-authorized actions;
- treats PASS as a first-class strategic candidate whenever responding, even when legal beating Plays exist;
- forbids PASS on free lead according to Engine legality;
- immediately prefers a legal Move that empties the bot's hand;
- evaluates candidate resulting hands using **exact memoized bitmask decomposition** to estimate the minimum number of valid future Plays required to partition the remaining hand;
- combines that primary hand-structure signal with lightweight resource preservation, immediate shedding value, Trick/control context, PASS opportunity cost, and public opponent remaining-card pressure;
- uses only permitted `PlayerView`/public information;
- uses canonical deterministic tie-breaking independent of input Move ordering;
- avoids intentionally irrational Plays or Passes merely to appear "easy";
- remains explainable and instrumentable for tests/debugging.

The decomposition estimate is not a prediction of actual future Turns and must not assume opponent cooperation. It is a structural signal that may be overridden by obvious tactical context such as immediate finish or urgent opponent pressure.

A public Pass alone must never be treated as proof that another player lacked a legal response because voluntary passing is legal.

Detailed evaluator precedence/constants may be refined in M2 design, but substantial ambiguity must be recorded rather than hidden behind arbitrary weights.

## 6.2 Deferred AI Design

Deferred techniques include difficulty profiles, personalities, sophisticated opponent inference, deep search, Minimax/MaxN, hidden-hand determinization, Monte Carlo, MCTS/ISMCTS, machine learning, neural networks, advanced card counting, Competitive Mode strategy, and controlled random/personality behavior.

The AI/Controller boundary should remain replaceable so stronger future strategies do not require Engine changes.

## 6.3 Algorithm Adaptation and House-Rule Authority

External Big Two/Poker algorithms may be used as implementation references only. Canonical house rules and Engine contracts remain authoritative. External suit ordering, Straight semantics, five-card hierarchy, bomb rules, opening rules, legality assumptions, or comparison semantics must not be imported without independent verification against this project.

For Phase 1, correctness/reliability outranks speed, and speed outranks memory optimization. Exact <=13-card decomposition should be benchmarked on the real TypeScript implementation before approximation is considered.

# 7. Data and Model Ownership

Detailed TypeScript model definitions are intentionally kept out of this requirements document.

The model ownership rules are:

- **`domain-model.md`** defines stable shared domain concepts such as `Card`, `Rank`, `Suit`, `PlayerId`, `GameMode`, `CombinationType`, `Combination`, and `Move`.
- **`engine.md`** defines authoritative/internal runtime state and engine public contracts such as Round/Session/Trick state, internal player state, validation results, scoring breakdowns, Player/Public Views, and engine event contracts.
- **`orchestrator.md`** defines PlayerController and game-runner/orchestration contracts.
- **`ai.md`** defines the Phase 1 Baseline bot decision policy, analysis/evaluation data, deterministic tracing, permitted information, and extension boundaries for deferred stronger AI.
- **`ui-ux.md`** defines UI view state, navigation, Phase 1 card selection/sorting, presentation models, responsive behavior, and screen behavior.
- **`persistence.md`** is deferred for Phase 1; if later created, it will define saved-game snapshots, statistics records, settings persistence, storage versions, and migrations.
- **`events-logging.md`** defines event retention, formatting, debug/history records, filtering, and consumers.
- **`testing-simulation.md`** defines simulation scenarios, aggregate metrics, fixtures, and test-run configuration.

A type should not be placed in the shared domain model simply because multiple modules consume it. Public subsystem contracts remain owned by their subsystem unless they describe an implementation-independent game concept.

This separation is intended to prevent duplicate models, hidden-information leakage, and accidental coupling between UI/AI/persistence code and engine-internal authoritative state.

------------------------------------------------------------------------

# 8. UI / UX

`ui-ux.md` is the authoritative UI/UX design document. Its Phase 1 sections preserve the landscape baseline; its Phase 2 contract defines the approved portrait, tutorial/reference, and accessibility expansion.

The Phase 1 UI is intentionally small but complete: Home, Game Table, Round Result overlay, and Session Summary. **Start Game** immediately starts the fixed Basic Session in Phase 1; startup must still pass through a clean application/configuration boundary so a future setup sub-screen can be inserted when real options such as game mode or difficulty enter scope. It integrates with the production Engine/Orchestrator rather than reproducing game rules in React.

Deferred UI concepts documented there preserve prior decisions but do not imply a post-Phase-1 timeline.

# 9. Future Game Modes and Modifiers

This section is future-facing. These features are not required for v1, but
the architecture must avoid making them difficult to add.

## 9.1 Design Principle

The base engine should own:

-   deck and card operations;
-   combination detection;
-   card and combination comparison;
-   trick legality;
-   turn rotation;
-   active-player tracking;
-   mode-specific scoring and round-ending behavior.

Future game modes and modifiers should extend setup or selected
round/session behavior through configuration and composable services rather
than by scattering special cases throughout the engine.

## 9.2 Reveal One Card

During round setup, one random card from each player is revealed to all
players.

Future implementation requirements:

-   Revealed cards must be represented explicitly in round state.
-   All players must receive the same public information.
-   The reveal must occur before normal gameplay.
-   Random selection must use the injectable/seeded RNG.

## 9.3 Card Exchange

Each player chooses 2 cards to give to the player on their right.

The exact exchange procedure is intentionally **not yet specified**.

Before implementation, decide:

-   whether all players choose simultaneously;
-   whether players choose before seeing cards received from others;
-   whether exchanged cards are public or private;
-   how AI players evaluate which cards to give away;
-   how the exchange interacts with other setup modifiers.

## 9.4 Extensible Mode Model

A future mode should be able to define:

-   round setup modifiers;
-   public-information rules;
-   optional exchange phases;
-   scoring rules;
-   round-ending rules;
-   session-level behavior.

The base combination and comparison engine should remain reusable unless a
future variant explicitly defines a different ruleset.

------------------------------------------------------------------------

# 10. Persistence

Use browser **`localStorage`** for v1 persistent data.

Store:

-   persistent player statistics;
-   cumulative hand-type counts;
-   optional unfinished session state;
-   relevant local settings.

Do not use cookies for game state or statistics.

Persistence must remain entirely local and must not require a server.

If the application later grows to require large histories, multiple save
slots, or more complex data, IndexedDB can be considered.

------------------------------------------------------------------------

# 11. Possible Future Online Cross-Play — Not Committed

This section is informational only and is not part of v1 implementation.

The architecture should make future online play possible without
rewriting the rules engine.

Potential future online architecture (outside committed Phase 2):

1.  Package `/engine` as a reusable TypeScript module.
2.  Add a Node.js server.
3.  Server imports the same engine.
4.  Add a `NetworkController`.
5.  Use WebSocket-based communication.
6.  Server becomes authoritative.
7.  Clients send proposed moves.
8.  Server validates moves through the engine.
9.  Server broadcasts authoritative state.
10. Add rooms/matchmaking/reconnection.
11. Add authentication/accounts later.

The client should never be trusted as the final authority over move
legality in online mode.

------------------------------------------------------------------------

# 12. Testing Plan

## 12.1 Unit Tests

Test the engine independently of React.

### Deck

-   Exactly 52 cards.
-   Every card is unique.
-   Four suits.
-   Thirteen ranks.
-   Correct shuffle behavior.
-   Correct 13-card deal.

### Card and small-combination comparison

-   Rank order.
-   Suit order.
-   3♣ is lowest.
-   2♦ is highest.
-   Same-Rank Singles compare by Suit.
-   Pairs compare by Rank first; equal-Rank Pairs compare by the highest-Suit card contained in each Pair.
-   Triples compare by Rank only.
-   Tests must not fabricate two distinct equal-Rank Triples, because such a matchup is impossible with one standard 52-card deck.

### Combination detection

Test:

-   Single.
-   Pair.
-   Triple.
-   Straight property detection for every valid house-rule sequence regardless of suits, including same-suit sequences.
-   Flush property detection for every same-suit five-card set, including sets that also satisfy Straight.
-   Final five-card classification chooses the highest-ranking applicable category when definitions overlap.
-   Full House.
-   Four-of-a-Kind.
-   Straight Flush.

### Straight edge cases

Explicit tests for:

-   A-2-3-4-5.
-   2-3-4-5-6.
-   3-4-5-6-7.
-   10-J-Q-K-A.
-   J-Q-K-A-2.
-   K-A-2-3-4 invalid.
-   Q-K-A-2-3 invalid.
-   A valid sequence with all five cards in one suit still passes Straight property detection, but its final canonical category is Straight Flush.
-   A valid sequence using at least two suits is classified as Straight when no stronger category applies.

### Straight comparison

Verify:

`A-5 < 2-6 < 3-7 < ...`

and verify same-high-card suit tiebreakers.

### Flush comparison

Verify:

-   Diamonds \> Hearts.
-   Hearts \> Spades.
-   Spades \> Clubs.
-   Same-suit flushes compare by descending card ranks.
-   A same-suit hand whose ranks form a valid house-rule sequence still satisfies Flush, but its final canonical category is Straight Flush.
-   A same-suit hand whose ranks do not form a valid house-rule sequence is classified as Flush.

### Full house

Verify only the triple rank determines strength.

### Four-of-a-kind

Verify only the four-card rank determines strength.

### Straight flush

Verify:

1.  detection requires both one suit and a valid house-rule sequence;
2.  when Straight and Flush properties overlap, final classification selects Straight Flush as the highest-ranking applicable category;
3.  highest rank first;
4.  highest-card suit second.

### Five-card hierarchy and physical uniqueness

Verify:

-   every stronger five-card category strictly beats every weaker category regardless of internal cards;
-   same-category comparisons use only that category's documented comparison rule;
-   test hands are physically realizable from one 52-card deck and do not duplicate a physical card across opposing combinations;
-   impossible tie scenarios are not presented as normal gameplay cases.

### Trick validation

Test:

-   Singles only answer Singles.
-   Pairs only answer Pairs.
-   Triples only answer Triples.
-   Higher same-type Single/Pair/Triple plays are accepted.
-   Lower same-type plays are rejected.
-   A Straight can be beaten by a Flush, Full House, Four-of-a-Kind, or
    Straight Flush.
-   A Flush can be beaten by a Full House, Four-of-a-Kind, or Straight
    Flush.
-   A Full House can be beaten by a Four-of-a-Kind or Straight Flush.
-   A Four-of-a-Kind can be beaten by a Straight Flush.
-   Lower-ranked cross-type five-card responses are rejected.
-   After a cross-type five-card play, the new combination becomes the
    current trick.
-   Passing.
-   New trick after all active opponents pass.

### Opening move

Test that:

-   3♣ must be present.
-   Any valid combination containing 3♣ is allowed.
-   A valid combination without 3♣ is rejected.

### Player elimination

Test:

-   player goes out;
-   player is removed from active rotation;
-   current turn skips eliminated players;
-   pass counts remain correct;
-   Basic Mode continues correctly;
-   Competitive Mode ends immediately.

### Basic Mode

Test:

-   first three players empty their hands;
-   final player receives 4th place;
-   scoring is 5/3/2/0;
-   final-play continuation occurs when another player can beat the
    outgoing player's final play;
-   next active player leads if nobody can beat it.

### Competitive Mode

Test:

-   round ends at first player to empty their hand;
-   0--9 card penalty;
-   10--13 card penalty;
-   unused bomb multiplier;
-   winner-final-play multiplier;
-   ×4 stacking;
-   winner receives the negative sum of loser penalties.

### Bomb detection

Test:

-   remaining 2;
-   remaining four-of-a-kind;
-   remaining valid straight flush;
-   multiple qualifying bombs still produce only one unused-bomb ×2;
-   a straight flush containing a 2 still produces one unused-bomb ×2.

### Session

Test:

-   exactly 5 rounds;
-   totals;
-   session winner;
-   tiebreakers;
-   genuine tie;
-   session win statistics.

------------------------------------------------------------------------

# 12.2 Component Tests

Use React Testing Library + Vitest.

Test:

-   cards render correctly;
-   selection state;
-   combination type display;
-   invalid play cannot be submitted;
-   Pass button behavior;
-   Play button behavior;
-   turn indicator;
-   round result;
-   session summary;
-   statistics screen.

------------------------------------------------------------------------

# 12.3 AI Simulation Tests

Run many headless games without the browser.

Verify:

-   AI never submits illegal moves.
-   Games always terminate.
-   No player gets stuck permanently.
-   AI legal-move generation includes valid cross-type five-card responses.
-   Turn rotation remains valid after players go out.
-   Scores remain internally consistent.
-   Different seeds can produce different valid games.
-   With identical deterministic configuration and the same Engine RNG seed/state, the same headless execution is reproducible.
-   Initial AI move selection is deterministic and does not require a separate AI RNG seed. If future controlled AI variation is introduced, its AI RNG seed/state becomes part of replay metadata.

Phase 1 M3 simulation is a reliability/debugging harness, not an AI balancing tournament. Future AI evaluation may reuse the simulator after stronger AI work enters committed scope.

------------------------------------------------------------------------

# 12.4 Manual Testing

Test Phase 1 behaviors including:

- desktop/laptop landscape;
- supported tablet/phone landscape;
- non-fullscreen/windowed browser layouts;
- unsupported portrait and undersized guidance;
- card selection, raised selected-card state, and rapid repeated input;
- bounded mouse/touch manual hand rearrangement while preserving selection;
- Sort by Rank/Suit while preserving selection;
- Play/Pass validation and understandable invalid reasons;
- Discard Pile and Event Log overlays, including pause/resume behavior;
- readable bot-turn pacing without requiring humans to measure milliseconds;
- 4th-place remaining-hand reveal;
- Round Result scoring/reordering animation and explicit Next Round;
- full five-Round Session transition to Session Summary;
- leave/reload behavior clearly communicating that unfinished progress is not saved;
- offline gameplay after required application assets are available.

------------------------------------------------------------------------

# 12.5 Cross-Browser Testing

Target:

-   Chrome.
-   Edge.
-   Firefox.
-   Safari.
-   Android Chrome.
-   iOS Safari.

------------------------------------------------------------------------

# 12.6 Offline/PWA Testing

Use browser developer tools to:

-   disable network access;
-   reload the application;
-   start a new session;
-   complete rounds;
-   verify no gameplay request requires the network.

If PWA support is enabled, verify the service worker caches all required
application assets.

------------------------------------------------------------------------

# 13. Tools Needed

-   **Node.js LTS**
-   **npm** or **pnpm**
-   **Vite**
-   **TypeScript**
-   **React**
-   **Vitest**
-   **React Testing Library**
-   **VS Code** or preferred editor
-   **ESLint**
-   **Prettier**
-   **Git**
-   Chrome/Edge DevTools
-   Optional: `vite-plugin-pwa`
-   Optional later: Playwright

------------------------------------------------------------------------

# 14. Remaining Phase 1 Design / Implementation Items

These are implementation details still to be finalized inside the committed M3/M4 work. They are not unresolved game rules.

## 14.1 M3 reliability harness details

M3 task design may finalize implementation details such as:

- simulator configuration/seed representation;
- trace/failure artifact formatting;
- generous nontermination/progress guard thresholds;
- deterministic acceptance seed-set/batch size;
- compact summary/report formatting.

These choices must not create a second gameplay implementation or redefine Engine rules.

## 14.2 M4 responsive layout contract

M4 must explicitly define and then consistently test:

- representative supported viewport dimensions;
- minimum supported landscape dimensions;
- the play-area aspect-ratio/envelope;
- the constant card width:height ratio;
- minimum readable core typography;
- minimum usable critical control/touch sizes;
- reflow/collapse behavior for secondary panels;
- unsupported portrait/undersized behavior.

These are intentionally finalized during M4 implementation/design rather than guessed in advance. The result must satisfy `ui-ux.md` and the M4 milestone requirements.

## 14.3 Deferred research/design

Stronger AI, AI difficulty/personality systems, Competitive strategy, persistence/statistics/settings, setup modifiers, richer pacing controls, and other post-Phase-1 ideas remain deferred. Existing prior designs may be preserved, but they must not be treated as current implementation tasks.

------------------------------------------------------------------------

# 15. Delivery Scope and Future Direction

The completed baseline is Phase 1 M1–M4 (§1.5). The committed expansion is Phase 2 M5–M8 (§1.6 and §3.6). No milestone numbers are assigned beyond M8.

## 15.1 Deferred approved designs

These have meaningful prior design decisions that should be preserved, but they are not Phase 1 implementation requirements and have no committed delivery phase or timeline:

- Competitive Mode and its scoring/tiebreak rules.
- More capable AI, including difficulty levels and deeper reasoning.
- AI personalities, Mystery Bots, and Surprise Me configuration.
- Persistence/Resume, persistent statistics, and Settings.
- Auto-pass convenience.
- Two-color/four-color suit preference; Phase 1 uses four-color suits by default with no toggle.
- UI polish beyond the explicitly committed Phase 2 responsive/accessibility/tutorial work; minor polish remains optional, not a new delivery system.
- Progression/achievement concepts already discussed.

## 15.2 Possible future directions — not committed

Online multiplayer, backend/server infrastructure, additional game modes/modifiers, PWA/product packaging, and other expansions are possibilities only. Their presence in architecture notes must not be interpreted as a promise, timeline, or approved implementation plan.

## 15.3 Scope-control rule

Known future requirements justify small, clean extension seams when they are inexpensive and improve separation of concerns. They do **not** justify speculative frameworks or implementation of deferred behavior during either committed phase. Preserve Phase 1 correctness while delivering only the approved M5–M8 expansion.

# 16. Rules Summary --- Quick Reference

### Cards

**Ranks:**\
`3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2`

**Suits:**\
`♣ < ♠ < ♥ < ♦`

### Opening

**3♣ must be included in the opening move.**

The opening move can be any valid combination containing 3♣.

### Combination strength

For Singles, Pairs, and Triples, the responding play must use the same
combination type.

For five-card tricks, any strictly stronger five-card type is allowed:

`Straight < Flush < Full House < Four-of-a-Kind < Straight Flush`

### Straight ranking

Rank by the **last/highest card of the sequence**.

`A-5 < 2-6 < 3-7 < 4-8 < ...`

If the high rank is equal, compare the suit of the high card.

### Straight Flush ranking

Same as Straight:

**highest rank first → high-card suit second.**

### Basic Mode

Round continues until one player remains.

`1st = 5, 2nd = 3, 3rd = 2, 4th = 0`

### Competitive Mode

Round ends when the first player goes out.

-   0--9 cards: `1 point/card`
-   10--13 cards: `2 points/card`
-   Unused bomb: ×2
-   Winner's final play qualifies: ×2
-   Both: ×4
-   Winner receives the sum of all loser penalties.

### Session

**5 rounds.**

Highest session total wins, followed by:

1.  Most round wins.
2.  Best average placement across the 5 Rounds; lower average is better.
3.  Highest single best-round score.
4.  Genuine tie if still tied.

## Phase 2 Authored Tutorial Script

[tutorial-script.md](tutorial-script.md) owns the teaching copy, complete authored deals, example traces, and topic coverage under tutorial.md. Teach all 1-, 2-, 3-, and 5-card categories through player actions, rank/suit/category improvement, required and voluntary Pass, history/reference tools, practical non-mandatory strategy tips, Free Lead, and explicit continuation after a finisher. Free play here is the final portion of the tutorial, not a separate sandbox mode. The real five-Round results and Session totals remain Engine-owned.

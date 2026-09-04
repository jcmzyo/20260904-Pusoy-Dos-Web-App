# Pusoy Dos --- Offline Web Game

## Requirements & Planning Document (v1.4)

**Status:** Draft for implementation\
**Phase 1 scope:** Offline, single device, Human vs AI bots\
**Future scope:** Online cross-play (multiplayer over network)

------------------------------------------------------------------------

## 1. Overview

A web-based implementation of **Pusoy Dos** (Filipino "Big Two").
Version 1 is fully offline: one human player competes against 3
AI-controlled bots on a fixed 4-player table, with no server, account,
or internet requirement.

A **session consists of 5 rounds**. Each session uses one of two game
modes: **Basic** or **Competitive**.

The codebase must be structured so that a future networked multiplayer
mode can reuse the same game rules engine and UI. The intended future
change is primarily the addition of a transport/session layer and
network-controlled players.

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
-   Additional bot personalities beyond the Optimizer Bot.
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
| `engine.md` | Game Engine | Authoritative game rules, validation, state transitions, scoring, and engine-owned game state |
| `orchestrator.md` | Game Orchestrator | Coordinates game flow, player controllers, engine execution, events, and round/session progression |
| `ai.md` | AI System | Bot move selection, strategies, personalities, difficulty behavior, and permitted game information |
| `ui-ux.md` | UI Layer | Screens, interactions, presentation, feedback, accessibility, responsive behavior, and quality-of-life features |
| `persistence.md` | Game Persistence | Saving/loading resumable state, settings, statistics, storage schema, versioning, and migrations |
| `events-logging.md` | Event & Logging System | Structured gameplay events, game history, debug logging, formatting, and event consumers |
| `testing-simulation.md` | Testing & Simulation | Unit/integration testing, headless games, deterministic simulation, regression testing, and AI balancing support |

Future online multiplayer may introduce a separate `networking.md` when that work enters scope. Player-controller contracts should initially be documented with the orchestrator, while engine configuration and ruleset configuration should initially be documented with the engine.

### 1.3.1 Documentation authority

The documents follow this authority model:

1. **`requirements.md` defines product truth.** A subsystem document must not silently change a confirmed rule, scoring rule, product behavior, or architectural boundary defined here.
2. **Subsystem documents define implementation contracts.** They may add internal types, APIs, algorithms, state models, workflows, and design decisions needed to satisfy this document.
3. If implementation work reveals that a confirmed product requirement must change, **update `requirements.md` first**, then update the affected subsystem documents.
4. Details should live in the most relevant subsystem document rather than being duplicated across every document. This main document may summarize a subsystem boundary without specifying its full implementation.

### 1.3.2 High-level module boundaries

The v1 architecture is organized around the following major responsibilities:

- **Game Engine:** owns authoritative game truth, rule validation, state transitions, and scoring. It does not drive players, render UI, persist data, or choose AI moves.
- **Game Orchestrator:** drives the game forward by coordinating player controllers and submitting their proposed actions to the engine. It does not reimplement game rules.
- **Player Controllers:** provide player intent from a human, AI, or future network source. Controllers cannot mutate authoritative game state directly.
- **AI System:** chooses among permitted actions using the information available to that bot. It does not determine authoritative legality.
- **UI Layer:** renders player-facing state and gathers human input. It does not own authoritative game rules or scoring.
- **Game Persistence:** stores and restores durable data. The engine must not depend on `localStorage` or another persistence implementation.
- **Event & Logging System:** records structured gameplay events for UI history, debugging, testing, and simulation without changing game state.
- **Testing & Simulation:** exercises the same production engine and orchestrator headlessly. Four AI-controlled players must be able to complete games and sessions without React or another UI being present.

A central architectural requirement is that the **Game Engine remains independently executable and testable**. A headless setup consisting of the engine, orchestrator, four AI controllers, and event/logging components must be capable of running a complete game/session without UI or persistence dependencies.

------------------------------------------------------------------------

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
-   A session consists of **5 rounds**.
-   Each round:
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

  Straight                            Exactly 5 consecutive ranks
                                      according to §2.4

  Flush                               Exactly 5 cards of the same suit

  Full House                          Exactly 3 cards of one rank +
                                      exactly 2 cards of another rank

  Four-of-a-Kind                      Exactly 4 cards of the same rank +
                                      1 kicker

  Straight Flush                      Exactly 5 consecutive ranks, all of
                                      the same suit
  -----------------------------------------------------------------------

### Five-card combination ranking

Low → high:

`Straight < Flush < Full House < Four-of-a-Kind < Straight Flush`

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

------------------------------------------------------------------------

## 2.4 Five-Card Combination Comparison Rules

Five-card comparison occurs in two stages:

1.  Compare combination type using the hierarchy in §2.3.
2.  If both combinations have the same type, use the type-specific
    comparison rule below.

Therefore, any combination from a stronger five-card category beats any
combination from a weaker category regardless of its internal rank values.

Each five-card type has its own same-type comparison rule.

### 2.4.1 Straight

A straight is ranked by the **last/highest rank in its sequence**.

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

-   `3♣ 4♣ 5♣ 6♣ 7♣` is weaker than
-   `3♣ 4♥ 5♠ 6♦ 7♥`

because both are 7-high and `7♥ > 7♣`.

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

A flush is compared by **suit first**.

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

Example:

-   `77733` beats `555KK`
-   `KKK22` beats `QQQAA`

because 7 \> 5 and K \> Q.

------------------------------------------------------------------------

### 2.4.4 Four-of-a-Kind

A four-of-a-kind is ranked by the **rank of the four matching cards**.

The kicker does not affect the comparison.

Example:

-   `7777 + X` beats `6666 + Y`

regardless of the kicker.

------------------------------------------------------------------------

### 2.4.5 Straight Flush

A straight flush follows the **same rank-first comparison logic as a
straight**.

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
4.  Starting from the next active player in clockwise order, determine
    whether an active player can legally beat that combination.
5.  If an active player can beat it:
    -   the first such player in turn order plays it;
    -   normal trick flow continues from that play;
    -   pass count resets.
6.  If no active player can beat it:
    -   the next active player becomes the new leader;
    -   that player may play any valid combination;
    -   pass count resets.
7.  Continue until only one active player remains.
8.  That final remaining player is recorded as **4th place** and the
    round ends.

This means a player going out does **not** automatically end the current
trick in Basic Mode.

------------------------------------------------------------------------

# 2.6 Game Modes

A session always consists of 5 rounds. The two modes differ in
round-ending behavior and scoring.

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

## 2.6.2 Competitive Mode

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

The session winner is the player with the **highest session total**
after all 5 rounds.

If players are tied, resolve ties in this order:

1.  **Most round wins** --- number of 1st-place finishes.
2.  **Best average placement** across the 5 rounds.
    -   Lower average is better.
    -   In Competitive Mode, only the winner has an official placement;
        therefore Competitive Mode does not use an official loser
        placement for this tiebreaker.
3.  **Highest single best-round score**.
4.  If still tied, declare a **genuine tie**.

### Basic Mode placement

Basic Mode always produces official placements 1st through 4th, so
average placement is directly calculated from the 5 rounds.

### Competitive Mode placement

Competitive Mode officially records only:

-   1st = round winner.

The other three players are losers for scoring purposes and are not
assigned official placements.

If a future feature requires loser ordering, remaining card count may be
displayed as informational data but must not silently become an official
placement.

------------------------------------------------------------------------

## 2.6.4 Session Flow

1.  Choose Basic or Competitive mode.
2.  Configure each AI bot's difficulty independently.
3.  Start the session.
4.  Play 5 rounds.
5.  Before each round:
    -   shuffle the full deck;
    -   deal 13 cards to each player;
    -   identify the player holding 3♣;
    -   that player opens with a valid combination containing 3♣.
6.  Show the round result.
7.  Continue to the next round.
8.  After round 5, show the session summary.
9.  Apply the session tiebreakers if necessary.
10. Update persistent local statistics.

------------------------------------------------------------------------

# 2.7 Hand-Type Tracking

Track the **human player's** played combinations.

The following types are counted separately:

-   Single
-   Pair
-   Triple
-   Straight
-   Flush
-   Full House
-   Four-of-a-Kind
-   Straight Flush

The two special low straights are included in the **Straight** count.

Track:

1.  Per-round counts.
2.  Per-session cumulative counts.
3.  Persistent cumulative counts across all sessions.

------------------------------------------------------------------------

# 3. Functional Requirements

## 3.1 Phase 1 --- MUST HAVE

-   [ ] Start a new session.
-   [ ] Select Basic or Competitive mode.
-   [ ] Configure Easy, Normal, or Hard difficulty independently for each bot.
-   [ ] Deal 13 cards to each of 4 players.
-   [ ] Freshly shuffle and deal before every round.
-   [ ] Display the human player's hand.
-   [ ] Default-sort the human hand by rank, then suit.
-   [ ] Allow manual card reordering.
-   [ ] Allow a Sort action to restore the default rank-then-suit order.
-   [ ] Select cards to form a proposed combination.
-   [ ] Display the detected/selected combination type and effective rank/strength before the human plays it.
-   [ ] Display the combination type and effective rank/strength whenever a bot plays cards.
-   [ ] Prevent the UI from submitting an invalid play.
-   [ ] Have the engine independently validate every submitted move.
-   [ ] Correctly enforce opening 3♣ requirements.
-   [ ] Correctly validate all combination types.
-   [ ] Correctly compare Singles, Pairs, and Triples.
-   [ ] Correctly allow strictly stronger cross-type five-card responses.
-   [ ] Correctly implement special straight rules.
-   [ ] Support passing.
-   [ ] Support an optional human auto-pass setting that triggers only when the human has zero legal plays.
-   [ ] When auto-pass triggers, record a human-facing log message such as "Auto pass — no valid play."
-   [ ] Auto-pass reason information must not be exposed to bots as public game information; bots should observe only that the human passed.
-   [ ] Show a pass hint when the human has zero legal plays against the current trick when auto-pass is disabled.
-   [ ] Do not provide a "suggest a move" feature.
-   [ ] Run AI turns automatically.
-   [ ] Add a short simulated AI thinking delay.
-   [ ] Display the current trick and recent play history.
-   [ ] Provide a toggleable played-card history/window containing cards that have already been publicly played.
-   [ ] Display whose turn it is.
-   [ ] Handle Basic Mode player elimination and continued trick flow.
-   [ ] Handle Competitive Mode immediate round termination.
-   [ ] Display clear game-state feedback for passes, trick wins, round wins, and session wins.
-   [ ] Display the round result.
-   [ ] In Competitive Mode, explicitly explain the score calculation from remaining cards through all applicable multipliers to the final score.
-   [ ] Display the full 5-round session summary.
-   [ ] Display human hand-type usage.
-   [ ] Support New Session and Rematch flows.
-   [ ] Work offline after the application has been loaded/cached.

------------------------------------------------------------------------

## 3.2 Phase 1 --- SHOULD HAVE

-   [ ] Relaxed / Fast pacing setting for AI presentation delay and transition speed.
-   [ ] Auto-sort and manual hand reordering.
-   [ ] Preserve manual card order until the player explicitly presses Sort.
-   [ ] Toggleable quick/skip behavior for round-result transitions.
-   [ ] Resume the last unfinished session.
-   [ ] Persistent player statistics.
-   [ ] Mode-separated persistent statistics.
-   [ ] Seeded/reproducible AI randomness for testing.
-   [ ] Additional bot personalities after Bot A.

### Persistent statistics

Statistics are stored locally using **`localStorage`**.

Cookies are not used for game-state/stat persistence.

Persistent statistics are separated by game mode.

#### Basic Mode statistics

-   Sessions played
-   Session wins
-   Win rate
-   Average session score
-   Best session score
-   Average placement
-   Best round score

#### Competitive Mode statistics

-   Sessions played
-   Session wins
-   Win rate
-   Total running score across sessions
-   Average session score
-   Best session score
-   Best round score

#### Shared statistics

-   Cumulative hand-type counts across all sessions and both modes

### Definition of a session win

A session win means the player is the **final session winner after all
session tiebreakers have been applied**.

If the result is a genuine tie, no player receives a session win for
that session.

------------------------------------------------------------------------

## 3.3 Explicitly Rejected

### No "Suggest a Move" button

The application must not provide a button that tells the human which
move to play.

The pass hint only informs the player that they have **zero legal
plays** and therefore need to pass.

------------------------------------------------------------------------

## 3.4 Phase 1 --- NICE TO HAVE

-   [ ] Sound effects.
-   [ ] Card skins/themes.
-   [ ] Tutorial/in-app rules reference.
-   [ ] Contextual rules/help for hand comparison and scoring explanations.
-   [ ] PWA install support.
-   [ ] Basic and advanced card/deal/play animations.
-   [ ] Additional statistics visualizations.
-   [ ] Potential legal-card dimming/highlighting to improve scanability without recommending a move.

The rules reference should explain:

-   Card ranking.
-   Suit ranking.
-   Valid combinations.
-   Five-card ranking.
-   Straight special cases.
-   Basic scoring.
-   Competitive scoring and bomb multipliers.

------------------------------------------------------------------------

## 3.5 Phase 2 --- ONLINE / DEFERRED

-   Real-time multiplayer.
-   Matchmaking.
-   Private room codes.
-   Network transport.
-   Reconnection handling.
-   Server-authoritative validation.
-   Player accounts.
-   Friend/invite functionality.
-   Additional AI personalities B--F.

------------------------------------------------------------------------

# 4. Non-Functional Requirements

## 4.1 Offline-first

The application must be playable without an active internet connection
after the application has been initially loaded and its required assets
have been cached.

No gameplay operation should require a network request.

## 4.2 Performance

-   Card selection should feel immediate.
-   Game-state transitions should be responsive.
-   AI should simulate thinking rather than intentionally performing
    slow computation.
-   Target AI presentation delay: approximately 0.3--1.5 seconds.
-   The AI delay must not be part of the engine's game rules.

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

  Future backend          Node.js + WebSocket     Online multiplayer

  Future shared engine    Pure TypeScript package Shared server/client
                                                  rules
  -----------------------------------------------------------------------

------------------------------------------------------------------------

# 5.1 Architecture

Recommended source structure:

``` text
/src
  /engine
    deck
    cards
    combinations
    rules
    comparison
    turn-state
    scoring
    round
    session

  /players
    PlayerController
    HumanController
    AIController
    NetworkController (future)

  /ai
    strategies
    OptimizerBot
    difficulty
    rng

  /state
    session state
    UI/game state wiring
    persistence

  /ui
    Table
    Hand
    Card
    Trick
    TurnIndicator
    RoundResult
    SessionSummary
    Stats
```

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

**`/engine` must never import from `/ui`.**

The engine should know nothing about:

-   React
-   DOM elements
-   browser events
-   animations
-   visual presentation

The UI should call engine functions and render the resulting state.

------------------------------------------------------------------------

# 5.2 Move / PlayerController Contract

A controller proposes what a player wants to do.

Conceptually:

``` ts
type Move =
  | {
      kind: 'play';
      playerId: string;
      cards: Card[];
    }
  | {
      kind: 'pass';
      playerId: string;
    };
```

The controller does **not** get to decide whether a move is legal.

### Engine responsibility

The engine must:

1.  Receive the proposed move.
2.  Determine the combination represented by the selected cards.
3.  Validate the combination.
4.  Validate that the player owns the selected cards.
5.  Validate that the play is legal against the current trick.
6.  Validate opening 3♣ requirements.
7.  Apply the move only if valid.
8.  Return a clear validation result/error if invalid.

The UI should use engine-provided legal-move information to prevent
invalid submissions, but the engine remains authoritative.

The engine should expose comparison/legal-move behavior equivalent to:

``` ts
canBeat(candidate: Combo, current: Combo): boolean
```

Required semantics:

-   Singles, Pairs, and Triples require matching combination type.
-   Five-card combinations compare first by five-card type hierarchy, then
    by the same-type comparison rule when both types are equal.
-   Legal-move generation must enumerate all legal five-card responses, not
    only combinations matching the current five-card type.
-   Human UI validation and AI move generation must use the same engine
    legality rules.


### Controller examples

``` text
HumanController
  receives input from the UI
  proposes a Move

AIController
  receives game state and legal moves
  selects a Move

NetworkController (future)
  receives remote input
  proposes a Move
```

This allows the same engine to support local and future network players.

------------------------------------------------------------------------

# 5.3 Deterministic Randomness

AI randomness must be testable.

The implementation should use an injectable random-number generator or
seeded RNG rather than relying directly on uncontrolled global
randomness.

Given the same:

-   game state,
-   each bot's AI difficulty,
-   each bot's personality,
-   random seed,

the AI should make reproducible decisions.

This is particularly important for:

-   AI unit tests;
-   simulations;
-   bug reproduction;
-   debugging;
-   balancing.

Deck shuffling should also support deterministic randomness when running
engine tests.

------------------------------------------------------------------------

# 6. AI Opponent Design

Six personalities are planned.

  ----------------------------------------------------------------------------
  ID                Personality       Intended behavior      v1
  ----------------- ----------------- ---------------------- -----------------
  A                 Optimizer         Attempts to maximize   **Build first**
                                      long-term game outcome 
                                      using legal-move       
                                      evaluation             

  B                 Chaotic           Random/unpredictable   Deferred
                                      legal choices          

  C                 Risk-Averse /     Minimizes potential    Deferred
                    Minimizer         penalty and avoids     
                                      dangerous remaining    
                                      cards                  

  D                 Greedy            Prefers immediately    Deferred
                                      strong/high-card or    
                                      high-impact plays      

  E                 Spoiler           Prioritizes preventing Deferred
                                      a specific opponent    
                                      from winning           

  F                 Card Counter      Tracks played cards    Deferred
                                      and infers opponents'  
                                      remaining cards        
  ----------------------------------------------------------------------------

## 6.1 Bot A --- Optimizer

Bot A is the only AI personality required for v1.

The phrase "objectively best move" must **not** be treated as a vague
assumption.

Before final implementation, Bot A's evaluation strategy should be
researched and documented.

The implementation should establish an explicit evaluation function
rather than claiming perfect game-theoretic optimality.

Candidate factors include:

-   cards shed by the move;
-   preservation of useful combinations;
-   preservation of high-impact cards;
-   preservation of bombs;
-   ability to respond to future tricks;
-   opponent hand sizes;
-   endgame risk;
-   likelihood of being forced to retain high-penalty cards;
-   current trick control.

The exact weighting should be treated as an AI design decision and
validated through simulations.

### Important distinction

"Best" means **best according to the implemented Bot A evaluation
strategy**, not mathematically proven optimal play.

------------------------------------------------------------------------

## 6.2 Difficulty

Difficulty and personality are separate concepts.

-   **Personality** determines *how the bot prefers to play*.
-   **Difficulty** determines *how effectively it executes that
    personality*.

For v1, all three bots use the Optimizer personality.

### Easy

-   Considers a limited set of reasonable legal moves.
-   Introduces controlled randomness.
-   Uses shallow evaluation.
-   Makes weaker endgame decisions.
-   Does not strongly react to opponents nearing victory.

### Normal

-   Uses the full Bot A evaluation strategy.
-   Makes deterministic best-scored choices under the selected seed.
-   Uses current trick and its own hand as primary information.
-   Uses limited opponent-state information.

### Hard

-   Uses the Normal strategy plus stronger opponent-aware decisions.
-   Considers opponents with 1--2 cards remaining.
-   More carefully preserves defensive responses.
-   Avoids wasting critical cards when doing so creates substantial
    endgame risk.

Hard is **not** intended to be a perfect card-counting AI. Full card
counting is reserved for future Personality F.

------------------------------------------------------------------------

# 7. Data Model

The following is a starting model and may be refined during
implementation without changing the external rules.

``` ts
type Suit =
  | 'clubs'
  | 'spades'
  | 'hearts'
  | 'diamonds';

type Rank =
  | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '10' | 'J' | 'Q' | 'K' | 'A' | '2';

interface Card {
  rank: Rank;
  suit: Suit;
}

type ComboType =
  | 'single'
  | 'pair'
  | 'triple'
  | 'straight'
  | 'flush'
  | 'fullhouse'
  | 'fourkind'
  | 'straightflush';

interface Combo {
  type: ComboType;
  cards: Card[];

  /**
   * Effective comparison value.
   * For straights and straight flushes this is
   * the effective highest rank, including special
   * low straights (5 and 6).
   */
  compareValue: number;
}

type BotPersonality =
  | 'optimizer'
  | 'chaotic'
  | 'minimizer'
  | 'greedy'
  | 'spoiler'
  | 'counter';

type BotDifficulty =
  | 'easy'
  | 'normal'
  | 'hard';

type GameMode =
  | 'basic'
  | 'competitive';

interface RulesetConfig {
  suitOrder: Suit[];
  fiveCardOrder: ComboType[];

  allowLowWrapStraights: boolean;

  /**
   * Special low straights:
   * A-2-3-4-5
   * 2-3-4-5-6
   */
}

interface PlayerState {
  id: string;
  hand: Card[];
  isBot: boolean;
  botPersonality?: BotPersonality;
  botDifficulty?: BotDifficulty;

  /**
   * Official placement.
   * Basic Mode: 1-4.
   * Competitive Mode: winner only.
   */
  placement?: number;
}

interface RoundState {
  roundNumber: number;
  players: PlayerState[];

  /**
   * Current active player index.
   * Turn advancement skips eliminated players.
   */
  currentTurn: number;

  lastPlayedCombo: Combo | null;
  lastPlayerToPlay: string | null;

  passCount: number;

  status:
    | 'dealing'
    | 'in_progress'
    | 'finished';

  /**
   * Players in order of officially emptying
   * their hands.
   *
   * Basic Mode: up to 3 players, with the
   * final remaining player appended as 4th.
   *
   * Competitive Mode: contains the winner only.
   */
  finishOrder: string[];
}

interface RoundResult {
  roundNumber: number;

  finishOrder: string[];

  pointsByPlayer: Record<string, number>;

  /**
   * Hand-type counts for the round.
   */
  handTypeCountsThisRound:
    Record<string, Record<ComboType, number>>;
}

interface SessionState {
  mode: GameMode;

  ruleset: RulesetConfig;

  players: {
    id: string;
    isBot: boolean;
    botPersonality?: BotPersonality;
    botDifficulty?: BotDifficulty;
  }[];

  roundsCompleted: RoundResult[];

  currentRound: RoundState | null;

  sessionTotals: Record<string, number>;

  status:
    | 'in_progress'
    | 'finished';
}

interface HandTypeStats {
  single: number;
  pair: number;
  triple: number;
  straight: number;
  flush: number;
  fullhouse: number;
  fourkind: number;
  straightflush: number;
}

interface BasicModeStats {
  sessionsPlayed: number;
  sessionWins: number;
  averageSessionScore: number;
  bestSessionScore: number;
  averagePlacement: number;
  bestRoundScore: number;
}

interface CompetitiveModeStats {
  sessionsPlayed: number;
  sessionWins: number;
  totalRunningScore: number;
  averageSessionScore: number;
  bestSessionScore: number;
  bestRoundScore: number;
}

interface PlayerStats {
  playerId: string;

  basic: BasicModeStats;
  competitive: CompetitiveModeStats;

  cumulativeHandTypeCounts: HandTypeStats;
}
```

------------------------------------------------------------------------

# 8. UI / UX Screens

## 8.1 Home / New Session

Required:

-   Game mode selection:
    -   Basic
    -   Competitive
-   Per-bot difficulty configuration:
    -   Bot 1: Easy / Normal / Hard
    -   Bot 2: Easy / Normal / Hard
    -   Bot 3: Easy / Normal / Hard
-   Start Session button.
-   Resume unfinished session if one exists.

## 8.2 Game Table

Display:

-   Human player's hand.
-   Opponent card backs.
-   Opponent card counts.
-   Opponent identity, difficulty, and current session score, for example `Jihyo (Normal) - 8 pts`.
-   Current round number, for example `Round 3 / 5`.
-   Current trick.
-   Recent play history.
-   A toggleable window containing all publicly played cards.
-   Current player's turn.
-   Clockwise turn indication.
-   Play button.
-   Pass button.
-   Selected combination type and effective rank/strength before the Play button is pressed.
-   Hand type and effective rank/strength whenever a bot plays cards.
-   Legal/illegal selection feedback.
-   Clear table-state feedback such as `PASS`, `TRICK WON`, round winner, and session winner.
-   Pass hint when no legal play exists and human auto-pass is disabled.

### Human card interaction

-   Clicking/tapping a card selects it.
-   Clicking/tapping an already selected card deselects it.
-   The Play button is disabled while the selected cards do not form a legal play.
-   Pressing Play is the explicit confirmation step; no additional per-move confirmation dialog is required.
-   Manual card rearrangement must be preserved after cards are played.
-   Cards are only automatically rearranged when the player explicitly presses Sort.

### Human auto-pass

When the auto-pass setting is enabled and the human has zero legal plays:

-   the game should not wait for human input;
-   the human-facing history may show `Auto pass — no valid play`;
-   bots must only observe the public action `pass` and must not receive the private reason that no legal move existed.

### Played-card information

The played-card window contains only information that has already become public through normal gameplay. It should help the human review prior plays without revealing hidden cards.

Normal and Hard AI may make use of publicly played-card information as part of their decision logic. Hard AI may use it more systematically, while full inference-focused behavior remains reserved for the future Card Counter personality.

The UI should never rely solely on visual validation. The engine remains authoritative.

## 8.3 Round Result

Display:

-   Round number.
-   Official result and round winner.
-   Points gained/lost.
-   Running session totals.
-   Human hand-type usage for the round.
-   Next Round button.

### Competitive Mode scoring presentation

The scoring breakdown must be explicit rather than showing only a final number. For each losing player, the UI should visually explain the calculation in order:

1.  Reveal/show the losing player's remaining hand.
2.  Show the number of cards remaining and the base penalty.
3.  Highlight any qualifying unused bomb and apply its multiplier.
4.  Show any winner-final-play multiplier.
5.  Show the resulting final penalty.
6.  After all loser penalties are shown, show the winner's corresponding positive score.

The presentation should make it visually clear which remaining cards caused a bomb multiplier.

In Competitive Mode, the three losing players may have their remaining card counts displayed, but they should not be labeled as official 2nd/3rd/4th placements.

Round-result presentation should be skippable/accelerated when the corresponding pacing preference is enabled.

## 8.4 Session Summary

Display:

-   All 5 round results.
-   Per-player session totals.
-   Final ranking.
-   Applied tiebreakers when necessary.
-   Human player's hand-type statistics.
-   Rematch / Play Again with Same Setup.
-   New Session.
-   Home.

A Rematch preserves the selected mode and all three bot difficulty settings. A New Session returns the player to setup.

## 8.5 Stats

Display persistent statistics.

At minimum:

### Basic

-   Sessions played
-   Session wins
-   Win rate
-   Average session score
-   Best session score
-   Average placement
-   Best round score

### Competitive

-   Sessions played
-   Session wins
-   Win rate
-   Total running score
-   Average session score
-   Best session score
-   Best round score

### Shared

-   Cumulative hand-type usage.

Basic and Competitive statistics must remain separate because their scoring and result models are different. The Stats screen should prioritize a concise set of meaningful headline statistics and avoid presenting every tracked metric with equal prominence.

------------------------------------------------------------------------

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

# 11. Future Online Cross-Play

This section is informational only and is not part of v1 implementation.

The architecture should make future online play possible without
rewriting the rules engine.

Potential Phase 2 architecture:

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

### Card comparison

-   Rank order.
-   Suit order.
-   3♣ is lowest.
-   2♦ is highest.

### Combination detection

Test:

-   Single.
-   Pair.
-   Triple.
-   Straight.
-   Flush.
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

### Full house

Verify only the triple rank determines strength.

### Four-of-a-kind

Verify only the four-card rank determines strength.

### Straight flush

Verify:

1.  highest rank first;
2.  highest-card suit second.

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
-   The same seed reproduces the same deterministic AI decisions where
    randomness is used.

Simulation should eventually be used to evaluate and tune Bot A's
strategy.

------------------------------------------------------------------------

# 12.4 Manual Testing

Test:

-   Desktop browser.
-   Mobile browser.
-   Small screens.
-   Card selection/misclicks.
-   Rapid clicking.
-   Round transitions.
-   Session transitions.
-   Refresh/resume behavior.
-   Offline operation.
-   Persistence after closing/reopening the browser.

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

# 14. Open Design / Research Items

These are not unresolved game rules. They are implementation/research
tasks.

## 14.1 Bot A evaluation strategy

Research and prototype different approaches for the Optimizer Bot.

The final implementation should document:

-   evaluation criteria;
-   weighting;
-   lookahead depth;
-   handling of opponent risk;
-   handling of bombs;
-   endgame behavior;
-   how difficulty modifies the strategy.

Do not describe Bot A as "objectively optimal" unless a mathematically
justified optimal solver is actually implemented.

## 14.2 AI balancing

Use seeded simulations to compare:

-   Easy vs Normal vs Hard.
-   Win rates.
-   Average placement.
-   Average cards remaining.
-   Competitive Mode scores.

Difficulty should feel meaningfully different without being artificially
unfair.

## 14.3 UI design

The visual design can evolve independently as long as it preserves the engine/UI boundary.

Current UX direction:

-   prioritize readable game state over decorative animation;
-   always explain what combination was played and its effective strength;
-   keep animation as Nice to Have rather than a core milestone dependency;
-   provide strong defaults and avoid an overgrown settings screen;
-   use Relaxed / Fast as the main pacing control rather than many granular timing settings;
-   preserve manual hand organization until the player explicitly requests sorting;
-   keep legal-card dimming/highlighting as a potential future improvement rather than a committed v1 behavior;
-   contextual help is useful but lower priority than the engine and basic playable UI.

## 14.4 Future setup-modifier rules

Before implementing Card Exchange, explicitly define:

-   simultaneous vs sequential selection;
-   when received cards become visible to the recipient;
-   whether exchanged cards are publicly revealed;
-   modifier ordering when multiple setup modifiers are enabled;
-   AI selection strategy for exchange decisions.

These are intentionally deferred and must not be inferred silently during
implementation.


------------------------------------------------------------------------

# 15. Milestone Plan

## M1 --- Engine Core

Build:

-   card model;
-   rank/suit ordering;
-   deck;
-   shuffle/deal;
-   combination detection;
-   five-card comparison;
-   straight special cases;
-   move validation;
-   turn state machine;
-   Basic Mode round flow;
-   Competitive Mode scoring;
-   unit tests.

No React UI required.

## M2 --- Basic Playable UI

Build:

-   React/Vite application;
-   game table;
-   human hand;
-   Bot A;
-   per-bot difficulty configuration;
-   Easy difficulty;
-   one complete Basic Mode round;
-   Play/Pass flow;
-   turn indicator;
-   selected-hand type/strength feedback;
-   bot-play type/strength feedback;
-   current round and per-player score display;
-   manual card rearrangement with explicit Sort behavior.

## M3 --- Complete Session

Build:

-   5-round sessions;
-   Competitive Mode;
-   Normal difficulty;
-   Hard difficulty;
-   pass hint;
-   optional human auto-pass;
-   played-card history window;
-   Relaxed / Fast pacing;
-   round results with explicit Competitive scoring breakdown;
-   session summary;
-   hand-type tracking;
-   persistent statistics;
-   localStorage persistence.

## M4 --- Polish

Build:

-   improved UI;
-   optional animations and event polish;
-   contextual rules/help;
-   potential legal-card dimming/highlighting;
-   resume support;
-   PWA/offline install;
-   tutorial/rules reference;
-   sound effects if desired;
-   statistics visualizations.

## M5 --- Future Online / Advanced AI

Separate future effort:

-   NetworkController;
-   Node.js server;
-   WebSocket transport;
-   server-authoritative validation;
-   multiplayer rooms;
-   reconnection;
-   additional bot personalities B--F.

------------------------------------------------------------------------

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
2.  Best average placement.
3.  Highest single best-round score.
4.  Genuine tie if still tied.

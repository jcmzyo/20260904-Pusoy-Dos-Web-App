# Pusoy Dos --- Testing & Simulation Strategy

## Testing & Simulation Document (v1.4)

**Status:** Draft for implementation  
**Last Modified:** September 8, 2026
**Parent document:** `requirements.md` v1.10  
**Shared model:** `domain-model.md` v1.2  
**Engine design:** `engine.md` v1.4  
**Orchestrator design:** `orchestrator.md` v1.3  
**AI design:** `ai.md` v1.2  
**Module:** Testing & Simulation  
**Primary POC target:** Fully headless five-Round game/session execution  
**Language/tooling:** TypeScript + Vitest + headless Node.js execution

---

# 1. Purpose

This document defines the project-wide testing and headless simulation strategy for the Pusoy Dos implementation.

The immediate Proof-of-Concept goal is not a UI. The POC is successful when the real production-oriented Domain, Game Engine, Game Orchestrator, and AI modules can execute complete Pusoy Dos Sessions headlessly and can prove their correctness through repeatable automated tests.

The testing strategy is organized into three primary layers:

1. **Unit Tests** --- prove individual rules, algorithms, and components are correct in isolation.
2. **Integration Tests** --- prove real modules work together correctly across their public boundaries.
3. **Headless Game Simulator** --- exercise full games and Sessions repeatedly using the same production Engine, Orchestrator, and AI code, providing stress testing, regression reproduction, diagnostics, performance measurements, and later AI balancing.

The central QA principle is:

> Correctness must be demonstrated at the smallest practical level, then revalidated at module boundaries, then stress-tested through complete real execution.

For the POC, optimization priority is:

1. **accuracy and reliability**;
2. **speed**;
3. **memory usage**.

A correct result that takes somewhat longer on a slower device is acceptable during the POC. An incorrect rule result, illegal Move, inconsistent score, hidden-information leak, or nondeterministic failure is not.

---

# 2. Testing Authority and Rule Source

Testing does not define game rules.

The authoritative source order remains:

1. `requirements.md` --- confirmed product and house-rule truth;
2. `domain-model.md` --- shared implementation-independent contracts;
3. `engine.md` --- authoritative rule implementation contracts;
4. `orchestrator.md` --- execution/controller coordination contracts;
5. `ai.md` --- AI decision behavior and information-access contracts;
6. this document --- test strategy, fixtures, simulation infrastructure, QA gates, and measurement policy.

If a test expectation conflicts with a confirmed house rule, **the test is wrong unless the product requirement has first been explicitly changed**.

If an external poker, Big-Two, search, or hand-evaluation algorithm produces a result that conflicts with the project's house rules, the external algorithm must be adapted or rejected. Tests must encode the project's rules rather than the external algorithm's assumptions.

No test or simulator implementation may become an alternate rule engine.

---

# 3. POC Quality Goals

The headless POC should establish confidence in five areas.

## 3.1 Rule correctness

The Engine must correctly implement:

- the 52-card deck;
- Rank order;
- Suit order;
- all valid Combination types;
- all invalid Combination cases;
- special Straight rules;
- five-card hierarchy;
- same-type comparison rules;
- legal Move generation;
- Opening Move behavior;
- Passing and Trick reset behavior;
- Basic Mode continuation after players finish;
- Competitive Mode immediate Round ending;
- Basic and Competitive scoring;
- Session totals and mode-specific tiebreaks.

## 3.2 State correctness

The system must never lose, duplicate, invent, or illegally move a Card.

Turn ownership, active-player state, finish order, Round lifecycle, Session lifecycle, and scores must remain internally consistent after every accepted Move.

## 3.3 Boundary correctness

Each module must obey its architectural boundary:

- Engine owns rules and authoritative state;
- Orchestrator coordinates controllers but does not calculate rules;
- AI selects from Engine-provided legal Moves and does not inspect hidden information;
- Simulator drives production modules rather than duplicating their logic.

## 3.4 Reproducibility

A failing headless execution must be reproducible from recorded configuration and seed data wherever deterministic execution applies.

## 3.5 Long-run reliability

Large batches of Sessions must terminate without:

- illegal accepted Moves;
- infinite loops;
- state corruption;
- score corruption;
- unrecoverable controller deadlock;
- unhandled invariant failures.

---

# 4. Test Layers

```text
                     Headless Simulator
             stress / regression / AI analysis
                         /       \
                        /         \
               Integration Tests
              real module boundaries
                       |
                       |
                   Unit Tests
             isolated correctness
```

These layers are complementary rather than substitutes.

A simulation that completes successfully does not prove every Straight edge case is correct. A perfect Straight unit-test suite does not prove the Orchestrator can run five Rounds. Both are required.

---

# 4.1 Phase 1 Quality Gates

- **M1 Engine gate:** Basic house rules, state transitions, five-Round Session, views/events/invariants pass. Competitive tests are deferred.
- **M2 Headless-game gate:** four deterministic Baseline controllers complete real Basic Sessions through the Orchestrator with no illegal accepted Moves or hidden-information dependency.
- **M3 Simulator gate:** repeated seeded Basic Sessions terminate, invariants hold, failures are reproducible, and performance is measured without redefining correctness.
- **M4 UI/Phase gate:** a human can complete the five-Round Basic product flow against Baseline bots; UI does not duplicate Engine legality/rules; critical interaction and integration tests pass.

Phase 1 is not blocked by deferred Competitive, advanced-AI, persistence, or post-Phase-1 tests.

# 5. Unit Test Strategy

Unit tests should be:

- fast;
- deterministic;
- isolated;
- explicit about expected behavior;
- focused on one primary failure cause;
- easy to diagnose when they fail.

Unit tests should normally use pure functions or minimal Engine state wherever practical.

Mocks should be used only when the dependency is not the subject of the test. Do not mock rule logic merely to make a rule test easier.

---

# 6. Shared Domain Unit Tests

The Domain layer contains little behavior, so tests should focus on contract stability and assumptions required by other modules.

At minimum verify:

- all 13 canonical `Rank` values are representable;
- all 4 canonical `Suit` values are representable;
- `Card` identity is uniquely determined by Rank + Suit;
- `Move` discriminated-union behavior distinguishes Play from Pass;
- `CombinationType` contains exactly the supported v1 Combination types;
- shared domain types contain no authoritative Engine-only fields such as comparison strength or hidden state.

Compile-time type tests may be used where runtime tests add little value.

---

# 7. Engine Unit Tests

The Engine receives the highest unit-test coverage because it is the authoritative gameplay subsystem.

## 7.1 Deck construction

Verify:

- deck has exactly 52 Cards;
- every Rank appears exactly four times;
- every Suit appears exactly thirteen times;
- every Rank/Suit pair appears exactly once;
- no joker or unsupported Card exists;
- 3♣ exists exactly once;
- 2♦ exists exactly once.

## 7.2 Shuffle and deterministic RNG

Verify:

- shuffle preserves all 52 Cards;
- shuffle does not duplicate or remove Cards;
- identical deterministic RNG configuration produces identical shuffled order;
- different seeds are capable of producing different valid orders;
- Engine code does not depend on uncontrolled `Math.random()` for authoritative shuffle behavior.

Statistical shuffle-quality testing is not a POC correctness gate, but gross implementation defects should be detectable later through simulation/analysis.

## 7.3 Deal

Verify:

- exactly four players receive Cards;
- each receives exactly 13 Cards;
- all 52 Cards are distributed exactly once;
- no dealt Card exists in two hands;
- the player with 3♣ can be identified from authoritative state.

## 7.4 Rank comparison

Verify complete Rank ordering:

```text
3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A < 2
```

Include boundary assertions:

- 3 is lower than every other Rank;
- 2 is higher than every other Rank;
- A < 2;
- 10 < J.

## 7.5 Suit comparison

Verify:

```text
Clubs < Spades < Hearts < Diamonds
```

Include boundary assertions:

- 3♣ is the lowest Single in the game;
- 2♦ is the highest Single in the game.

## 7.6 Single detection/comparison

Verify:

- one Card is a Single;
- higher Rank wins;
- equal Rank uses Suit;
- invalid multi-card input is not classified as Single.

## 7.7 Pair detection/comparison

Verify:

- exactly two equal-Rank Cards form a Pair;
- two different Ranks do not form a Pair;
- Pair comparison follows the confirmed Rank/Suit rules;
- pair-generation does not create duplicates or omit valid suit combinations.

## 7.8 Triple detection/comparison

Verify:

- exactly three equal-Rank Cards form a Triple;
- mixed Ranks are invalid;
- Triple comparison follows the confirmed house rule;
- generated Triples are complete and unique.

## 7.9 Straight validity

The following cases require explicit named regression tests because they differ from common poker/Big-Two implementations.

Valid Straight property sequences regardless of suits:

- `A-2-3-4-5`;
- `2-3-4-5-6`;
- `3-4-5-6-7`;
- every normal consecutive five-Rank sequence through `10-J-Q-K-A`;
- `J-Q-K-A-2`.

Invalid Straight property sequences:

- `K-A-2-3-4`;
- `Q-K-A-2-3`;
- duplicate-Rank five-card sets that cannot be a Straight;
- any nonconsecutive unsupported sequence.

Tests must include representative mixed-suit and same-suit examples. A same-suit valid house-rule sequence must pass Straight property detection; final five-card classification is tested separately and must select Straight Flush when Straight and Flush overlap. Verify that a borrowed Straight algorithm has been adapted to these exact house rules.

## 7.10 Straight strength

Verify complete effective ordering:

```text
A2345 < 23456 < 34567 < ... < 10JQKA < JQKA2
```

For equal effective-high Straights, verify Suit tiebreak uses the Suit of the effective high Card defined by the house rules:

- A2345 uses the 5;
- 23456 uses the 6;
- normal Straights use their effective high Card;
- JQKA2 uses the 2.

## 7.11 Flush validity/comparison

Verify:

- every five-Card set of one Suit satisfies the Flush property, including a set whose Ranks also form a valid house-rule sequence;
- mixed Suits do not satisfy the Flush property;
- Flush comparison uses Suit before Rank comparison;
- Diamonds > Hearts > Spades > Clubs;
- for equal Suit, descending Rank comparison breaks ties;
- external poker-style Rank-first Flush comparison is rejected.

## 7.12 Full House validity/comparison

Verify:

- `3 + 2` Rank-count structure is valid;
- other count patterns are invalid;
- Full House strength is determined only by Triple Rank;
- Pair Rank does not override Triple Rank.

## 7.13 Four-of-a-Kind validity/comparison

Verify:

- exactly four equal-Rank Cards plus one kicker is valid;
- strength is determined only by the four-card Rank;
- kicker does not affect strength;
- multiple possible kickers create distinct playable Card sets but identical Combination strength when the quad Rank is identical.

This explicitly protects the project from generic evaluators that use kicker comparison.

## 7.14 Straight Flush validity/comparison

Verify:

- a same-suit valid house-rule sequence satisfies both Straight and Flush property checks;
- final canonical classification selects Straight Flush because it is the highest-ranking applicable category;
- all project-specific Straight forms are supported where Suit-valid;
- comparison uses Straight effective high then the Suit of its effective high Card;
- house-rule Straight ordering is preserved.

## 7.15 Five-card hierarchy

Verify:

```text
Straight < Flush < Full House < Four-of-a-Kind < Straight Flush
```

Explicitly test every adjacent hierarchy boundary and representative nonadjacent boundaries.

## 7.16 Cross-type five-card responses

Verify legal beating behavior such as:

- Flush beats Straight;
- Full House beats Straight and Flush;
- Four-of-a-Kind beats Straight, Flush, and Full House;
- Straight Flush beats all lower five-card types;
- lower hierarchy cannot beat higher hierarchy regardless of internal Card strength;
- same hierarchy compares using that Combination type's own comparison rule.

## 7.17 Opening Move

Verify:

- first successful Play of a Round must contain 3♣;
- Single 3♣ is valid;
- Pair/Triple/Five-card Combination containing 3♣ is valid if the Combination itself is legal;
- valid Combination lacking 3♣ is rejected as Opening Move;
- Pass is rejected when the player must make the Opening Move;
- the player holding 3♣ is the opening player.

## 7.18 Pass validation

Verify:

- Pass is permitted when responding to an existing current Combination;
- voluntary Pass remains legal even when the player possesses a legal beating Play;
- Pass does not imply absence of a legal Play;
- Pass is rejected on a required free lead/opening lead when rules require a Play.

The voluntary-Pass test is important because AI inference must not treat Pass as proof of hidden-hand impossibility.

## 7.19 Legal Move generation

For representative hands and Trick states verify:

- every returned Play is legal;
- every returned Card belongs to the acting player;
- no duplicate Move appears;
- all expected legal Plays are present;
- illegal Plays are absent;
- Pass inclusion/exclusion follows current lead/response rules;
- five-card cross-type responses are included correctly;
- Opening Move list contains only Plays containing 3♣;
- free-lead generation allows all valid Combination categories.

### 7.19.1 Reference-vs-optimized equivalence

If legal Move generation is later optimized, maintain a simple trusted/reference generator for test use where practical.

For randomized small/normal hands, compare:

```text
referenceLegalMoves(state) == optimizedLegalMoves(state)
```

using canonical Move-set normalization rather than enumeration order.

This is strongly recommended when replacing brute-force generation with structure-aware or bitmask generation.

## 7.20 Move validation atomicity

Verify:

- illegal Move returns a structured rejection;
- authoritative state is unchanged after rejection;
- no Card is removed on rejection;
- Turn owner does not incorrectly advance;
- no scoring/event side effect occurs for a rejected Move unless explicitly defined as diagnostic-only.

## 7.21 Trick progression

Verify:

- accepted Play becomes current Combination;
- Turn advances clockwise among eligible active players;
- Pass tracking is correct;
- when all other eligible active players Pass, Trick ends;
- last successful player obtains free lead when still active;
- prior Trick comparison requirement is cleared for a new Trick;
- stale Pass counts do not leak into the next Trick.

## 7.22 Finished-player rotation

Verify:

- player with zero Cards is marked finished at the correct time;
- finished player leaves normal Turn rotation;
- no finished player receives another normal Turn request;
- finish order contains no duplicate PlayerId;
- active-player traversal remains clockwise.

## 7.23 Basic Mode continuation after finish

Explicitly test the confirmed special case:

When a player empties their hand with a final Combination:

- record their finish position;
- remove them from active rotation;
- inspect active players clockwise from the next active player;
- if an active player can legally beat the outgoing final Combination, normal response play continues from the first such player reached in Turn order;
- if no active player can beat it, the next active player receives a free lead.

Include scenarios with:

- three active players remaining;
- two active players remaining;
- immediate next active player able to beat;
- immediate next active player unable but a later active player able to beat;
- nobody able to beat.

## 7.24 Basic Mode Round ending/scoring

Verify:

- Round continues until only one player remains with Cards;
- first three finishers become 1st/2nd/3rd;
- remaining player becomes 4th;
- scores are exactly `+5/+3/+2/0`;
- Round result and cumulative Session totals are correct.

## 7.25 Competitive Mode Round ending — Deferred

Verify:

- Round ends immediately when the first player empties their hand;
- remaining players receive no additional Turns;
- no official loser placement is required for Session tiebreaking;
- no post-win gameplay Move is accepted.

## 7.26 Competitive base penalty

Boundary tests are mandatory:

- 0 remaining Cards for winner;
- 1 remaining Card;
- 9 remaining Cards uses ×1 base;
- 10 remaining Cards uses ×2 base;
- 13 remaining Cards uses ×2 base.

## 7.27 Unused Bomb detection

For a losing player's final hand verify one boolean unused-bomb multiplier is triggered by at least one of:

- any remaining 2;
- all four Cards of one Rank;
- any valid Straight Flush under the project's Straight rules.

Verify:

- multiple 2s still produce only one ×2;
- four-of-a-kind + 2 still produce only one unused-bomb ×2;
- Straight Flush + 2 still produce only one unused-bomb ×2;
- invalid pseudo-Straights such as `KA234` do not produce Straight Flush bomb qualification.

## 7.28 Winner-final-play multiplier

Verify a winner-final-play ×2 applies when final Combination contains/qualifies as defined by requirements:

- a 2 in any valid final Combination;
- Four-of-a-Kind;
- Straight Flush.

Verify multiple qualifying properties still produce only one winner-final-play ×2.

## 7.29 Competitive multiplier stacking

Verify independent boolean multipliers combine as:

```text
base × unusedBomb(1 or 2) × winnerFinal(1 or 2)
```

Maximum combined multiplier from these two conditions is ×4, not ×8 or higher.

## 7.30 Competitive zero-sum scoring

Verify:

- each loser receives the authoritative negative penalty convention defined by Engine/product contracts;
- winner receives the positive sum collected from all losing players;
- all four Round scores sum to zero.

The exact sign representation should follow Engine contracts consistently in all tests.

## 7.31 Session lifecycle

Verify:

- Session starts with Round 1;
- exactly five Rounds complete;
- no sixth Round can begin;
- cumulative Session totals equal sum of authoritative Round results;
- completed Session rejects further gameplay progression.

## 7.32 Basic Session tiebreak

Verify order:

1. Session total;
2. most Round wins;
3. lowest average placement;
4. highest single best-Round score;
5. genuine tie.

Create fixtures where each successive criterion is required.

## 7.33 Competitive Session tiebreak

Verify order:

1. Session total;
2. most Round wins;
3. highest single best-Round score;
4. genuine tie.

Verify average loser placement is **not** used.

## 7.34 Engine views and information safety

Verify `PlayerView` for player A:

- exposes A's own hand;
- does not expose unrevealed opponent Cards;
- exposes only confirmed public facts;
- exposes opponent Card counts where defined;
- exposes public played-card information where defined;
- does not expose opponent difficulty/personality;
- does not expose internal Engine-only state that can reveal hidden information.

Test all four seat perspectives against the same authoritative state.

## 7.35 Engine events

For each important state transition verify:

- expected factual event type emitted;
- event payload matches resulting authoritative fact;
- event ordering is deterministic where contractually meaningful;
- rejected Move does not emit a false successful-play event;
- scoring/result events match authoritative score state.

Exact formatting is not tested here; formatting belongs to future `events-logging.md`.

---

# 8. Engine Invariant Tests

Invariant checks should exist as reusable assertions rather than being duplicated ad hoc across tests.

Recommended assertions:

```text
assertUniqueCards(state)
assertCardConservation(state)
assertValidHandOwnership(state)
assertValidCurrentPlayer(state)
assertFinishedPlayersHaveZeroCards(state)
assertNoFinishedPlayerInNormalRotation(state)
assertValidTrickState(state)
assertValidFinishOrder(state)
assertValidRoundLifecycle(state)
assertValidSessionLifecycle(state)
assertValidScores(state)
```

## 8.1 Card conservation

At every normal Round state:

```text
Cards currently held
+ Cards authoritatively played/removed according to state model
= exactly the original 52 unique Cards
```

The exact accounting buckets depend on Engine state representation, but every physical Card must be accounted for exactly once.

## 8.2 Invariant execution policy for POC

For the POC, favor aggressive invariant checking in tests and simulation even if it adds execution cost or memory overhead.

Future production builds may make some expensive invariant checks debug-only after profiling, but the public behavior must remain unchanged.

---

# 9. AI Unit Tests

AI unit tests verify evaluation behavior without making AI authoritative for legality.

## 9.1 Legal-set compliance

For every AI decision:

- returned Move is exactly one of the Engine-provided legal Moves;
- AI never manufactures a Move that was not supplied;
- AI does not alter Card identity.

## 9.2 Determinism

Given identical:

- `PlayerView`;
- legal Move set;
- game mode;
- personality;
- difficulty;
- Session context;

initial v1 AI must return the same Move.

## 9.3 Hidden-information safety

Construct test doubles/contracts that make hidden opponent hands available only outside the AI input.

Verify AI output is unchanged when hidden opponent Cards are changed but all permitted public information is identical.

This is a strong anti-cheating test.

## 9.4 Opponent metadata safety

Verify AI does not receive or use:

- opponent difficulty;
- opponent personality.

## 9.5 Pass inference safety

Two states with identical public facts except private reasons for an opponent's earlier Pass must not allow AI to infer that the opponent lacked a legal response.

Initial AI should treat Pass as an observed public action only, not hard evidence of hidden-hand impossibility.

## 9.6 Minimum-play solver

For known hands verify exact minimum number of future plays.

Include:

- all Singles;
- obvious Pair/Triple decompositions;
- one five-card Combination + remaining Singles;
- overlapping Straight/Flush/Full-House opportunities;
- hands where greedy largest-Combination choice is not minimum-play optimal;
- special project Straights;
- `JQKA2`;
- invalid `KA234` not used as a valid decomposition.

## 9.7 MinPlay memoization equivalence

Verify memoized and nonmemoized/reference computation return identical results for a representative/randomized corpus.

Caching may change runtime, never result.

## 9.8 Canonical lowest-set-bit optimization equivalence

If the solver uses canonical remaining-card/lowest-set-bit pruning, compare its result against an exhaustive reference solver on manageable hand sizes.

The optimization must remove duplicate partition exploration only; it must not remove any valid partition class.

## 9.9 Basic vs Competitive evaluation

Use identical Card position/legal candidate sets where mode incentives should rationally differ.

Verify evaluator can rank candidates differently because:

- Basic values final placement;
- Competitive values immediate win and penalty exposure.

Do not assert arbitrary exact numerical scores unless those weights are intentionally stable contracts.

## 9.10 Competitive penalty exposure

Verify candidate evaluation recognizes:

- crossing 10 remaining Cards to 9 changes base exposure;
- removing a 2 can remove unused-bomb exposure;
- breaking a four-of-a-kind may remove or change bomb exposure as defined by resulting hand;
- breaking a Straight Flush may remove qualifying bomb exposure;
- immediate Round-end threat changes urgency.

## 9.11 Session-aware behavior

Use fixtures where current Round-only utility conflicts with final Session utility.

Verify Session context is capable of changing selected candidate when strategically justified.

Examples:

- Round 5 Basic leader protects against the only rival capable of overtaking;
- Competitive leader avoids catastrophic penalty exposure when a risky line offers only a small current-Round upside.

Tests should verify policy direction, not force fragile exact evaluator weights unless needed for regression.

## 9.12 Difficulty profiles — Deferred

Verify:

- Easy uses Easy capability profile;
- Normal uses Normal profile;
- Hard uses Hard profile;
- all receive the same fair-information entitlement;
- Easy does not intentionally choose an irrational/illegal Move merely to lose;
- Hard does not gain access to hidden information;
- search budgets/profile features differ as designed.

## 9.13 Search bounds

Verify bounded search respects configured:

- maximum depth;
- maximum node count;
- endgame activation threshold;
- cancellation/termination condition where implemented.

A bounded-search limit is a safety/reliability mechanism. For the POC, exact millisecond deadlines are not required as deterministic correctness gates.

## 9.14 Candidate pruning safety

Any future candidate-pruning optimization must be tested against an unpruned/reference evaluator on controlled positions.

If pruning cannot be proven semantics-preserving, it should be conservative and must not be enabled merely for speed during the accuracy-first POC.

---

# 10. Orchestrator Unit Tests

The Orchestrator should be tested with fake/stub controllers and a real Engine wherever practical.

## 10.1 Controller mapping

Verify:

- exactly one controller per `PlayerId`;
- missing mapping fails clearly;
- duplicate/mismatched mapping fails clearly;
- controller metadata does not redefine Engine player identity.

## 10.2 Turn request routing

Verify:

- only Engine-current player controller is called;
- exactly one active Turn request exists;
- `PlayerView` belongs to the acting player;
- legal Moves come from Engine;
- returned Move is submitted exactly once.

## 10.3 Rejected Move coordination

Verify:

- Orchestrator does not repair/rewrite invalid Move;
- Engine rejection is preserved;
- human can retry same Turn;
- repeated invalid AI response cannot create an unbounded infinite retry loop;
- no replacement rule decision is invented by Orchestrator.

The exact AI invalid-Move retry/escalation policy remains an open Orchestrator implementation decision and should not be silently invented by tests.

## 10.4 Round Result checkpoint

Verify:

- completed Round enters Round Result lifecycle state;
- no controller Turn request exists during checkpoint;
- normal human flow does not automatically start next Round;
- explicit continuation starts exactly one next Round;
- duplicate continuation does not start duplicate Rounds.

## 10.5 Headless auto-continuation

Verify:

- simulator/headless policy can automatically continue through Round Result checkpoint;
- it uses the same GameRunner continuation mechanism rather than bypassing it;
- UI and headless modes do not use separate rules loops.

## 10.6 Session completion

Verify:

- no controller is requested after Session completion;
- no sixth Round begins;
- final Engine result remains observable.

## 10.7 Async/stale response safety

Even though the initial simulator is headless, asynchronous controller safety must be unit-tested because the same Orchestrator is intended for future UI/network controllers.

Verify:

- stale `requestId` response ignored;
- cancellation invalidates pending response;
- double resolution cannot create two Moves;
- previous Turn response cannot affect later Turn.

## 10.8 Boundary checks

Verify through dependency tests/static rules where practical:

- Orchestrator does not import React;
- Orchestrator does not use `localStorage`;
- Orchestrator does not implement scoring/comparison algorithms;
- Engine never calls controllers;
- controllers cannot directly mutate authoritative state.

---

# 11. Integration Test Strategy

Integration tests validate real subsystem collaboration through public contracts.

Mocks should be minimized.

Preferred real stack:

```text
Domain
  ↓
Real Engine
  ↓
Real GameRunner / Orchestrator
  ↓
Real or controlled PlayerControllers
```

Use controlled/scripted controllers when a precise scenario is required. Use real AI Controllers when testing the AI integration itself.

---

# 12. Integration Test Categories

## 12.1 Engine + Orchestrator startup

Given a fixed four-player configuration:

- Session is created;
- Round is started through Engine;
- 3♣ holder becomes current player;
- correct controller is requested;
- controller receives only its safe view and legal Move set.

## 12.2 Scripted one-Trick integration

Use scripted controllers to force:

- lead;
- legal response;
- voluntary Pass;
- remaining Passes;
- Trick reset;
- free lead.

Verify Engine state/events and Orchestrator routing after every action.

## 12.3 Opening integration

With deterministic deal:

- identify 3♣ holder;
- ensure only that controller acts first;
- ensure controller legal set obeys opening restriction;
- submit valid 3♣-containing Combination;
- confirm normal Turn flow begins.

## 12.4 Basic finished-player integration

Use a controlled near-end state where one player goes out.

Verify full Engine + Orchestrator behavior for:

- finish recording;
- removal from rotation;
- continuation against final Combination when beatable;
- fallback free lead when not beatable.

## 12.5 Complete Basic Round

Execute a deterministic scripted/AI Basic Round to completion using real Engine and GameRunner.

Verify:

- 1st/2nd/3rd/4th established correctly;
- 5/3/2/0 scoring;
- Round Result checkpoint;
- no automatic normal-human continuation;
- cumulative Session totals updated.

## 12.6 Complete Competitive Round

Execute a deterministic Round to first-out completion.

Verify:

- immediate stop;
- no loser follow-up Turns;
- base penalties;
- unused-bomb multiplier;
- winner-final multiplier;
- zero-sum score;
- detailed scoring breakdown where Engine contract provides it;
- Round Result checkpoint.

## 12.7 Complete five-Round Basic Session

Run five Rounds with automatic headless continuation.

Verify:

- exactly five Rounds;
- every Round complete;
- cumulative scores equal Round sum;
- Basic tiebreak applies correctly;
- Session stops cleanly.

## 12.8 Complete five-Round Competitive Session

Verify same lifecycle with Competitive scoring and Competitive-specific tiebreak order.

## 12.9 Real AIController integration

Run real Optimizer AI through GameRunner and Engine.

Verify:

- AI receives safe view;
- AI returns Engine legal Move;
- Engine accepts returned Move under normal operation;
- no hidden state is passed through Orchestrator;
- all four AI controllers can act as distinct seats.

## 12.10 Difficulty integration

Run Sessions with per-bot Easy/Normal/Hard configuration.

Verify configuration reaches correct AI profile while opponent difficulty remains unavailable as strategic input.

## 12.11 Deterministic replay integration

Given fixed configuration and Engine seed:

- run same Session twice;
- compare deal sequence;
- compare Move sequence;
- compare Engine events;
- compare Round results;
- compare Session result.

For initial deterministic AI, all should match exactly unless a documented non-gameplay field is intentionally nondeterministic.

## 12.12 Error-path integration

Use a deliberately faulty test controller to return an invalid Move.

Verify:

- Engine rejects;
- state remains valid;
- Orchestrator follows its configured error/retry policy;
- simulator reports failure with reproduction context rather than hanging indefinitely.

---

# 13. Integration Test Invariants After Every Turn

Integration helpers should optionally assert invariants after **every accepted Move**, not only at Round end.

Recommended sequence:

```text
controller returns Move
        ↓
Engine processes Move
        ↓
assert Engine result success/rejection expectations
        ↓
assert card conservation
assert current-player validity
assert hand sizes
assert finished-player validity
assert Trick validity
assert Round/Session lifecycle validity
assert score invariants if score changed
        ↓
continue
```

This turns long-game failures into local failures near the actual defect.

---

# 14. Test Fixtures and Scenario Builders

Hand-writing complete Engine states directly is error-prone and can create impossible test fixtures.

Prefer controlled fixture builders such as:

```text
card("3C")
hand("3C 3S 4C ...")
buildRoundState(...)
buildTrick(...)
buildSession(...)
scriptedController([...moves])
```

Fixture builders must validate their own basic assumptions where practical:

- no duplicate Cards;
- valid PlayerIds;
- hand counts consistent with state phase;
- current Trick compatible with public history;
- finished players have zero Cards.

For tests that intentionally construct invalid internal state to test invariant detection, mark the fixture explicitly as unsafe/invalid.

---

# 15. Golden Regression Fixtures

When a real bug is discovered, add the smallest reproducible fixture as a permanent regression test.

Examples:

```text
regressions/
  straight-a2345-suit-tiebreak.test.ts
  basic-final-play-continuation.test.ts
  competitive-unused-bomb-straightflush.test.ts
  trick-pass-reset-after-finished-player.test.ts
```

A fixed simulator seed that exposes a bug should also be preserved as a regression scenario until a smaller direct fixture is available.

Bug fixes should ideally add:

1. a focused unit test for root cause;
2. an integration/simulation regression when the defect required module interaction.

---

# 16. Property and Generative Testing

Property-based testing is recommended after the basic deterministic unit suite is stable.

It is useful for discovering combinations developers did not manually enumerate.

Possible properties:

## 16.1 Combination classifier consistency

For arbitrary distinct Card subsets of supported sizes:

- classifier either returns one valid canonical Combination or rejects;
- returned Combination contains exactly the submitted Cards;
- classification is independent of input Card ordering.

## 16.2 Comparison antisymmetry

For comparable distinct Combinations A and B:

```text
if A > B, then B < A
```

## 16.3 Comparison transitivity

Where applicable:

```text
if A > B and B > C, then A > C
```

## 16.4 Legal-Move soundness

Every generated legal Play should pass authoritative validation.

## 16.5 Legal-Move completeness against reference generator

For states where a trusted reference enumerator is available, optimized and reference Move sets must match.

## 16.6 State conservation

For arbitrary legal Move sequences, Card conservation and lifecycle invariants remain true.

Property testing must use reproducible seeds and report failing seed/input.

---

# 17. Mutation Testing --- Future Quality Tool

Mutation testing may be considered after POC stabilization to verify tests actually detect broken rules.

Examples of valuable mutations:

- swap Hearts/Spades order;
- treat A2345 as invalid;
- allow KA234;
- make Four-of-a-Kind kicker significant;
- change Competitive threshold from 10 to 9;
- stack multiple unused bombs repeatedly;
- use Basic average placement tiebreak in Competitive.

The suite should kill these mutations.

Mutation testing is **not required for initial POC completion** because it may be slow, but the design should not prevent it later.

---

# 18. Headless Simulator Purpose

The Headless Simulator is a permanent developer/QA tool, not throwaway test code.

It should run the same production-oriented modules used by eventual UI gameplay:

```text
SimulationRunner
      │
      ▼
GameRunner / Orchestrator
      │
      ├── AIController North
      ├── AIController East
      ├── AIController South
      └── AIController West
      │
      ▼
Game Engine
      │
      ▼
Events / Results / Metrics
```

The simulator must not contain a second implementation of:

- Turn order;
- legal Move rules;
- Combination comparison;
- Round ending;
- scoring;
- Session tiebreaking.

It drives and observes; it does not redefine gameplay.

---

# 19. Simulator Execution Modes

The POC should support at least these conceptual modes.

## 19.1 Single Session

Run one full five-Round Session and print/return detailed diagnostics.

Primary use:

- development debugging;
- verifying a new feature;
- inspecting AI choices.

## 19.2 Batch Sessions

Run N Sessions without artificial delays.

Primary use:

- reliability/stress testing;
- AI balancing;
- performance measurement.

## 19.3 Reproduce Seed

Run one exact previously recorded configuration/seed.

Primary use:

- bug reproduction;
- regression verification.

## 19.4 Scenario/Fixture Run

Start from a controlled legal state rather than a freshly shuffled Session.

Primary use:

- endgame behavior;
- scoring boundaries;
- AI tactical evaluation;
- difficult reproduction cases.

---

# 20. Simulator Configuration

Conceptual configuration may include:

```ts
interface SimulationConfig {
  readonly mode: GameMode;
  readonly sessionCount: number;
  readonly engineSeed: string | number;
  readonly players: readonly SimulationPlayerConfig[];
  readonly ruleset: RulesetConfig;
  readonly invariantChecks: boolean;
  readonly decisionTracing: DecisionTraceLevel;
  readonly eventCapture: EventCaptureLevel;
}
```

Exact type ownership/names may change during implementation.

The simulator owns batch configuration; it should not push simulation-only fields into `/domain`.

---

# 21. Artificial Delay Policy

Headless simulation must contain **no artificial bot thinking delay**.

Actual AI compute time may vary by device and difficulty.

Presentation pacing belongs to UI/application concerns.

Therefore:

```text
AI compute time != simulated human-facing delay
```

Simulator throughput should reflect actual computation plus test/diagnostic overhead only.

---

# 22. Simulator Determinism and Reproduction Metadata

A reproducible run should record enough metadata to reconstruct gameplay.

For initial deterministic AI, recommended metadata:

- simulator/test version or git commit when available;
- ruleset identifier/snapshot;
- game mode;
- Engine RNG seed;
- player seat order;
- each player's AI personality;
- each player's difficulty;
- any AI search configuration that materially changes behavior;
- initial Session configuration.

Because initial AI has no controlled move randomness, separate AI RNG state is not required unless future controlled randomness is introduced.

If future AI randomness is added, its seed/state must then become part of replay metadata.

---

# 23. Simulator Invariants

For POC reliability runs, invariant checks should default to enabled.

After every accepted Move, verify at least:

- all Cards accounted for exactly once;
- acting player was current player;
- accepted Move belonged to acting player;
- accepted Move was legal;
- hand decreased by exact played Card count;
- finished status consistent with zero Cards;
- current Turn points to eligible player or lifecycle checkpoint;
- Trick state is internally valid;
- no duplicate finish entry;
- completed Round accepts no new normal Move;
- Session score equals completed Round aggregation;
- completed Session cannot progress.

For Competitive Round completion additionally verify:

- Round stopped on first-out event;
- loser penalties follow formula;
- Round total is zero-sum.

For Basic Round completion additionally verify:

- all four placements are defined exactly once;
- scores map to 5/3/2/0.

---

# 24. Simulator Failure Policy

A simulation failure should fail loudly rather than silently skip the game.

Failure report should capture:

```text
failure type
Session index
Round number
Turn index
Engine seed
mode
seat configuration
AI configurations
current public state
acting player
legal Moves
chosen Move
recent GameEvents
AI DecisionTrace if enabled
invariant/error message
```

Do not require hidden opponent hands in standard user-facing logs, but developer-only simulator failure artifacts may include authoritative state where necessary to diagnose Engine defects. Such diagnostic data remains test tooling, not AI input.

The simulator should stop immediately on invariant corruption by default during development.

A future large batch mode may optionally collect multiple independent failures, but continuing after corrupted authoritative state risks producing misleading metrics.

---

# 25. Infinite-Loop / Progress Protection

The real rules should terminate naturally, but a software defect or faulty controller could stall execution.

The simulator should have a **diagnostic safety guard**, such as a generous maximum Turn/action count per Round/Session.

This guard is not a game rule and must never be used to decide a legitimate winner.

If exceeded:

- mark run failed;
- capture reproduction metadata;
- report recent actions/events;
- stop that execution.

The exact threshold is an implementation detail and should be set far above any realistic legitimate game length so it detects software loops rather than influences gameplay.

---

# 26. Simulation Metrics --- Reliability First

Initial POC metrics should prioritize correctness.

Track:

- Sessions requested;
- Sessions completed;
- Rounds completed;
- total Turns/Moves;
- rejected AI Moves;
- invariant failures;
- simulator guard failures;
- uncaught exceptions;
- deterministic replay mismatches.

POC reliability target before UI work should be **zero known correctness failures** across a meaningful batch selected by the team after initial implementation maturity.

Do not treat a high Session count as proof of correctness if targeted unit/integration coverage is incomplete.

---

# 27. Simulation Metrics --- AI Quality

After reliability is established, collect:

- Session wins by difficulty;
- final Session rank by difficulty;
- Basic average Session score;
- Competitive average Session score;
- Round wins;
- average cards remaining at Competitive loss;
- frequency of each Combination type played;
- Pass frequency;
- free-lead frequency;
- unused-bomb exposure at Competitive Round end;
- winner-final multiplier frequency;
- AI minimum-play estimate distribution where useful;
- AI decision-score components where tracing is enabled.

These metrics support tuning but do not redefine correct behavior.

---

# 28. Simulation Metrics --- Performance

Because POC priority is correctness > speed > memory, performance should initially be **measured rather than used as a strict pass/fail gate**.

Track distributions such as:

- Engine legal-Move generation duration;
- AI decision duration by difficulty;
- MinPlay solver duration;
- search node counts;
- cache hits/misses where useful;
- total Session runtime;
- batch throughput.

Prefer percentiles rather than averages alone:

```text
p50
p90
p95
p99
max
```

Exact performance budgets should be defined after profiling representative desktop and mobile-class environments.

A slower device may take longer without being considered incorrect.

However, unbounded growth, runaway search, or accidental exponential behavior that prevents practical completion is a reliability issue and should be fixed even during the POC.

---

# 29. Memory and Cache Measurement

Memoization is encouraged for the POC where it improves clarity/reliability/performance.

Measure later:

- cache entry count;
- cache hit rate;
- approximate cache memory where practical;
- whether caches are per-decision, per-Round, per-Session, or global;
- whether long batch runs cause unbounded growth.

Initial policy:

> Prefer a correct, understandable cache over premature cache compression or eviction.

Future optimization may introduce:

- bounded caches;
- per-Round cache reset;
- compact bitsets;
- smaller memoization payloads;
- precomputed tables;
- specialized legal-Move generators.

These changes must preserve result equivalence.

---

# 30. AI Difficulty Evaluation Methodology

The desired long-run ordering is:

```text
Hard > Normal > Easy
```

statistically under fair conditions.

This is not guaranteed in every deal or Session.

## 30.1 Seat rotation

To reduce seat/deal bias, matchup experiments should rotate difficulty/personality assignments through all four seats.

## 30.2 Shared seed sets

When comparing AI versions/difficulties, use common seed sets where practical so they face comparable deal distributions.

## 30.3 Multiple modes

Evaluate Basic and Competitive separately because objectives and score distributions differ.

## 30.4 Statistical interpretation

Do not declare one difficulty superior from a tiny sample.

Report sample count and uncertainty where practical.

Formal statistical tests may be added later if tuning decisions become sensitive.

## 30.5 No artificial losing

If Easy performs too strongly, weaken its reasoning capability according to `ai.md`; do not inject obviously bad Moves merely to force target win rates.

---

# 31. Deterministic Regression Strategy

Initial deterministic AI provides a major debugging advantage.

Maintain a curated seed suite containing:

- ordinary Sessions;
- edge-case Straights;
- multiple five-card cross-type battles;
- Basic finish-continuation cases;
- Competitive unused-bomb cases;
- Competitive winner-final multiplier cases;
- Session tiebreak cases;
- previously failing production/simulation seeds.

A deterministic replay mismatch should be investigated.

Not every internal refactor must preserve the exact historical AI Move sequence if AI evaluation intentionally changes, but Engine rule outcomes and explicitly frozen regression scenarios must remain correct.

When intentional AI changes alter deterministic Move selection, update expected AI snapshots only after confirming the new behavior is valid and desired.

---

# 32. Snapshot Testing Policy

Snapshot tests may be used for structured diagnostics/event sequences, but they should not replace semantic assertions.

Avoid giant opaque snapshots of complete Engine state.

Prefer assertions such as:

```text
expect(result.roundWinner).toBe("P2")
expect(result.scores).toEqual(...)
expect(events).toContainEqual(...)
```

Use snapshots only when reviewing the complete structured output is genuinely useful and stable.

---

# 33. Test Naming Convention

Tests should describe behavior and condition, for example:

```text
accepts A2345 as weakest Straight
rejects KA234 as Straight
compares Flush by Suit before Rank
ignores kicker when comparing Four-of-a-Kind
continues Basic trick after outgoing player's final play when beatable
skips average placement in Competitive Session tiebreak
rejects invalid Move without state mutation
Hard AI cannot access hidden opponent hands
same seed reproduces full deterministic Session
```

Avoid generic names such as `works`, `test1`, or `edge case`.

---

# 34. Proposed Test Source Structure

```text
src/
  domain/
  engine/
  orchestrator/
  ai/
  simulation/
    SimulationRunner.ts
    SimulationConfig.ts
    SimulationResult.ts
    SimulationFailure.ts
    metrics/
    reporters/
    scenarios/

tests/
  unit/
    domain/
    engine/
      cards/
      combinations/
      moves/
      turn/
      round/
      scoring/
      session/
      views/
      invariants/
    orchestrator/
    ai/

  integration/
    engine-orchestrator/
    engine-orchestrator-ai/
    sessions/
    regressions/

  simulation/
    smoke/
    reliability/
    deterministic/
    balancing/
    performance/

  fixtures/
    cards/
    rounds/
    sessions/
    seeds/
```

Exact folder structure may be simplified during implementation. Ownership boundaries matter more than directory count.

---

# 35. Vitest Organization

Recommended logical suites:

- default fast unit suite;
- integration suite;
- short simulation smoke suite;
- long simulation/balancing suite;
- optional performance suite.

Long-running simulation should not make every local unit-test run slow.

Conceptually:

```text
npm test
npm run test:unit
npm run test:integration
npm run test:simulation:smoke
npm run simulate
npm run simulate:batch
```

Exact scripts may be decided during project setup.

---

# 36. Local Development Test Loop

Recommended developer loop:

```text
implement small behavior
        ↓
run focused unit test
        ↓
run affected module unit suite
        ↓
run relevant integration test
        ↓
run one/few headless Sessions
        ↓
commit when green
```

Before merging a meaningful Engine/AI/Orchestrator change:

```text
all unit tests
+ integration tests
+ headless simulation smoke batch
```

Long balancing/performance batches can run less frequently during POC development.

---

# 37. Continuous Integration --- Recommended

Once the repository has a stable build, CI should run at minimum:

1. TypeScript type check;
2. lint where configured;
3. unit tests;
4. integration tests;
5. short deterministic headless smoke batch.

Long large-scale simulation should initially be optional/manual or scheduled later so feedback stays fast.

CI should retain enough failure output to reproduce a failed seeded simulation.

---

# 38. POC Test Gates

The POC should progress through gates rather than attempting everything at once.

## Gate 1 --- Combination/Rule Core

Required:

- deck tests green;
- Rank/Suit tests green;
- all Combination detection tests green;
- all special Straight tests green;
- all comparison tests green;
- legal-Move generation basic tests green.

## Gate 2 --- Engine Round Core

Required:

- Opening Move tests green;
- Pass/Trick tests green;
- finished-player handling green;
- Basic full Round test green;
- Competitive full Round/scoring test green;
- Engine invariants green.

## Gate 3 --- Session Core

Required:

- five-Round Session lifecycle green;
- Basic tiebreak tests green;
- Competitive tiebreak tests green;
- deterministic shuffle/replay foundation green.

## Gate 4 --- Orchestrator Integration

Required:

- four controller mapping works;
- Turn routing correct;
- Round Result checkpoint correct;
- headless auto-continuation correct;
- no duplicated Turn request;
- full five-Round scripted Session through GameRunner succeeds.

## Gate 5 --- AI Integration

Required:

- AI returns legal Engine Move;
- hidden-information safety tests green;
- deterministic AI tests green;
- MinPlay tests green;
- Basic/Competitive evaluator tests green;
- four real AI controllers complete a Session.

## Gate 6 --- Headless POC Reliability

Required:

- repeated Sessions complete;
- no invariant failures;
- no illegal accepted Moves;
- no deadlocks/infinite loops;
- failures are reproducible by seed/config;
- performance metrics are captured, even if not yet gated.

Only after this gate should AI balancing/tuning become a major focus.

---

# 39. Definition of Done --- Headless POC

The headless POC is considered functionally complete when:

1. Project builds and type-checks.
2. Core Engine rules have comprehensive unit coverage, especially all confirmed house-rule deviations from generic poker/Big-Two rules.
3. Basic and Competitive Round flows pass integration tests.
4. Both mode-specific Session tiebreak paths are tested.
5. GameRunner completes a five-Round Session without React/UI.
6. Four real Optimizer AIControllers can complete complete Sessions.
7. Engine/Orchestrator invariants are checked during tests/simulation.
8. Initial deterministic run can be reproduced from configuration/seed.
9. Simulator can run a configurable batch of Sessions.
10. Simulator records sufficient failure context for reproduction.
11. No known correctness/invariant defect remains open at POC signoff.
12. Actual computation performance is measured but correctness is not sacrificed to meet arbitrary early timing targets.
13. Memory/caching behavior is observable enough to detect unbounded growth, but aggressive memory optimization is deferred until profiling justifies it.

The exact number of Sessions required for final stress confidence should be chosen after implementation performance is known rather than invented in advance.

---

# 40. Out of Scope for Initial Headless POC

The following are not required to prove the current headless POC:

- React component tests;
- visual regression testing;
- browser compatibility testing;
- PWA/offline-cache testing;
- `localStorage` persistence tests;
- save migration tests;
- animation/pacing tests;
- online/network testing;
- additional AI personalities;
- Monte Carlo/ISMCTS testing;
- controlled random AI variation;
- UI accessibility testing.

They remain part of the broader project where required by `requirements.md`, but should not block the current headless milestone.

---

# 41. Future Testing Extensions

After the headless POC, consider:

- React Testing Library component tests;
- Playwright end-to-end tests;
- cross-browser automation;
- persistence schema/migration tests;
- property-based testing at larger scale;
- mutation testing;
- performance regression thresholds;
- memory regression thresholds;
- statistical AI balance reports;
- future personality matchup matrices;
- Monte Carlo/search algorithm equivalence/sanity tests;
- online server-authority tests.

---

# 42. Cross-Document Synchronization Status

The QA pass originally identified several documentation inconsistencies. The user approved the required resolutions, and the following have now been synchronized:

1. `requirements.md` v1.8 now places the **headless Engine + Orchestrator + AI POC and simulator before React/UI development**.
2. `orchestrator.md` v1.2 now describes Easy/Normal/Hard differences as **reasoning capability/breadth/depth**, not deliberate bad play or sabotage.
3. `orchestrator.md` v1.2 now states that the initial deterministic AI requires no separate AI RNG state; AI RNG replay metadata is required only if future controlled randomness is introduced.
4. `requirements.md` v1.8 now uses the same deterministic replay wording.
5. Detailed testing, simulation infrastructure, regression policy, and metrics remain owned by this document; `requirements.md` retains only product-level obligations and milestone intent.

No gameplay-house-rule conflict was introduced by this synchronization.

---

# 43. Current Conflict Status

There are **no known unresolved documentation conflicts requiring product approval** from this QA synchronization pass.

Any future conflict discovered during implementation or testing must be surfaced before changing product/rule semantics in the owning documents. Implementation optimizations may be changed freely only when they preserve the established public contracts and house-rule behavior.

---

# 44. Recommended Immediate Implementation Order

After this document is approved, recommended coding order is:

```text
1. Project/test scaffolding
2. Shared Domain types
3. Engine Card/Rank/Suit/deck
4. Combination detection + tests
5. Combination comparison + tests
6. Legal Move generation + tests
7. Engine state/Turn/Trick + tests
8. Basic Mode Round flow/scoring + tests
9. Competitive Mode Round flow/scoring + tests
10. Session lifecycle/tiebreaks + tests
11. Engine views/events/invariants
12. Orchestrator/GameRunner + integration tests
13. AI HandAnalyzer + MinPlaySolver + tests
14. Basic/Competitive AI evaluators + difficulty profiles
15. AIController integration tests
16. Headless single-Session runner
17. Headless batch simulator
18. Reliability/invariant runs
19. Performance/memory measurement
20. AI tuning/balancing
21. UI work after headless POC confidence is established
```

Tests should be written alongside each implementation stage rather than postponed until the simulator exists.

---

# 45. QA Summary

The testing architecture for the headless POC is intentionally layered:

```text
Unit Tests
  prove rules and algorithms
      ↓
Integration Tests
  prove module boundaries and complete flows
      ↓
Headless Simulator
  prove repeated real execution, reproducibility,
  reliability, and later AI quality/performance
```

The POC should optimize for **being demonstrably correct before being clever or fast**.

Performance and memory are designed as observable, replaceable implementation concerns. Rule correctness, information safety, deterministic reproducibility, authoritative state integrity, and reliable Session completion are non-negotiable.

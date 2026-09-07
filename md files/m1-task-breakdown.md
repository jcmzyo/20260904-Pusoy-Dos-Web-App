# Pusoy Dos --- M1 Implementation Task Breakdown

## M1 Task Plan (v2.2)

**Status:** Approved Phase 1 execution plan\
**Last Modified:** September 8, 2026\
**Milestone:** M1 --- Basic Engine Core\
**Phase:** Phase 1 --- Initial Playable Basic Game

------------------------------------------------------------------------

# 1. Purpose

M1 produces the authoritative, UI-independent **Basic Mode** game
engine. It is the first technical milestone of Phase 1; it does not by
itself produce the Phase 1 working product. Phase 1 becomes complete
only after M4 integrates the playable UI.

T01 work already in progress is carried forward if compatible with this
plan. Do not redo accepted compatible work merely because this plan was
rewritten.

# 2. M1 Technical Output

At M1 completion the repository must contain a tested pure-TypeScript
engine that can represent and execute Basic Pusoy Dos rules, including a
complete five-Round Session, without AI, React, persistence, or
networking.

M1 includes: shared domain vocabulary needed by the Engine; canonical
house `RulesetConfig`; card/deck/shuffle/deal; combination
inspection/comparison; legal Move generation; validation; Turn/Trick
state; Pass/reset behavior; finished-player continuation; Basic Round
placement/scoring; five-Round Basic Session/tiebreak; safe views;
factual events; invariants; focused and regression tests.

# 3. Explicitly Out of Scope

Do not implement during M1:

-   Competitive Mode behavior or scoring.
-   AI, difficulty levels, personalities, or strategic search.
-   GameRunner/Orchestrator execution loops.
-   Headless batch simulator.
-   React/UI.
-   persistence/Resume, Stats, Settings, or auto-pass.
-   networking/backend.
-   speculative frameworks for deferred features.

Known future concepts may justify a small stable seam such as `GameMode`
or `RulesetConfig`, but must not increase M1 implementation scope.

# 4. Execution Rules

For every Txx task: read only the listed relevant docs/source; implement
production code; add/update focused tests; run focused tests; run the
appropriate broader regression; report changed files, commands, and
actual results; then stop. Never claim a test passed if it was not
executed. Do not weaken a correct test to make code pass. Every
discovered bug requires a regression test. Avoid unrelated refactors.

Allowed partial statuses: **COMPLETE**, **CODE COMPLETE / TESTS
INCOMPLETE**, **CODE + TESTS COMPLETE / TEST EXECUTION INCOMPLETE**,
**PARTIALLY IMPLEMENTED**, **BLOCKED BY CONFLICT**, **BLOCKED BY
EXISTING REGRESSION**.

If implementation reveals a conflict among `requirements.md`,
`domain-model.md`, `engine.md`, this plan, or existing accepted
behavior, stop and report it. Do not silently choose a new product rule.

Accuracy/reliability \> speed \> memory. Optimize only after correctness
is demonstrated. Internal representations may later change without
changing public contracts.

## 4.1 Task Definition of Done

A task is **COMPLETE** only when every task-specific Definition of Done
item is satisfied. If required verification cannot be executed, use the
appropriate partial status rather than marking the task complete.

All tasks must have all tests passing.

# 5. Documentation Loading Strategy

Always read the current task in this file. For domain tasks, read
`domain-model.md`; for Engine/rule tasks, read `engine.md`; consult
`requirements.md` for authoritative product/house-rule meaning. Do not
load `ai.md`, `orchestrator.md`, UI material, or deferred Competitive
sections unless a concrete boundary question requires them.

# 6. Task Map

  -----------------------------------------------------------------------
  Mini-milestone          Tasks                   Technical checkpoint
  ----------------------- ----------------------- -----------------------
  MM1 Foundation          T01--T02                TypeScript/Vitest
                                                  project runs

  MM2 Shared domain       T03--T04                Canonical
                                                  Card/Move/Basic
                                                  vocabulary compiles

  MM3 Rules primitives    T05--T06                Ruleset + primitive
                                                  comparison tested

  MM4 Small combinations  T07                     Single/Pair/Triple
                                                  inspection tested

  MM5 Straights           T08                     Special straight rules
                                                  tested

  MM6 Five-card           T09--T10                All five-card types
  classification                                  classified

  MM7 Comparison          T11--T12                Same-type and five-card
                                                  hierarchy comparison
                                                  tested

  MM8 Deck/deal           T13--T15                Deterministic 52-card
                                                  deal tested

  MM9 Legal moves         T16--T18                Complete legal Move
                                                  generation tested

  MM10 Validation         T19                     Rejected/accepted Move
                                                  behavior tested

  MM11 Turn/Trick         T20--T21                Pass, response cycle,
                                                  free lead tested

  MM12 Finishing          T22                     Basic finished-player
                                                  continuation tested

  MM13 Basic Round        T23                     Placement +5/+3/+2/0
                                                  tested

  MM14 Basic Session      T24                     Exactly five Rounds +
                                                  tiebreak tested

  MM15 Engine boundaries  T25--T27                Events, views,
                                                  invariants tested

  MM16 Acceptance         T28                     Full M1
                                                  regression/typecheck
                                                  passes
  -----------------------------------------------------------------------

# 7. Detailed Tasks

## T01 --- Create minimal TypeScript project structure

**Objective:** establish the smallest repository structure needed for a
pure TypeScript engine and tests.\
**Production:** package metadata, TypeScript configuration, source/test
directories as needed; no React.\
**Tests:** configuration need not contain game tests yet.\
**Acceptance:** install/build/typecheck command is documented and
succeeds. Preserve compatible work already underway.\
**Stop:** do not implement game types.

### Definition of Done

-   [ ] Minimal TypeScript project/package configuration exists and is
    usable.
-   [ ] Required source/test structure exists without speculative
    application structure.
-   [ ] Dependency installation and the documented build/typecheck
    command succeed.
-   [ ] Compatible existing T01 work is preserved rather than
    unnecessarily recreated.
-   [ ] No game-domain types, rules, React, AI, or later-task
    functionality is implemented.

## T02 --- Configure Vitest smoke test

**Objective:** prove the test runner works.\
**Production:** minimal test configuration only.\
**Tests:** one trivial smoke test executed successfully.\
**Acceptance:** focused test and typecheck visibly pass.\
**Stop:** no game rules.

### Definition of Done

-   [ ] Vitest is minimally configured and discovers the smoke test.
-   [ ] At least one trivial smoke test is actually executed
    successfully.
-   [ ] Focused test command and typecheck pass.
-   [ ] No game rules or later-task functionality is introduced.

## T03 --- Implement `Rank`, `Suit`, and `Card`

**Must read:** `domain-model.md`, relevant `engine.md` card rules.\
**Production:** canonical immutable/shared vocabulary; Card identity
remains rank+suit.\
**Tests:** valid construction/usage and canonical values.\
**Acceptance:** no UI/ownership/AI metadata leaks into Card.

### Definition of Done

-   [ ] `Rank` and `Suit` contain exactly the canonical project values.
-   [ ] `Card` contains only documented shared identity data; identity
    remains rank+suit.
-   [ ] Focused tests cover canonical values and representative usage.
-   [ ] No ownership, UI, visibility, AI, or subsystem metadata leaks
    into `Card`.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T04 --- Implement remaining M1 shared vocabulary

**Production:** `PlayerId`, `CombinationType`, `Combination`, `Move`,
`PlayMove`, `PassMove`, and `GameMode` as documented. `competitive` may
remain vocabulary but does not activate Competitive behavior.\
**Tests:** discriminated Move behavior/type-level usage as practical.\
**Acceptance:** no giant shared `Player` object and no subsystem
implementation details.

### Definition of Done

-   [ ] All documented M1 shared vocabulary is implemented with
    canonical shapes.
-   [ ] `Move` correctly discriminates Play and Pass; `Combination` does
    not imply Move legality.
-   [ ] `competitive` remains vocabulary only and activates no
    Competitive behavior.
-   [ ] No giant shared `Player` or subsystem-specific implementation
    type is introduced.
-   [ ] Focused tests/type checks, regression suite, and typecheck pass.

## T05 --- Implement `RulesetConfig` and canonical house rules

**Production:** rank order, suit order, five-card order, straight rules
needed by Basic play.\
**Tests:** canonical configured values.\
**Acceptance:** configuration is a lightweight rule seam, not a plugin
framework.

### Definition of Done

-   [ ] `RulesetConfig` represents the Basic rank, suit, five-card, and
    Straight rule primitives.
-   [ ] Canonical configuration exactly matches current house rules.
-   [ ] Focused tests assert canonical configured values/orderings.
-   [ ] The seam remains lightweight; no plugin framework, ruleset UI,
    or Competitive behavior is introduced.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T06 --- Implement primitive rank/suit/single comparison helpers

**Tests:** 3 lowest, 2 highest; Clubs \< Spades \< Hearts \< Diamonds;
same-rank singles resolved by suit.\
**Acceptance:** helpers use authoritative RulesetConfig semantics.

### Definition of Done

-   [ ] Rank comparison follows 3 \< 4 \< ... \< A \< 2.
-   [ ] Suit comparison follows Clubs \< Spades \< Hearts \< Diamonds.
-   [ ] Same-rank Singles are resolved by suit.
-   [ ] Helpers derive semantics from the authoritative ruleset rather
    than conflicting duplicated constants.
-   [ ] Focused boundary/tiebreak tests, regression suite, and typecheck
    pass.

## T07 --- Inspect Single, Pair, and Triple

**Production:** authoritative combination inspection for 1/2/3-card
sets.\
**Tests:** valid/invalid sizes/ranks and representative cases.\
**Acceptance:** inspection does not imply a Move is legal in current
state.

### Definition of Done

-   [ ] Every valid Single, Pair, and Triple is recognized correctly.
-   [ ] Pairs/Triples require equal ranks and malformed/unsupported
    inputs are rejected.
-   [ ] Inspection remains state-independent and does not claim
    current-turn legality.
-   [ ] Focused valid/invalid tests, regression suite, and typecheck
    pass.

## T08 --- Implement house-rule Straight detection and strength

**Tests required:** A2345 valid/weakest/effective high 5; 23456
valid/second weakest/effective high 6; 34567...10JQKA and JQKA2 valid;
KA234 and QKA23 invalid; tie uses suit of effective high card; valid
same-suit sequences pass Straight inspection.\
**Acceptance:** exhaustive/representative edge coverage; every valid
house-rule sequence is recognized as a Straight regardless of suits; no
standard-poker rule silently overrides house rules.

### Definition of Done

-   [ ] A2345 is valid/weakest with effective high 5; 23456 is
    valid/second weakest with effective high 6.
-   [ ] 34567 through 10JQKA and JQKA2 are recognized correctly.
-   [ ] KA234 and QKA23 are rejected.
-   [ ] Straight inspection recognizes every valid house-rule sequence
    regardless of suits; same-suit sequences are not rejected.
-   [ ] Tests explicitly require representative same-suit valid sequences
    to pass Straight detection.
-   [ ] Equal effective-high Straights use the suit of the
    effective-high card; existing effective-high strength and suit-tiebreak
    semantics remain unchanged.
-   [ ] Special sequences, invalid wraps, boundaries, and suit tiebreaks
    are explicitly tested.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T09 --- Inspect Flush and Full House

**Tests:** Flush validity and suit-first comparison metadata; Full House
triple-rank strength.\
**Acceptance:** Flush comparison is suit first, then descending ranks
within same suit.

### Definition of Done

-   [ ] Every same-suit five-card hand satisfies Flush inspection, including hands whose ranks also form a valid house-rule sequence; final category precedence is handled in T10.
-   [ ] Flush strength supports suit-first then descending-rank
    comparison.
-   [ ] Full Houses require a valid triple+pair structure and use triple
    rank for strength.
-   [ ] Focused valid/invalid/strength tests, regression suite, and
    typecheck pass.

## T10 --- Inspect Four-of-a-Kind and Straight Flush

**Tests:** Four-kind requires quad+kicker and compares by quad rank;
kicker irrelevant to strength; detect Straight/Flush overlap and assign
the final category using the canonical highest-ranking-applicable policy;
Straight Flush uses house Straight semantics.\
**Acceptance:** all valid five-card categories can be inspected and
overlapping definitions resolve to the strongest applicable canonical
category.

### Definition of Done

-   [ ] Four-of-a-Kind requires quad+kicker and uses only quad rank for
    strength.
-   [ ] Straight Flush requires both a valid house-rule Straight sequence
    and one suit.
-   [ ] Detection identifies overlap between Straight and Flush property
    checks.
-   [ ] When multiple five-card definitions apply, final classification
    selects the highest-ranking applicable category under the canonical
    hierarchy; Straight + Flush therefore classifies as Straight Flush.
-   [ ] Tests cover category precedence, including same-suit valid
    sequences that pass Straight and Flush inspection but classify as
    Straight Flush.
-   [ ] Straight Flush preserves all documented special Straight
    semantics and its canonical strength/comparison behavior is tested.
-   [ ] Together with T08--T09, every valid five-card category can be
    inspected.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T11 --- Compare same-category combinations

**Tests:** Singles/Pairs/Triples and every five-card category according
to house rules.\
**Acceptance:** deterministic strict comparison result.

### Definition of Done

-   [ ] Singles, Pairs, Triples, and every five-card category compare
    according to canonical house rules.
-   [ ] Equal-strength handling is deterministic and consistent with the
    comparison contract.
-   [ ] Representative lower/equal/higher cases are tested for every
    category.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T12 --- Compare five-card hierarchy and cross-type responses

**Tests:** Straight \< Flush \< Full House \< Four-of-a-Kind \< Straight
Flush, including cross-category wins/losses.\
**Acceptance:** no bomb/trick-breaking exception exists.

### Definition of Done

-   [ ] Five-card order is exactly Straight \< Flush \< Full House \<
    Four-of-a-Kind \< Straight Flush.
-   [ ] Higher categories beat lower categories; same-category
    comparison uses canonical rules.
-   [ ] Cross-category win/loss cases are explicitly tested.
-   [ ] No bomb, interrupt, or trick-breaking exception is introduced.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T13 --- Construct canonical 52-card deck

**Tests:** exactly 52 unique rank+suit combinations, no jokers.\
**Acceptance:** deterministic unshuffled construction.

### Definition of Done

-   [ ] Deck contains exactly 52 cards and every canonical rank+suit
    combination exactly once.
-   [ ] No duplicate, missing card, or joker exists.
-   [ ] Unshuffled construction is deterministic.
-   [ ] Focused conservation/uniqueness tests, regression suite, and
    typecheck pass.

## T14 --- Implement injected deterministic shuffle

**Production:** authoritative shuffle consumes injected RNG; no
uncontrolled `Math.random`.\
**Tests:** same RNG sequence/seed yields same shuffle; deck
conservation.\
**Acceptance:** shuffle does not own global randomness.

### Definition of Done

-   [ ] Authoritative shuffle randomness comes only from injected RNG.
-   [ ] Same deterministic RNG input produces the same shuffle.
-   [ ] Shuffle preserves every card exactly once.
-   [ ] No uncontrolled `Math.random()` is used for authoritative
    shuffle behavior.
-   [ ] Focused determinism/conservation tests, regression suite, and
    typecheck pass.

## T15 --- Deal four 13-card hands

**Tests:** four players, 13 each, all 52 unique cards distributed
exactly once; identify 3♣ holder.\
**Acceptance:** no card duplication/loss.

### Definition of Done

-   [ ] Exactly four 13-card hands are produced.
-   [ ] All 52 unique cards are distributed exactly once with no
    loss/duplication.
-   [ ] The 3♣ holder is identified correctly.
-   [ ] Focused distribution/3♣ tests, regression suite, and typecheck
    pass.

## T16 --- Generate legal opening Moves

**Tests:** opening cannot Pass; every legal opening contains 3♣; valid
1/2/3/5-card combinations containing 3♣ are considered.\
**Acceptance:** Engine, not AI/UI, owns legality.

### Definition of Done

-   [ ] Pass is never generated for the opening Move.
-   [ ] Every generated opening Play contains 3♣.
-   [ ] All valid 1/2/3/5-card opening combinations containing 3♣ are
    considered; no invalid combination is returned.
-   [ ] Opening legality remains Engine-owned.
-   [ ] Focused opening-generation tests, regression suite, and
    typecheck pass.

## T17 --- Generate legal response Moves

**Tests:** Pass allowed while responding; 1/2/3 responses require same
category/count and beat current hand; five-card responses obey
hierarchy; no non-beating plays.\
**Acceptance:** returned plays are legal by construction.

### Definition of Done

-   [ ] Pass is available during a normal response when eligible.
-   [ ] 1/2/3-card responses use the required category/count and
    strictly beat the current hand.
-   [ ] Five-card responses follow canonical hierarchy/comparison rules.
-   [ ] No non-beating or malformed Play is returned.
-   [ ] Focused response tests, regression suite, and typecheck pass.

## T18 --- Generate complete free-lead and response candidate sets

**Production:** complete enumeration with correctness-first
implementation; optimization allowed only with equivalence tests.\
**Tests:** compare representative hands against brute/reference
enumeration where practical.\
**Acceptance:** no legal candidate omitted due to optimization.

### Definition of Done

-   [ ] Free-lead enumeration returns every legal non-Pass combination.
-   [ ] Response enumeration returns every legal beating Play plus Pass
    where allowed.
-   [ ] No illegal or duplicate candidate is returned.
-   [ ] Representative hands are checked against brute/reference
    enumeration where practical.
-   [ ] Any optimization has equivalence tests proving no legal
    candidate is omitted.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T19 --- Validate and atomically submit Moves

**Tests:** wrong player, cards not owned, invalid combination, illegal
Pass, non-beating response, opening violation; accepted Play removes
exactly submitted cards; rejected Move causes no partial mutation.\
**Acceptance:** ordinary invalid Moves return structured errors rather
than exceptions.

### Definition of Done

-   [ ] Wrong-turn, unowned-card, invalid-combination, illegal-Pass,
    non-beating, and opening-violation Moves are rejected.
-   [ ] Accepted Plays remove exactly the submitted cards and perform
    the intended transition.
-   [ ] Every rejected Move leaves authoritative state unchanged.
-   [ ] Ordinary invalid input returns structured errors rather than
    exceptions.
-   [ ] Atomic rejection/no-partial-mutation is explicitly tested.
-   [ ] Focused tests, regression suite, and typecheck pass.

## T20 --- Implement Turn rotation and response-cycle Pass tracking

**Tests:** clockwise rotation, active-player skipping, voluntary Pass,
new successful Play starts a new response cycle and clears prior Pass
state.\
**Acceptance:** exactly one active Turn owner during normal input.

### Definition of Done

-   [ ] Turn ownership rotates clockwise among eligible active players
    and skips finished/ineligible players.
-   [ ] Voluntary Pass is tracked for the current response cycle.
-   [ ] A successful new Play clears stale prior Pass state for the new
    response cycle.
-   [ ] Normal playable state has exactly one active Turn owner.
-   [ ] Focused rotation/Pass tests, regression suite, and typecheck
    pass.

## T21 --- Implement Trick reset and free lead

**Tests:** all other eligible active players Pass → last successful
player receives free lead; Pass state does not leak into new Trick;
finished/ineligible players do not count.\
**Acceptance:** free lead cannot Pass.

### Definition of Done

-   [ ] Reset occurs only after every other eligible active player has
    passed as required.
-   [ ] The last successful player receives free lead when still
    eligible.
-   [ ] Finished/ineligible players do not incorrectly extend the
    response cycle.
-   [ ] Pass state clears on reset and free lead cannot Pass.
-   [ ] Focused active-player-aware reset tests, regression suite, and
    typecheck pass.

## T22 --- Implement Basic finished-player continuation

**Tests:** empty hand records finish/removes player; after a finisher's
final play, starting next active clockwise find first player able to
beat it; if one exists normal response continues; if none, next active
player free leads.\
**Acceptance:** no deadlock and no finished player re-enters rotation.

### Definition of Done

-   [ ] A player who empties their hand is recorded finished and removed
    from active rotation.
-   [ ] Search after the finisher starts with the next active player
    clockwise.
-   [ ] The first active player able to beat the final combination
    becomes the responder.
-   [ ] If nobody can beat it, the next active player receives free
    lead.
-   [ ] Finished players never re-enter rotation and multi-finisher edge
    cases do not deadlock.
-   [ ] Focused continuation tests, regression suite, and typecheck
    pass.

## T23 --- Complete Basic Round lifecycle and scoring

**Tests:** first three finishers become 1st/2nd/3rd, final active player
4th; scores +5/+3/+2/0; Round ends only when Basic completion condition
is met.\
**Acceptance:** complete official Round result.

### Definition of Done

-   [ ] Finish order produces official 1st/2nd/3rd placements and the
    final active player becomes 4th.
-   [ ] Points are exactly +5/+3/+2/0 and assigned exactly once per
    player.
-   [ ] Round ends only under the documented Basic completion condition.
-   [ ] Engine produces a complete official Round result.
-   [ ] Focused Round/scoring tests, regression suite, and typecheck
    pass.

## T24 --- Complete five-Round Basic Session and tiebreak

**Tests:** exactly five Rounds; cumulative totals equal Round results;
winner order: total score → round wins → lower average placement →
highest single Round score → genuine tie.\
**Acceptance:** no Competitive scoring/tiebreak implementation.

### Definition of Done

-   [ ] A Basic Session contains exactly five completed Rounds.
-   [ ] Cumulative totals equal the sum of official Round scores.
-   [ ] Tiebreak order is total score → round wins → lower average
    placement → highest single Round score → genuine tie.
-   [ ] Tests exercise each tiebreak level and chained ties.
-   [ ] No Competitive scoring/tiebreak behavior is implemented.
-   [ ] Focused Session tests, regression suite, and typecheck pass.

## T25 --- Emit factual Engine events

**Production:** events needed by later Orchestrator/UI/simulation such
as Session/Round start, deal, turn change, play, Pass, Trick end,
finish, Round end, score, Session end.\
**Tests:** representative event ordering/payload facts.\
**Acceptance:** events report facts; they do not contain UI presentation
logic.

### Definition of Done

-   [ ] Required factual Engine events exist for documented M1 lifecycle
    boundaries and fire at correct transitions.
-   [ ] Representative ordering is deterministic and tested.
-   [ ] Payloads contain accurate Engine facts without UI presentation
    or AI reasoning.
-   [ ] Event contracts do not leak information beyond their intended
    contract.
-   [ ] Focused event tests, regression suite, and typecheck pass.

## T26 --- Implement information-safe views

**Production:** `PlayerView` and public view contracts needed by
controllers/UI.\
**Tests:** own hand visible to owner; opponent hands hidden; public
played cards/counts/current trick/scores exposed only as documented.\
**Acceptance:** future bots cannot require private Engine state.

### Definition of Done

-   [ ] `PlayerView` exposes the requesting player's own hand but not
    unrevealed opponent hands.
-   [ ] Public view exposes only documented public facts.
-   [ ] No private Engine state or future RNG information leaks through
    views.
-   [ ] Later consumers can use documented views without direct
    private-state access.
-   [ ] Tests explicitly attempt to detect hidden-information leakage.
-   [ ] Focused view tests, regression suite, and typecheck pass.

## T27 --- Enforce Engine invariants

**Tests/checks:** 52-card conservation, unique card locations, four v1
players, zero-card finished players, valid turn owner, opening 3♣ rule,
accepted response beats current combination, Pass/reset integrity, Basic
placement/session totals.\
**Acceptance:** invariant failures are diagnosable and usable by later
simulator.

### Definition of Done

-   [ ] Card conservation/unique-location, four-player, finished-player,
    Turn-owner, opening, response, Pass/reset, placement, and Session
    invariants are checked where applicable.
-   [ ] Representative invalid states/actions produce diagnosable
    invariant failures.
-   [ ] Valid representative states do not produce false invariant
    failures.
-   [ ] Invariant checking reports problems rather than silently
    repairing state.
-   [ ] Focused invariant tests, regression suite, and typecheck pass.

## T28 --- M1 acceptance regression

**Production:** no new feature work except fixes required by M1
acceptance.\
**Run:** full test suite, typecheck/build checks, and any documented
lint command.\
**Acceptance:** no known Basic Engine correctness/invariant defect; all
executed results reported; deferred features remain unimplemented.\
**Output:** M1 completion report with commands, results, changed files,
and any remaining non-blocking risks.

### Definition of Done

-   [ ] T01--T27 satisfy their current Definitions of Done.
-   [ ] Full M1 automated test suite passes.
-   [ ] Typecheck and configured production build/check pass; documented
    lint/quality command passes if present.
-   [ ] Higher-risk tasks receive a fresh review pass or equivalent
    acceptance scrutiny.
-   [ ] No known Basic Engine correctness, hidden-information,
    determinism, or invariant defect remains.
-   [ ] Deferred/M2+ functionality is neither required nor added merely
    to declare M1 complete.
-   [ ] Actual commands/results, changed files, and remaining
    non-blocking risks are recorded.
-   [ ] The Basic Engine is ready for M2 without controllers duplicating
    authoritative game rules.

# 8. Higher-Risk Tasks

T08, T12, T18, T19, T21, T22, T24, T26, and T27 deserve a fresh review
pass because errors can silently affect many later games.

# 9. M1 Definition of Done

M1 is complete only when T28 passes and the Basic Engine can support the
next milestone without rule logic being duplicated in controllers. M1
completion does **not** imply AI, simulator, or UI completion.

All T01--T28 task-level Definitions of Done must be satisfied before M1
is declared complete.

# 10. Phase 1 Context After M1

-   **M2:** Baseline AI + Headless Game.
-   **M3:** Headless Simulator + Reliability.
-   **M4:** Minimal Playable UI.

No milestone beyond M4 is committed. Post-Phase-1 work is replanned
after evaluating the working playable product.

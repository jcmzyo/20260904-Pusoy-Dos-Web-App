# Pusoy Dos --- M1 Implementation Task Breakdown

## M1 Task Plan (v1.1)

**Status:** Ready for implementation  
**Last Modified:** September 5, 2026  
**Parent document:** `requirements.md` v1.8  
**Shared model:** `domain-model.md` v1.1  
**Engine design:** `engine.md` v1.2  
**Testing strategy:** `testing-simulation.md` v1.1  
**Milestone:** M1 --- Shared Domain + Engine Core  
**Primary execution environment:** TypeScript + Vitest + Node.js  
**POC priority:** Accuracy/reliability first, then speed, then memory

---

# 1. Purpose

This document breaks M1 into small, independently reviewable implementation tasks suitable for limited-context or limited-token coding assistants.

M1 establishes the shared game vocabulary and authoritative Game Engine before Orchestrator, AI, headless simulation, or UI work begins.

The task plan is intentionally granular so that:

- each task has a narrow implementation scope;
- each task produces a visible output that can be inspected;
- implementation is completed before its focused tests are written;
- tests are run before the task is considered complete;
- later tasks may assume accepted earlier tasks work as specified;
- a coding assistant can stop safely if its token budget is exhausted;
- Git commits can be made at clean checkpoints;
- rule conflicts are surfaced instead of silently resolved.

---

# 2. M1 Completion Goal

M1 is complete when the production-oriented shared Domain and Game Engine can correctly and deterministically support:

- the canonical 52-card deck;
- configurable rank/suit/five-card ordering;
- deterministic shuffle/deal through injected RNG;
- all confirmed house-rule combination classifications;
- all confirmed combination comparisons;
- complete legal-Move generation;
- authoritative Move validation;
- Turn and Trick state transitions;
- finished-player handling;
- Basic Mode Round completion/scoring;
- Competitive Mode immediate Round completion/scoring;
- five-Round Session state/scoring/tiebreak handling required by the Engine;
- safe Engine views/events/contracts required by later modules;
- reusable Engine invariants;
- comprehensive focused unit tests;
- a controlled Engine-level acceptance/integration test without AI or UI.

M1 does **not** implement the real AI, Game Orchestrator, reusable headless simulator, React UI, persistence, or networking.

---

# 3. Execution Philosophy

## 3.1 Task order

Within each implementation task, use this order unless the task explicitly says otherwise:

```text
1. Read only the relevant current documentation and source files.
2. Implement the requested production code.
3. Add or update focused automated tests for that code.
4. Run the relevant focused tests.
5. Run the broader regression suite that already exists.
6. Report visible results and changed files.
7. Stop.
```

The project intentionally prioritizes **making the production code first, then writing the test, then actually running/verifying the test**.

This is not strict test-first TDD. However, no implementation slice should be treated as accepted until its focused tests exist and have been executed successfully.

## 3.2 Previously accepted work is assumed correct

Each task may assume that all previously completed and accepted tasks behave according to their documented contracts.

Do not repeatedly redesign or reimplement accepted earlier work unless:

- a new test exposes an actual defect;
- the current task cannot be implemented without correcting that defect; or
- a documented contract conflict is discovered.

When a previous task appears defective, stop unnecessary expansion and report the regression clearly.

## 3.3 Accuracy over optimization

For M1:

```text
accuracy / reliability
        > speed
        > memory optimization
```

Prefer readable and obviously correct reference implementations over clever optimizations.

Bitmasks, memoization, lookup tables, and specialized generators may be introduced where already approved, but they must remain internal implementation details and must not redefine house-rule semantics.

Future optimization must be allowed without changing public behavior.

---

# 4. Coding-Assistant Scope Rules

Every Claude/LLM coding request for this plan should include the following boundary:

> Implement only the assigned task. Do not implement later M1 tasks, M2 features, AI, Orchestrator, UI, persistence, networking, or unrelated refactors. Do not change established house rules. Production code comes first, then focused tests, then execute the tests if possible. If you discover a rule/documentation conflict, stop that decision and report it instead of silently choosing an interpretation.

The assistant should also be told:

> If your remaining token/context budget is not sufficient to complete the whole task, do not compress or fake completion. Finish the safest coherent portion possible and explicitly report what remains under `Incomplete Work`.

---

# 5. Partial-Completion Protocol

A task may be marked complete only when all required production code, required tests, and required verification have been completed.

If the coding assistant reaches a token/context/tool limit, its final report must state one of these statuses:

```text
COMPLETE
CODE COMPLETE / TESTS INCOMPLETE
CODE + TESTS COMPLETE / TEST EXECUTION INCOMPLETE
PARTIALLY IMPLEMENTED
BLOCKED BY CONFLICT
BLOCKED BY EXISTING REGRESSION
```

The report must include:

```text
Completed:
- ...

Incomplete Work:
- exact file/function/test still needed

Tests Written:
- ...

Tests Actually Run:
- command
- result

Manual Verification Available:
- exact steps the user can run locally

Files Changed:
- ...
```

Never claim a test passed if it was not actually executed.

If test execution is unavailable, the user may run the provided unit tests manually and return failures for correction.

---

# 6. Visible-Output Requirement

Every task must produce at least one checkable output.

Acceptable visible outputs include:

- a passing Vitest test file;
- deterministic console/test output;
- a known card comparison result;
- a known combination classification;
- an exact legal-Move set;
- an exact state transition;
- an exact score breakdown;
- an invariant report;
- a deterministic Session result;
- a clear Git diff containing only the intended scope.

Tasks that only create invisible infrastructure without a testable or inspectable result should be avoided.

---

# 7. Suggested Git Workflow

Each task is intended to be a clean commit boundary when practical.

Suggested pattern:

```text
git status
npm test -- <focused test>
npm test
git diff
git add ...
git commit -m "M1-Txx: <short task description>"
```

A mini-milestone may instead be committed as one grouped commit if its tasks are very small and all remain easy to review.

Do not mix unrelated cleanup into task commits.

---

# 8. M1 Mini-Milestone Map

| Mini-Milestone | Goal | Tasks |
|---|---|---|
| MM1 | Project/test foundation | T01-T02 |
| MM2 | Shared card domain | T03-T04 |
| MM3 | Ruleset and primitive comparison | T05-T06 |
| MM4 | 1/2/3-card combinations | T07 |
| MM5 | Straight rules | T08 |
| MM6 | Remaining five-card classification | T09-T10 |
| MM7 | Combination comparison | T11-T12 |
| MM8 | Deck/shuffle/deal | T13-T15 |
| MM9 | Legal-Move generation | T16-T18 |
| MM10 | Authoritative Move validation | T19 |
| MM11 | Turn/Trick state machine | T20-T21 |
| MM12 | Finished-player handling | T22 |
| MM13 | Basic Mode | T23 |
| MM14 | Competitive Mode | T24-T25 |
| MM15 | Session lifecycle | T26 |
| MM16 | Views/events/invariants | T27-T29 |
| MM17 | M1 acceptance/regression gate | T30 |

## 8.1 Documentation-loading strategy for Claude

`m1-task-breakdown.md` is always the task source. Give Claude the assigned task or mini-milestone section from this file, but do **not** automatically load every project document.

For each mini-milestone below:

- **Must read** means Claude should inspect that document before coding the milestone.
- **Read only if needed** means do not spend context on it unless the current source code or must-read docs expose an ambiguity, regression, or integration question that specifically requires it.
- Do not ask Claude to read `ai.md`, `orchestrator.md`, UI/persistence documents, or unrelated planning material unless that mini-milestone explicitly lists them.
- Existing source files used by the task still need to be inspected; this list only controls Markdown/document context.
- If a lower-authority document appears to conflict with a higher-authority one, do not silently reconcile it. Report the conflict.

This keeps context focused while preserving the authority order established by the project documentation.

---

# 9. MM1 --- Project and Test Foundation

### Documentation for Claude

**Must read:**
- `requirements.md` — project stack, M1 boundary, and no-UI/headless-first direction.
- `testing-simulation.md` — test tooling and verification expectations.

**Read only if needed:**
- `engine.md` — only if project structure or package boundaries require confirmation.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T01 --- Create minimal TypeScript project structure

### Objective

Establish the source/test structure needed for M1 without implementing gameplay.

### Production work

Create or confirm a minimal structure compatible with the approved architecture, for example:

```text
src/
  domain/
  engine/
tests/                  # optional if tests are not colocated
```

Configure TypeScript and package scripts needed for production code and tests.

Do not create React application code as part of this task.

### Test work

None beyond verifying the TypeScript project can compile/type-check.

### Visible output

A successful type-check/build command with the empty/minimal project.

### Acceptance criteria

- TypeScript compiles.
- `src/domain` and `src/engine` boundaries exist.
- No React dependency is required for M1 Engine execution.
- No gameplay behavior is implemented yet.

### Stop boundary

Stop once the project compiles. Do not begin card types.

---

## T02 --- Configure Vitest smoke test

### Objective

Prove the automated unit-test harness works before game code depends on it.

### Production work

Only test configuration/package-script changes if needed.

### Test work

Add one trivial smoke test.

### Visible output

Running the test command reports at least one passing test.

### Acceptance criteria

- Vitest starts successfully.
- Smoke test passes.
- Test command can be reused by later tasks.

### Stop boundary

Do not begin game-rule tests.

---

# 10. MM2 --- Shared Card Domain

### Documentation for Claude

**Must read:**
- `domain-model.md` — authoritative shared `Rank`, `Suit`, `Card`, `PlayerId`, `GameMode`, `Combination`, and `Move` vocabulary.

**Read only if needed:**
- `requirements.md` — only if a product-level meaning is unclear.
- `engine.md` — only to confirm that Engine-specific fields are not being leaked into shared domain types.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`, `testing-simulation.md`.


## T03 --- Implement `Rank`, `Suit`, and `Card`

### Objective

Create the implementation-independent card vocabulary defined by `domain-model.md`.

### Production work

Implement only:

- `Rank`;
- `Suit`;
- `Card`.

Do not add comparison, ownership, visibility, UI, AI, or Engine state fields.

### Test work

Add focused type/helper tests only if runtime helpers exist. Avoid tests that merely restate TypeScript compile-time type checking.

### Visible output

A tiny compilable example/test constructing valid cards such as `3♣` and `2♦`.

### Acceptance criteria

- Card contains only rank and suit.
- Domain types match the canonical shared model.
- Engine logic is not added to the domain types.

### Stop boundary

Do not add Ruleset comparison logic.

---

## T04 --- Implement remaining M1 shared vocabulary

### Objective

Add shared types that Engine work immediately depends on.

### Production work

Implement the documented shared concepts required by M1:

- `PlayerId`;
- `GameMode`;
- `CombinationType`;
- `Combination`;
- `Move`;
- `PlayMove`;
- `PassMove`.

### Test work

Use compile/runtime construction tests only where meaningful.

### Visible output

A passing test/example that constructs a `PlayMove`, `PassMove`, and `Combination` without importing Engine internals.

### Acceptance criteria

- `Move` represents intent, not legality.
- `Combination` contains shared classification data only.
- No giant universal `Player` object is introduced.

### Stop boundary

Do not add Engine validation.

---

# 11. MM3 --- Ruleset and Primitive Comparison

### Documentation for Claude

**Must read:**
- `domain-model.md` — canonical card/rank/suit types.
- `engine.md` — authoritative `RulesetConfig` contract and comparison semantics.

**Read only if needed:**
- `requirements.md` — product-level fallback if a rule meaning is disputed.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`, `testing-simulation.md`.


## T05 --- Implement `RulesetConfig` and canonical house rules

### Objective

Represent rule ordering as configuration rather than scattered hardcoded assumptions.

### Production work

Implement Engine-owned configuration for:

- rank order;
- suit order;
- five-card hierarchy;
- straight-rule configuration required by the current house rules.

Provide the canonical default Pusoy Dos ruleset.

### Test work

Verify canonical configuration contains the documented ordering exactly.

### Visible output

Test/console output showing:

```text
Rank: 3 < 4 < ... < A < 2
Suit: clubs < spades < hearts < diamonds
Five-card: straight < flush < fullHouse < fourOfAKind < straightFlush
```

### Acceptance criteria

No external Big Two/Poker library determines rule semantics.

### Stop boundary

Do not classify combinations yet.

---

## T06 --- Implement rank, suit, and single-card comparison helpers

### Objective

Create the primitive comparison foundation used by combinations.

### Production work

Implement Engine comparison functions driven by `RulesetConfig`.

### Test work

At minimum verify:

- `3♣ < 3♠ < 3♥ < 3♦`;
- `A♦ < 2♣` because rank precedes suit for different ranks;
- `3♣` is the minimum single;
- `2♦` is the maximum single;
- equal card values compare equal when appropriate.

### Visible output

Passing comparison tests with named examples.

### Acceptance criteria

Comparison code uses the ruleset rather than duplicated numeric constants spread across modules.

### Stop boundary

Do not implement Pair/Triple/five-card classification.

---

# 12. MM4 --- 1/2/3-Card Combination Classification

### Documentation for Claude

**Must read:**
- `domain-model.md` — shared `Combination` / `CombinationType` shape.
- `engine.md` — authoritative Single, Pair, and Triple classification rules.

**Read only if needed:**
- `requirements.md` — only if an Engine rule appears inconsistent with product intent.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`, `testing-simulation.md`.


## T07 --- Implement Single, Pair, and Triple inspection

### Objective

Classify the simple combination categories.

### Production work

Implement combination inspection/classification for:

- Single;
- Pair;
- Triple;
- invalid 1/2/3-card selections.

### Test work

Include positive and negative examples:

```text
[5♣]                         -> Single
[7♣, 7♦]                    -> Pair
[Q♣, Q♠, Q♥]                -> Triple
[7♣, 8♦]                    -> invalid
[Q♣, Q♠, K♥]                -> invalid
```

### Visible output

Passing classification matrix.

### Acceptance criteria

Only canonical combination semantics are used.

### Stop boundary

Do not implement five-card classification.

---

# 13. MM5 --- Straight Rules

### Documentation for Claude

**Must read:**
- `domain-model.md` — shared card/combination types.
- `engine.md` — authoritative special Straight rules, effective-high handling, and tiebreak metadata.

**Read only if needed:**
- `requirements.md` — product truth if any special-straight wording appears ambiguous.
- `testing-simulation.md` — only when expanding the explicit house-rule edge-case test matrix.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T08 --- Implement house-rule Straight detection and metadata

### Objective

Implement the project's confirmed non-generic Straight rules before other five-card categories depend on them.

### Production work

Implement configured Straight recognition and effective-high-card identification.

### Required cases

```text
A2345   -> valid; effective high = 5
23456   -> valid; effective high = 6
34567   -> valid
...
10JQKA  -> valid
JQKA2   -> valid
KA234   -> invalid
QKA23   -> invalid
```

The effective-high card's suit must be available for later tiebreak comparison.

### Test work

Create explicit named tests for every special case rather than relying only on generated coverage.

### Visible output

A Straight test table that displays/validates valid/invalid status and effective high.

### Acceptance criteria

- External generic Poker/Big Two Straight assumptions do not override house rules.
- No silent cyclic-wrap behavior accepts `KA234` or `QKA23`.

### Stop boundary

Do not implement Flush/Full House/etc. in this task.

---

# 14. MM6 --- Remaining Five-Card Classification

### Documentation for Claude

**Must read:**
- `domain-model.md` — shared five-card `CombinationType` values.
- `engine.md` — authoritative Flush, Full House, Four-of-a-Kind, and Straight Flush classification rules.

**Read only if needed:**
- `requirements.md` — only for disputed product semantics.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`, `testing-simulation.md`.


## T09 --- Implement Flush and Full House classification

### Objective

Add two five-card categories with focused rule handling.

### Production work

Implement:

- Flush classification;
- Full House classification.

### Test work

Cover valid/invalid patterns and card-order independence.

### Visible output

Passing classification examples for multiple Flushes and Full Houses.

### Acceptance criteria

Classification only; do not add their comparison rules yet.

### Stop boundary

Do not add Four-of-a-Kind or Straight Flush.

---

## T10 --- Implement Four-of-a-Kind and Straight Flush classification

### Objective

Complete five-card hand classification.

### Production work

Implement:

- Four-of-a-Kind + one kicker;
- Straight Flush;
- correct precedence when a hand matches multiple structural properties.

A Straight Flush must classify as `straightFlush`, not plain `straight` or `flush`.

### Test work

Include ambiguous/precedence examples.

### Visible output

A complete classification test matrix covering all eight `CombinationType` values.

### Acceptance criteria

Every valid combination category can now be identified authoritatively.

### Stop boundary

Do not implement comparison yet.

---

# 15. MM7 --- Combination Comparison

### Documentation for Claude

**Must read:**
- `domain-model.md` — shared combination representation.
- `engine.md` — authoritative same-type and cross-five-card comparison hierarchy, including Flush suit-first and Four-of-a-Kind kicker-irrelevant rules.

**Read only if needed:**
- `requirements.md` — only if comparison semantics need product-level confirmation.
- `testing-simulation.md` — only when checking the explicit edge-case regression list.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T11 --- Compare Single, Pair, and Triple combinations

### Objective

Implement same-category comparison for 1/2/3-card hands.

### Production work

Implement comparison based on rank first and suit-based tiebreaks according to established rules.

### Test work

Cover:

- different ranks;
- same-rank suit tiebreaks;
- card-order independence for Pair/Triple;
- mismatched category/count rejection where applicable.

### Visible output

Passing examples such as a same-rank higher-suit response beating a lower-suit response.

### Acceptance criteria

Comparison semantics are ruleset-driven and deterministic.

### Stop boundary

Do not compare five-card hands yet.

---

## T12 --- Compare all five-card combinations

### Objective

Implement the complete house-rule five-card hierarchy and same-type comparisons.

### Production work

Implement:

- cross-type hierarchy: Straight < Flush < Full House < Four-of-a-Kind < Straight Flush;
- Straight: effective high, then suit of effective-high card;
- Flush: suit first, then descending ranks within same suit;
- Full House: triple rank;
- Four-of-a-Kind: quad rank; kicker irrelevant;
- Straight Flush: effective high, then suit of effective-high card.

### Test work

Add explicit tests for every comparison rule and special Straight case.

### Visible output

A named comparison suite with known winning/losing pairs.

### Acceptance criteria

- Kicker never changes Four-of-a-Kind comparison.
- Flush comparison is suit-first.
- Special Straight effective-high ordering is respected.

### Stop boundary

Do not generate legal Moves yet.

---

# 16. MM8 --- Deck, Shuffle, and Deal

### Documentation for Claude

**Must read:**
- `domain-model.md` — canonical Card representation.
- `engine.md` — deck/deal ownership, injected RNG contract, deterministic authoritative randomness, and round setup behavior.

**Read only if needed:**
- `testing-simulation.md` — deterministic-seed/reproducibility expectations.
- `requirements.md` — only to confirm fixed 4-player / 13-card setup if needed.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T13 --- Implement canonical 52-card deck creation

### Objective

Create the complete deck from shared card vocabulary.

### Production work

Implement deterministic deck creation before shuffling.

### Test work

Verify:

- exactly 52 cards;
- 13 ranks × 4 suits;
- no duplicates;
- exactly one `3♣`;
- exactly one `2♦`.

### Visible output

Passing deck-integrity tests.

### Acceptance criteria

Card identity is derived from rank+suit; no unnecessary global Card ID is required by public contracts.

### Stop boundary

Do not shuffle/deal yet.

---

## T14 --- Implement injected RNG and deterministic shuffle

### Objective

Make authoritative random operations reproducible.

### Production work

Implement/consume the documented `RNG` interface and a shuffle function that does not call uncontrolled `Math.random` internally.

### Test work

Verify:

- shuffle preserves all 52 cards;
- same deterministic RNG sequence/seed produces the same shuffle;
- controlled different sequences can produce different orders.

### Visible output

Two same-seed shuffles compare equal in tests.

### Acceptance criteria

Authoritative randomness is injectable and reproducible.

### Stop boundary

Do not deal into Round state yet unless required by the shuffle API.

---

## T15 --- Implement four-player deal and opening-player discovery

### Objective

Deal 13 cards to four players and identify the holder of `3♣`.

### Production work

Implement dealing from a supplied shuffled deck.

### Test work

Verify:

- four hands;
- 13 cards each;
- all 52 cards accounted for exactly once;
- opening player is the player holding `3♣`.

### Visible output

A deterministic fixture showing four 13-card hands and the expected opening player.

### Acceptance criteria

Deal logic does not contain AI/UI behavior.

### Stop boundary

Do not create full Turn state machine yet.

---

# 17. MM9 --- Legal-Move Generation

### Documentation for Claude

**Must read:**
- `domain-model.md` — canonical `Move`, `PlayMove`, `PassMove`, and combination vocabulary.
- `engine.md` — authoritative legality, opening 3♣ requirement, free-lead behavior, response rules, and legal-Move generation contract.

**Read only if needed:**
- `testing-simulation.md` — reference-vs-optimized equivalence testing guidance.
- `requirements.md` — only if a house-rule meaning is disputed.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T16 --- Generate free-lead combinations from a hand

### Objective

Create the correctness-first reference generator for valid playable combinations when there is no current combination to beat.

### Production work

Generate all valid combinations present in a hand.

For the POC, brute-force subset enumeration is acceptable where simple and correct.

### Test work

Use small known hands with manually enumerable expected combination sets.

### Visible output

An exact sorted/canonical legal-combination list for at least one fixture hand.

### Acceptance criteria

- No valid combination is omitted.
- No invalid combination is included.
- Output ordering is stable/canonical for reproducible tests.

### Stop boundary

Do not apply current-Trick response filtering yet.

---

## T17 --- Filter legal responses against the current combination

### Objective

Generate only combinations that legally beat the active Trick combination.

### Production work

Add response filtering using the authoritative comparison logic.

Rules include:

- same count/category for Single/Pair/Triple responses;
- five-card hands may cross types using the five-card hierarchy;
- candidate must outrank current combination.

### Test work

Fixtures should include:

- Single response;
- Pair response;
- Triple response;
- same-type five-card response;
- cross-type five-card response;
- zero playable responses.

### Visible output

Exact expected response sets from known hands.

### Acceptance criteria

No duplicate comparison implementation is introduced inside the generator.

### Stop boundary

Do not add opening-3♣ restrictions yet.

---

## T18 --- Add opening/free-lead/pass legality to legal-Move generation

### Objective

Convert combination generation into complete legal `Move` generation for a player's Turn context.

### Production work

Support:

- first Round opening must include `3♣`;
- free lead allows any valid combination but cannot Pass;
- response Turn allows qualifying plays and voluntary Pass;
- `Pass` remains available even when a legal beating play exists.

### Test work

Explicitly verify opening-with-3♣, opening-without-3♣ exclusion, free-lead no-Pass, response Pass availability, and zero-response Pass behavior.

### Visible output

Known fixture legal-Move lists containing exact Play/Pass options.

### Acceptance criteria

A public Pass never proves the player had no legal response.

### Stop boundary

Do not mutate game state in this task.

---

# 18. MM10 --- Authoritative Move Validation

### Documentation for Claude

**Must read:**
- `domain-model.md` — Move is intent, not proof of legality.
- `engine.md` — authoritative validation boundary, structured errors, and no-partial-mutation behavior.

**Read only if needed:**
- `requirements.md` — only if the product rule behind a validation case is unclear.
- `testing-simulation.md` — only for additional negative/atomicity test guidance.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T19 --- Implement `submitMove` validation boundary

### Objective

Reject invalid intents safely before state mutation.

### Production work

Implement structured validation/result behavior for at least:

- wrong player;
- card not owned;
- duplicate card submission;
- invalid combination;
- non-beating response;
- opening play missing `3♣`;
- illegal Pass on opening/free lead;
- valid voluntary Pass;
- valid Play.

Ordinary invalid Moves should return structured errors rather than throw unexpected exceptions.

### Test work

Create one focused test per rejection category plus valid examples.

### Visible output

A rejection matrix showing deterministic error/result categories and confirming rejected Moves do not partially mutate state.

### Acceptance criteria

State remains unchanged on rejection.

### Stop boundary

Do not implement complete turn advancement beyond what validation absolutely requires.

---

# 19. MM11 --- Turn and Trick State Machine

### Documentation for Claude

**Must read:**
- `domain-model.md` — canonical Move/Card identifiers used by state transitions.
- `engine.md` — authoritative turn order, pass cycle, Trick reset, free-lead, and state-transition ownership.

**Read only if needed:**
- `requirements.md` — product-level turn-flow fallback.
- `testing-simulation.md` — state-machine/invariant testing guidance.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T20 --- Implement accepted Play Turn transition

### Objective

Advance authoritative state after a valid Play.

### Production work

On accepted Play:

- remove cards from player's hand;
- update current Trick/last successful player;
- update public played-card information required by Engine state;
- select next eligible active player clockwise;
- preserve all invariants.

### Test work

Use controlled Round states and assert exact before/after snapshots.

### Visible output

A passing scenario showing hand reduction, current combination update, and next-player transition.

### Acceptance criteria

Cards are removed exactly once and no unrelated state changes.

### Stop boundary

Do not complete pass-cycle Trick reset yet.

---

## T21 --- Implement Pass cycle and Trick reset

### Objective

Handle voluntary Passes and establishment of a new free lead.

### Production work

Implement:

```text
successful play
-> other eligible players pass
-> all eligible opponents have passed
-> Trick ends
-> last successful player becomes/retains lead if still eligible
```

Finished-player complications belong to T22.

### Test work

Include:

- one Pass then continued response;
- complete pass cycle;
- new free lead;
- no Pass permitted on the resulting free lead.

### Visible output

Exact Turn/Trick state snapshots across the pass sequence.

### Acceptance criteria

Pass tracking correctly reflects active eligible players, not hardcoded "three passes" assumptions that would fail after players finish.

### Stop boundary

Do not finalize custom finished-player continuation until T22.

---

# 20. MM12 --- Finished-Player Handling

### Documentation for Claude

**Must read:**
- `engine.md` — authoritative finished-player behavior and custom Basic continuation rule after a player goes out.
- `requirements.md` — product truth for the custom continuation semantics.
- `domain-model.md` — shared player/card/move identifiers only.

**Read only if needed:**
- `testing-simulation.md` — targeted scenario/invariant coverage.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T22 --- Implement player finish and Basic continuation rule

### Objective

Correctly remove finished players from active rotation and apply the confirmed custom continuation behavior.

### Production work

When a player empties their hand in a mode where the Round continues:

1. record finish position/order;
2. remove them from future Turn rotation;
3. starting with the next active player clockwise, determine whether an active player can beat the finisher's final combination;
4. if at least one can, normal response play continues from the first such player in Turn order;
5. if nobody can beat it, the next active player clockwise receives a free lead.

### Test work

Cover both branches:

- someone can beat the final combination;
- nobody can beat it.

Also test multiple already-finished players in the rotation.

### Visible output

Scenario traces showing expected next player and whether the next Turn is a response or free lead.

### Acceptance criteria

The engine does not attempt to return Turn control to a finished player.

### Stop boundary

Do not implement Basic scoring until T23.

---

# 21. MM13 --- Basic Mode

### Documentation for Claude

**Must read:**
- `requirements.md` — Basic Mode product semantics, placements, and +5/+3/+2/0 scoring.
- `engine.md` — authoritative Basic Round termination/state/scoring contract.
- `domain-model.md` — shared mode/player identifiers used by the implementation.

**Read only if needed:**
- `testing-simulation.md` — Basic full-Round scenario coverage.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T23 --- Complete Basic Round termination and scoring

### Objective

Implement full Basic Mode authoritative Round semantics.

### Production work

Implement:

- Round continues until only one player remains with cards;
- finish order records first three players;
- remaining player is fourth;
- scores are `+5 / +3 / +2 / 0`.

### Test work

Use controlled state progression to verify:

- first finisher does not end Round;
- second finisher does not end Round;
- third finisher ends Round;
- fourth player is assigned automatically;
- exact score mapping.

### Visible output

A completed Basic Round fixture with finish order and score map.

### Acceptance criteria

Scoring comes from Engine rules, not caller/UI logic.

### Stop boundary

Do not implement Competitive scoring in this task.

---

# 22. MM14 --- Competitive Mode

### Documentation for Claude

**Must read:**
- `requirements.md` — Competitive immediate Round end, base penalties, unused-bomb rule, winner-final-play multiplier, and stacking semantics.
- `engine.md` — authoritative implementation/scoring contract, including no fabricated loser placements.
- `domain-model.md` — shared mode/card/combination vocabulary.

**Read only if needed:**
- `testing-simulation.md` — scoring matrix and edge-case test strategy.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T24 --- Implement Competitive Round immediate termination and base penalty

### Objective

Implement Competitive Mode's distinct Round-ending behavior and base penalty calculation.

### Production work

Implement:

- Round ends immediately when first player empties hand;
- winner is the only official finisher/winner;
- remaining players are losers without official placement ordering;
- 0-9 remaining cards use ×1 base penalty;
- 10-13 remaining cards use ×2 base penalty.

### Test work

Boundary cases should include 0, 1, 9, 10, and 13 remaining cards where meaningful.

### Visible output

A base-penalty table produced by tests.

### Acceptance criteria

Do not fabricate Competitive loser placements for Session average-placement use.

### Stop boundary

Do not add bomb/final-play multipliers yet.

---

## T25 --- Implement Competitive scoring multipliers and winner score

### Objective

Complete Competitive scoring exactly as confirmed.

### Production work

Implement:

- loser unused-bomb ×2 if final hand contains at least one qualifying condition: any 2, all four of a rank, or valid Straight Flush;
- multiple unused-bomb conditions do not stack beyond ×2;
- winner final-play ×2 if final combination contains a 2, is Four-of-a-Kind, or is Straight Flush;
- multiple winner-final conditions do not stack beyond ×2;
- loser and winner multipliers stack multiplicatively to ×4;
- losers receive negative scores;
- winner receives positive sum of loser penalties.

### Test work

Use table-driven cases for every multiplier combination: ×1, ×2 loser-only, ×2 winner-only, ×4 both.

Include a case with multiple qualifying unused bombs proving it remains ×2 rather than ×4 from that category alone.

### Visible output

A scoring breakdown fixture matching a hand-calculated expected result.

### Acceptance criteria

"Bomb" remains a scoring concept only and does not alter Trick legality.

### Stop boundary

Do not implement Session tiebreaks until T26.

---

# 23. MM15 --- Session Lifecycle

### Documentation for Claude

**Must read:**
- `requirements.md` — exactly five Rounds and product-level Session winner/tiebreak semantics.
- `engine.md` — authoritative Session state, accumulation, and mode-specific tiebreak implementation rules.
- `domain-model.md` — shared `GameMode` / player identifiers.

**Read only if needed:**
- `testing-simulation.md` — deterministic five-Round Session test expectations.

**Do not load for this milestone:** `ai.md`, `orchestrator.md`.


## T26 --- Implement five-Round Session accumulation and mode-specific tiebreaks

### Objective

Complete Engine-owned Session lifecycle needed before M2 orchestration.

### Production work

Implement:

- exactly five Rounds per Session;
- cumulative Session totals;
- round-win tracking;
- Basic final ranking:
  `total -> round wins -> average placement -> best Round score -> tie`;
- Competitive final ranking:
  `total -> round wins -> best Round score -> tie`;
- no invented Competitive loser placements.

### Test work

Create deterministic fabricated RoundResult fixtures rather than needing to play full games for every tiebreak test.

### Visible output

Known five-Round Session result tables for Basic and Competitive, including at least one tie resolved at each available tiebreak level.

### Acceptance criteria

Session always completes after exactly five completed Rounds.

### Stop boundary

Do not create GameRunner/Orchestrator automation.

---

# 24. MM16 --- Engine Views, Events, and Invariants

### Documentation for Claude

**Must read:**
- `engine.md` — authoritative Engine events, safe views, public contracts, and invariant ownership.
- `domain-model.md` — boundary between shared domain and Engine-specific public contracts.
- `testing-simulation.md` — invariant checks, failure diagnostics, and information-safety test expectations.

**Read only if needed:**
- `orchestrator.md` — only for the public `PlayerView` / Engine-event consumption boundary; do not implement Orchestrator behavior.
- `requirements.md` — only if a public information/product meaning needs confirmation.

**Do not load for this milestone:** `ai.md` unless a specific information-entitlement question cannot be resolved from Engine + testing docs.


## T27 --- Implement factual Engine event output

### Objective

Expose deterministic factual events required by later Orchestrator/testing without embedding presentation logic.

### Production work

Implement the documented Engine event contracts required by current Engine actions, such as:

- Round started;
- cards dealt;
- Turn changed;
- cards played;
- player passed;
- Trick ended;
- player finished;
- Round ended;
- score calculated;
- Session ended.

Only implement events actually supported by current state transitions; do not invent UI messages.

### Test work

Assert event sequences for representative accepted actions and Round completion.

### Visible output

An exact event sequence from a deterministic scenario.

### Acceptance criteria

Events state facts that occurred; they do not decide game rules.

### Stop boundary

Do not create logging persistence/formatting.

---

## T28 --- Implement information-safe Engine views

### Objective

Create public/player-specific views for later AI/UI use without leaking opponent private hands.

### Production work

Implement documented view contracts needed by M2:

- own hand visible in `PlayerView`;
- opponent card counts visible;
- opponent card identities hidden;
- public played cards/current Trick/scores/finished status exposed as documented.

### Test work

Explicitly test information leakage boundaries.

### Visible output

A fixture comparing authoritative state with each player's safe view and proving opponent hidden cards are absent.

### Acceptance criteria

No private opponent hand can be reconstructed directly from a view field supplied by Engine.

### Stop boundary

Do not add AI inference.

---

## T29 --- Implement reusable Engine invariant checker

### Objective

Provide correctness assertions reusable by M1 tests, M2 integration tests, and M3 simulation.

### Production work

Create debug/test invariant checks for at least:

- every authoritative Card is accounted for in exactly one valid location;
- no duplicate Card exists across hands/played zones;
- hand sizes never become negative;
- finished players have zero cards where applicable;
- current player is active/eligible;
- accepted Play removes exactly submitted cards;
- Session/Round status is internally consistent.

The checker may throw/assert in test/debug contexts; it is not a user-facing rules API.

### Test work

Verify both:

- valid states pass;
- intentionally corrupted fixtures fail with useful diagnostics.

### Visible output

A test showing a valid state succeeds and several corrupted states are detected.

### Acceptance criteria

Invariant code detects corruption but does not silently repair authoritative state.

### Stop boundary

Do not start batch simulation.

---

# 25. MM17 --- M1 Acceptance and Regression Gate

### Documentation for Claude

**Must read:**
- `requirements.md` — M1 product behavior and confirmed house rules being accepted.
- `domain-model.md` — canonical shared contracts.
- `engine.md` — complete authoritative Engine contract.
- `testing-simulation.md` — acceptance, deterministic regression, invariants, and diagnostic expectations.

**Read only if needed:**
- `orchestrator.md` — only to ensure M1 Engine contracts remain consumable by the next milestone; do not implement it.

**Do not load for this milestone:** `ai.md`; M1 acceptance does not include real AI.


## T30 --- Create deterministic Engine-level acceptance scenario

### Objective

Prove M1 components operate together through Engine public contracts before Orchestrator/AI work begins.

### Production work

Only minimal test fixtures/scripted controller helpers needed for testing. Do not implement the production `GameOrchestrator` or AI.

### Test work

Create at least:

1. one deterministic controlled Basic-mode scenario covering multiple Tricks through Round completion;
2. one deterministic controlled Competitive-mode scenario through immediate Round completion/scoring;
3. one five-Round Session result/accumulation scenario;
4. invariant checks after every accepted Move/state transition where practical;
5. a regression run of the full M1 unit suite.

Scripted/legal Moves may be supplied directly by tests. This is an Engine acceptance test, not the M2 automated game runner.

### Visible output

A final test command showing the complete M1 suite passes and deterministic result snapshots match expected values.

### Acceptance criteria

M1 is accepted only if:

- all required M1 production features are present;
- all M1 focused tests pass;
- acceptance scenarios pass;
- no known rule correctness failure remains;
- no unresolved documentation conflict is hidden;
- no React, real AI, Orchestrator, persistence, or networking implementation was required to reach the gate.

### Stop boundary

**Stop M1 here.** Begin M2 only after this gate is reviewed and accepted.

---

# 26. Manual Verification Strategy

Automated tests are preferred, but the user may manually execute tests when the coding assistant cannot run them.

For every task, the assistant should provide exact commands, preferably both focused and full regression variants, for example:

```bash
npm test -- CombinationClassifier.test.ts
npm test
```

Use the actual package scripts/test paths in the repository rather than blindly copying these examples.

When debugging failures manually:

1. preserve the failing test;
2. capture the exact assertion/error;
3. return the failure to the coding assistant;
4. fix production code or the test only after determining which conflicts with the established specification;
5. rerun the focused test;
6. rerun the full regression suite.

Do not weaken a correct test just to make a failure disappear.

---

# 27. Test Placement Strategy

Tests should be created **with each implementation slice**, not postponed until the end of a mini-milestone.

Preferred rhythm:

```text
Txx production code
-> Txx focused tests
-> run focused tests
-> run all existing tests
-> accept/commit Txx
-> next task
```

Whether tests are colocated (`Foo.test.ts` beside `Foo.ts`) or placed under a mirrored `tests/` tree may be chosen during project scaffolding. The key rule is consistency.

The implementation assistant should not reorganize test layout later without a concrete maintainability reason.

---

# 28. Regression Policy

Each completed task expands the regression baseline.

At the end of every later task:

- run the new focused test(s);
- then run all previously passing M1 tests.

If a previous test fails:

```text
new task is NOT complete
```

Determine whether the cause is:

- a genuine regression;
- an outdated test contradicting an approved newer contract;
- a newly discovered documentation conflict.

Only the first may be fixed directly in implementation. The latter two must be explained rather than silently resolved.

---

# 29. Review Checklist for the User / Project Manager

After each coding-assistant task, review:

- [ ] Did it implement only the assigned task?
- [ ] Is the production code present before/alongside the test work?
- [ ] Are there focused tests for the new behavior?
- [ ] Did the assistant actually run them, or clearly say it could not?
- [ ] Is there a visible output I can inspect?
- [ ] Did all previous tests still pass?
- [ ] Did any public contract change unexpectedly?
- [ ] Did any house rule change?
- [ ] Did the assistant add unnecessary future architecture?
- [ ] Did it report all incomplete work?
- [ ] Is the Git diff small enough to review?
- [ ] Is this a safe commit point?

If any answer is unclear, do not start the next task until the discrepancy is understood.

---

# 30. Recommended Prompt Template for Claude Free

Use a fresh/small prompt per task rather than asking Claude to implement an entire mini-milestone.

```text
We are implementing Pusoy Dos M1 task <TASK_ID>: <TASK_NAME>.

Relevant authoritative docs:
- requirements.md
- domain-model.md
- engine.md
- testing-simulation.md
- m1-task-breakdown.md section for <TASK_ID>

Assume all earlier accepted tasks are working as intended.

Scope:
<copy only the Production work / Test work / Acceptance criteria for this task>

Rules:
1. Implement only this task. Do not implement later tasks.
2. Do not change established house rules or public contracts unless a documented conflict requires user approval.
3. Prioritize accuracy/reliability, then speed, then memory.
4. Implement production code first.
5. Then write focused tests.
6. Then run the focused tests and existing regression tests if tools/context permit.
7. Do not claim tests passed unless actually run.
8. If tokens/context are insufficient, stop cleanly and report exactly what is incomplete.
9. Report changed files and test commands/results.

Before finishing, use this report format:
Status: COMPLETE | CODE COMPLETE / TESTS INCOMPLETE | CODE + TESTS COMPLETE / TEST EXECUTION INCOMPLETE | PARTIALLY IMPLEMENTED | BLOCKED BY CONFLICT | BLOCKED BY EXISTING REGRESSION

Completed:
...

Incomplete Work:
...

Tests Written:
...

Tests Actually Run:
...

Manual Verification Available:
...

Files Changed:
...
```

For especially difficult tasks such as T12, T18, T22, or T25, split the coding conversation further if Claude begins approaching its context limit rather than asking it to rush the remaining work.

---

# 31. Higher-Risk Tasks

The following deserve extra review because subtle errors could contaminate many later systems:

| Task | Risk | Review emphasis |
|---|---|---|
| T08 | Special Straight rules | Explicit A2345 / 23456 / JQKA2 / invalid wraps |
| T12 | Five-card comparison | Flush suit-first; Four-kind kicker ignored |
| T18 | Complete legal-Move generation | Opening 3♣; voluntary Pass; five-card hierarchy |
| T19 | Validation boundary | No partial state mutation on rejection |
| T21 | Trick reset | Active-player-aware pass cycle |
| T22 | Finished-player continuation | Custom Basic rule after finisher exits |
| T25 | Competitive multipliers | ×1/×2/×4 and non-stacking same-category triggers |
| T26 | Mode-specific Session tiebreaks | Competitive skips average placement |
| T28 | Safe views | No hidden-hand leakage |
| T29 | Invariants | Detection without silent repair |

These tasks may be split into an implementation pass and a test/verification pass if token constraints require it, but they are not accepted until both are complete.

---

# 32. Deferred Optimization Notes

During M1, do not prematurely replace clear reference logic solely to reduce runtime or memory.

Allowed future improvements include:

- optimized Card encoding;
- bitmask-based combination analysis;
- specialized legal-Move generators;
- memoized classification/comparison helpers;
- reduced temporary allocations;
- cache bounds/eviction;
- lookup tables.

Any optimized implementation must preserve the same observable results as the accepted M1 reference behavior and house-rule tests.

The public Domain/Engine contracts should not depend on a specific cache representation, bit width, or optimization strategy.

---

# 33. Documentation Conflict Rule During Coding

If implementation reveals an ambiguity or conflict among `requirements.md`, `domain-model.md`, `engine.md`, `testing-simulation.md`, and this file:

1. do not silently choose one interpretation;
2. identify the exact conflicting statements/files;
3. stop only the affected decision where practical;
4. continue unrelated safe work if it remains within task scope;
5. ask the user to resolve the product/rule meaning;
6. synchronize documentation only after approval.

House rules and product truth in `requirements.md` outrank borrowed external algorithms.

---

# 34. M1 Definition of Done

M1 may be declared complete when all T01-T30 acceptance criteria are satisfied and the final regression gate demonstrates:

```text
Shared Domain compiles
        ↓
Canonical ruleset is represented
        ↓
Cards/deck/shuffle/deal are correct
        ↓
Every combination is classified correctly
        ↓
Every combination comparison follows house rules
        ↓
Legal Moves are complete and correct
        ↓
Invalid Moves are rejected without mutation
        ↓
Turn/Trick/finish transitions are correct
        ↓
Basic Round flow/scoring is correct
        ↓
Competitive Round flow/scoring is correct
        ↓
Session accumulation/tiebreak behavior is correct
        ↓
Views/events/invariants are safe and deterministic
        ↓
Full M1 unit + acceptance suite passes
```

Only after this gate should the project move to **M2 --- Headless Orchestrator + AI POC**.

---

# 35. Current Conflict Status

At the time of this task breakdown, there are **no newly identified unresolved product or house-rule conflicts requiring approval** before M1 coding begins.

If a conflict appears during implementation, follow §33 rather than modifying rule semantics silently.

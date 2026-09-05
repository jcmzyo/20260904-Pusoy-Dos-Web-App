# Pusoy Dos --- M1 Implementation Task Breakdown

## M1 Task Plan (v2.0)

**Status:** Approved Phase 1 execution plan  
**Last Modified:** September 5, 2026  
**Milestone:** M1 — Basic Engine Core  
**Phase:** Phase 1 — Initial Playable Basic Game

---

# 1. Purpose

M1 produces the authoritative, UI-independent **Basic Mode** game engine. It is the first technical milestone of Phase 1; it does not by itself produce the Phase 1 working product. Phase 1 becomes complete only after M4 integrates the playable UI.

T01 work already in progress is carried forward if compatible with this plan. Do not redo accepted compatible work merely because this plan was rewritten.

# 2. M1 Technical Output

At M1 completion the repository must contain a tested pure-TypeScript engine that can represent and execute Basic Pusoy Dos rules, including a complete five-Round Session, without AI, React, persistence, or networking.

M1 includes: shared domain vocabulary needed by the Engine; canonical house `RulesetConfig`; card/deck/shuffle/deal; combination inspection/comparison; legal Move generation; validation; Turn/Trick state; Pass/reset behavior; finished-player continuation; Basic Round placement/scoring; five-Round Basic Session/tiebreak; safe views; factual events; invariants; focused and regression tests.

# 3. Explicitly Out of Scope

Do not implement during M1:

- Competitive Mode behavior or scoring.
- AI, difficulty levels, personalities, or strategic search.
- GameRunner/Orchestrator execution loops.
- Headless batch simulator.
- React/UI.
- persistence/Resume, Stats, Settings, or auto-pass.
- networking/backend.
- speculative frameworks for deferred features.

Known future concepts may justify a small stable seam such as `GameMode` or `RulesetConfig`, but must not increase M1 implementation scope.

# 4. Execution Rules

For every Txx task: read only the listed relevant docs/source; implement production code; add/update focused tests; run focused tests; run the appropriate broader regression; report changed files, commands, and actual results; then stop. Never claim a test passed if it was not executed. Do not weaken a correct test to make code pass. Every discovered bug requires a regression test. Avoid unrelated refactors.

Allowed partial statuses: **COMPLETE**, **CODE COMPLETE / TESTS INCOMPLETE**, **CODE + TESTS COMPLETE / TEST EXECUTION INCOMPLETE**, **PARTIALLY IMPLEMENTED**, **BLOCKED BY CONFLICT**, **BLOCKED BY EXISTING REGRESSION**.

If implementation reveals a conflict among `requirements.md`, `domain-model.md`, `engine.md`, this plan, or existing accepted behavior, stop and report it. Do not silently choose a new product rule.

Accuracy/reliability > speed > memory. Optimize only after correctness is demonstrated. Internal representations may later change without changing public contracts.

# 5. Documentation Loading Strategy

Always read the current task in this file. For domain tasks, read `domain-model.md`; for Engine/rule tasks, read `engine.md`; consult `requirements.md` for authoritative product/house-rule meaning. Do not load `ai.md`, `orchestrator.md`, UI material, or deferred Competitive sections unless a concrete boundary question requires them.

# 6. Task Map

| Mini-milestone | Tasks | Technical checkpoint |
|---|---|---|
| MM1 Foundation | T01–T02 | TypeScript/Vitest project runs |
| MM2 Shared domain | T03–T04 | Canonical Card/Move/Basic vocabulary compiles |
| MM3 Rules primitives | T05–T06 | Ruleset + primitive comparison tested |
| MM4 Small combinations | T07 | Single/Pair/Triple inspection tested |
| MM5 Straights | T08 | Special straight rules tested |
| MM6 Five-card classification | T09–T10 | All five-card types classified |
| MM7 Comparison | T11–T12 | Same-type and five-card hierarchy comparison tested |
| MM8 Deck/deal | T13–T15 | Deterministic 52-card deal tested |
| MM9 Legal moves | T16–T18 | Complete legal Move generation tested |
| MM10 Validation | T19 | Rejected/accepted Move behavior tested |
| MM11 Turn/Trick | T20–T21 | Pass, response cycle, free lead tested |
| MM12 Finishing | T22 | Basic finished-player continuation tested |
| MM13 Basic Round | T23 | Placement +5/+3/+2/0 tested |
| MM14 Basic Session | T24 | Exactly five Rounds + tiebreak tested |
| MM15 Engine boundaries | T25–T27 | Events, views, invariants tested |
| MM16 Acceptance | T28 | Full M1 regression/typecheck passes |

# 7. Detailed Tasks

## T01 — Create minimal TypeScript project structure
**Objective:** establish the smallest repository structure needed for a pure TypeScript engine and tests.  
**Production:** package metadata, TypeScript configuration, source/test directories as needed; no React.  
**Tests:** configuration need not contain game tests yet.  
**Acceptance:** install/build/typecheck command is documented and succeeds. Preserve compatible work already underway.  
**Stop:** do not implement game types.

## T02 — Configure Vitest smoke test
**Objective:** prove the test runner works.  
**Production:** minimal test configuration only.  
**Tests:** one trivial smoke test executed successfully.  
**Acceptance:** focused test and typecheck visibly pass.  
**Stop:** no game rules.

## T03 — Implement `Rank`, `Suit`, and `Card`
**Must read:** `domain-model.md`, relevant `engine.md` card rules.  
**Production:** canonical immutable/shared vocabulary; Card identity remains rank+suit.  
**Tests:** valid construction/usage and canonical values.  
**Acceptance:** no UI/ownership/AI metadata leaks into Card.

## T04 — Implement remaining M1 shared vocabulary
**Production:** `PlayerId`, `CombinationType`, `Combination`, `Move`, `PlayMove`, `PassMove`, and `GameMode` as documented. `competitive` may remain vocabulary but does not activate Competitive behavior.  
**Tests:** discriminated Move behavior/type-level usage as practical.  
**Acceptance:** no giant shared `Player` object and no subsystem implementation details.

## T05 — Implement `RulesetConfig` and canonical house rules
**Production:** rank order, suit order, five-card order, straight rules needed by Basic play.  
**Tests:** canonical configured values.  
**Acceptance:** configuration is a lightweight rule seam, not a plugin framework.

## T06 — Implement primitive rank/suit/single comparison helpers
**Tests:** 3 lowest, 2 highest; Clubs < Spades < Hearts < Diamonds; same-rank singles resolved by suit.  
**Acceptance:** helpers use authoritative RulesetConfig semantics.

## T07 — Inspect Single, Pair, and Triple
**Production:** authoritative combination inspection for 1/2/3-card sets.  
**Tests:** valid/invalid sizes/ranks and representative cases.  
**Acceptance:** inspection does not imply a Move is legal in current state.

## T08 — Implement house-rule Straight detection and strength
**Tests required:** A2345 valid/weakest/effective high 5; 23456 valid/second weakest/effective high 6; 34567…10JQKA and JQKA2 valid; KA234 and QKA23 invalid; tie uses suit of effective high card.  
**Acceptance:** exhaustive/representative edge coverage; no standard-poker rule silently overrides house rules.

## T09 — Inspect Flush and Full House
**Tests:** Flush validity and suit-first comparison metadata; Full House triple-rank strength.  
**Acceptance:** Flush comparison is suit first, then descending ranks within same suit.

## T10 — Inspect Four-of-a-Kind and Straight Flush
**Tests:** Four-kind requires quad+kicker and compares by quad rank; kicker irrelevant to strength; Straight Flush uses house Straight semantics.  
**Acceptance:** all valid five-card categories can be inspected.

## T11 — Compare same-category combinations
**Tests:** Singles/Pairs/Triples and every five-card category according to house rules.  
**Acceptance:** deterministic strict comparison result.

## T12 — Compare five-card hierarchy and cross-type responses
**Tests:** Straight < Flush < Full House < Four-of-a-Kind < Straight Flush, including cross-category wins/losses.  
**Acceptance:** no bomb/trick-breaking exception exists.

## T13 — Construct canonical 52-card deck
**Tests:** exactly 52 unique rank+suit combinations, no jokers.  
**Acceptance:** deterministic unshuffled construction.

## T14 — Implement injected deterministic shuffle
**Production:** authoritative shuffle consumes injected RNG; no uncontrolled `Math.random`.  
**Tests:** same RNG sequence/seed yields same shuffle; deck conservation.  
**Acceptance:** shuffle does not own global randomness.

## T15 — Deal four 13-card hands
**Tests:** four players, 13 each, all 52 unique cards distributed exactly once; identify 3♣ holder.  
**Acceptance:** no card duplication/loss.

## T16 — Generate legal opening Moves
**Tests:** opening cannot Pass; every legal opening contains 3♣; valid 1/2/3/5-card combinations containing 3♣ are considered.  
**Acceptance:** Engine, not AI/UI, owns legality.

## T17 — Generate legal response Moves
**Tests:** Pass allowed while responding; 1/2/3 responses require same category/count and beat current hand; five-card responses obey hierarchy; no non-beating plays.  
**Acceptance:** returned plays are legal by construction.

## T18 — Generate complete free-lead and response candidate sets
**Production:** complete enumeration with correctness-first implementation; optimization allowed only with equivalence tests.  
**Tests:** compare representative hands against brute/reference enumeration where practical.  
**Acceptance:** no legal candidate omitted due to optimization.

## T19 — Validate and atomically submit Moves
**Tests:** wrong player, cards not owned, invalid combination, illegal Pass, non-beating response, opening violation; accepted Play removes exactly submitted cards; rejected Move causes no partial mutation.  
**Acceptance:** ordinary invalid Moves return structured errors rather than exceptions.

## T20 — Implement Turn rotation and response-cycle Pass tracking
**Tests:** clockwise rotation, active-player skipping, voluntary Pass, new successful Play starts a new response cycle and clears prior Pass state.  
**Acceptance:** exactly one active Turn owner during normal input.

## T21 — Implement Trick reset and free lead
**Tests:** all other eligible active players Pass → last successful player receives free lead; Pass state does not leak into new Trick; finished/ineligible players do not count.  
**Acceptance:** free lead cannot Pass.

## T22 — Implement Basic finished-player continuation
**Tests:** empty hand records finish/removes player; after a finisher's final play, starting next active clockwise find first player able to beat it; if one exists normal response continues; if none, next active player free leads.  
**Acceptance:** no deadlock and no finished player re-enters rotation.

## T23 — Complete Basic Round lifecycle and scoring
**Tests:** first three finishers become 1st/2nd/3rd, final active player 4th; scores +5/+3/+2/0; Round ends only when Basic completion condition is met.  
**Acceptance:** complete official Round result.

## T24 — Complete five-Round Basic Session and tiebreak
**Tests:** exactly five Rounds; cumulative totals equal Round results; winner order: total score → round wins → lower average placement → highest single Round score → genuine tie.  
**Acceptance:** no Competitive scoring/tiebreak implementation.

## T25 — Emit factual Engine events
**Production:** events needed by later Orchestrator/UI/simulation such as Session/Round start, deal, turn change, play, Pass, Trick end, finish, Round end, score, Session end.  
**Tests:** representative event ordering/payload facts.  
**Acceptance:** events report facts; they do not contain UI presentation logic.

## T26 — Implement information-safe views
**Production:** `PlayerView` and public view contracts needed by controllers/UI.  
**Tests:** own hand visible to owner; opponent hands hidden; public played cards/counts/current trick/scores exposed only as documented.  
**Acceptance:** future bots cannot require private Engine state.

## T27 — Enforce Engine invariants
**Tests/checks:** 52-card conservation, unique card locations, four v1 players, zero-card finished players, valid turn owner, opening 3♣ rule, accepted response beats current combination, Pass/reset integrity, Basic placement/session totals.  
**Acceptance:** invariant failures are diagnosable and usable by later simulator.

## T28 — M1 acceptance regression
**Production:** no new feature work except fixes required by M1 acceptance.  
**Run:** full test suite, typecheck/build checks, and any documented lint command.  
**Acceptance:** no known Basic Engine correctness/invariant defect; all executed results reported; deferred features remain unimplemented.  
**Output:** M1 completion report with commands, results, changed files, and any remaining non-blocking risks.

# 8. Higher-Risk Tasks

T08, T12, T18, T19, T21, T22, T24, T26, and T27 deserve a fresh review pass because errors can silently affect many later games.

# 9. M1 Definition of Done

M1 is complete only when T28 passes and the Basic Engine can support the next milestone without rule logic being duplicated in controllers. M1 completion does **not** imply AI, simulator, or UI completion.

# 10. Phase 1 Context After M1

- **M2:** Baseline AI + Headless Game.
- **M3:** Headless Simulator + Reliability.
- **M4:** Minimal Playable UI.

No milestone beyond M4 is committed. Post-Phase-1 work is replanned after evaluating the working playable product.

# Pusoy Dos --- AI System Design

## AI System Document (v1.4)

**Status:** Draft for implementation  
**Last Modified:** September 9, 2026
**Parent document:** `requirements.md` v1.12  
**Shared model:** `domain-model.md` v1.2  
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.3  
**Module:** AI System  
**Language:** TypeScript

---

# 1. Purpose

The AI System chooses a legal `Move` for an AI-controlled player using only information that player is permitted to know.

It answers:

> Given an information-safe player view, the current legal Moves, the selected game mode, the current Session context, the bot personality, and the bot difficulty, which legal Move should this bot prefer?

The AI is **not** authoritative for legality, scoring, turn order, card ownership, combination validity, Round completion, or Session completion. Those responsibilities remain with the Game Engine.

The AI is also not responsible for driving the game loop. The Game Orchestrator requests a Move from `AIController`; the AI System evaluates the position and returns one proposed legal Move.

For the initial implementation:

- supported game modes are **Basic** and **Competitive**;
- no future setup modifiers/game twists are considered;
- the only required personality is **Optimizer**;
- supported difficulties are **Easy**, **Normal**, and **Hard**;
- AI decisions are deterministic;
- personalities and controlled randomness remain extension points.

---

# 2. Core Design Principles

The AI System follows these principles:

1. **Engine-authoritative legality.** The AI ranks engine-generated legal Moves and must not implement a competing legality system.
2. **Fair information only.** The AI must never inspect unrevealed opponent hands or engine-internal hidden state.
3. **Session-aware play.** The AI aims to improve its final five-Round Session outcome, not merely maximize the chance of winning the current Round.
4. **Mode-aware evaluation.** Basic and Competitive use one shared decision framework but different mode-specific utility policies.
5. **Difficulty is capability, not sabotage.** Easy bots are weaker because they reason less deeply or consider fewer strategic factors, not because they intentionally make irrational Moves.
6. **Personality and difficulty are orthogonal.** Personality defines strategic preference; difficulty defines how effectively the bot executes that preference.
7. **Deterministic first implementation.** The same decision inputs produce the same Move.
8. **Accuracy-first bounded computation.** Correct and reproducible evaluation comes before speed; lookahead must still be bounded so slower devices degrade in compute time rather than correctness or runaway execution.
9. **Explainable decisions.** Evaluation should expose component scores or reasons during testing/debugging so poor decisions can be reproduced and tuned.

---

# 3. Architectural Boundary

```text
Game Orchestrator
      │
      │ safe PlayerView + engine-generated legal Moves
      ▼
AIController
      │
      ▼
AI Decision Engine
      │
      ├── shared analysis
      ├── mode policy
      ├── Session context
      ├── personality policy
      └── difficulty profile
      │
      ▼
chosen legal Move
      │
      ▼
Game Orchestrator
      │
      ▼
Game Engine
```

The AI may depend on:

- `/domain` shared types;
- Engine-owned public contracts such as `PlayerView`;
- Engine-produced legal Moves;
- AI-owned configuration and analysis types.

The AI must not depend on:

- engine-internal authoritative state;
- unrevealed opponent hands;
- React or UI state;
- persistence implementation;
- browser storage;
- logging implementation;
- future networking internals.

---

# 4. Responsibilities

The AI System owns:

- choosing among legal Moves supplied by the Engine;
- analyzing the bot's own hand;
- evaluating the resulting hand after candidate Moves;
- estimating future hand efficiency;
- evaluating control-card/resource preservation;
- interpreting public opponent threat information;
- interpreting publicly played cards;
- evaluating Session score context;
- applying Basic- or Competitive-specific strategic objectives;
- applying personality preferences;
- applying difficulty-dependent reasoning capability;
- bounded tactical/endgame lookahead;
- deterministic candidate ranking and tie-breaking;
- AI-specific diagnostics needed for testing and balancing.

---

# 5. Non-Responsibilities

The AI System does **not** own:

- legal Move generation rules;
- combination validity or comparison rules;
- authoritative scoring;
- authoritative Round or Session state;
- deciding whose Turn it is;
- submitting Moves directly to authoritative state;
- controller lifecycle or async game-loop coordination;
- UI presentation delays or animations;
- persistence;
- event retention/formatting;
- opponent difficulty/personality metadata for decision-making;
- future game-modifier rules unless explicitly added later.

---

# 6. Permitted Information

Every difficulty level follows the same information-access boundary.

The AI may use information legitimately available through its `PlayerView`, legal-Move set, and other explicitly public contracts, including:

- its own full hand;
- current trick/current combination;
- whether it currently has a free lead;
- current Turn/turn order when publicly exposed;
- legal Moves generated by the Engine;
- publicly played cards;
- public pass actions;
- opponent remaining-card counts;
- finished/active-player status;
- Basic finish order already established;
- current Round number;
- current Session score totals;
- number of Rounds remaining;
- public scoring/results already revealed.

The AI must not use:

- unrevealed opponent hands;
- hidden engine state not represented in an information-safe contract;
- opponent configured difficulty;
- opponent configured personality;
- another bot's private evaluation state;
- future RNG state;
- private reasons for human auto-pass.

## 6.1 Opponent model assumption

For the initial AI, opponents are modeled as rational players attempting to improve their own Session outcome.

A bot may reason from public facts such as:

> An opponent has one card remaining, so allowing that opponent a free lead is dangerous.

It must not reason from hidden configuration such as:

> That opponent is Easy, so it will probably miss the winning Move.

Difficulty/personality inference from observed behavior may be researched later, but it is not part of the initial AI contract.

A public `Pass` is an observed action only. Because house rules allow voluntary passing even when a legal response exists, the initial AI must **not** conclude that an opponent lacks a card/combination solely from a Pass. Rich pass-behavior belief modeling is deferred.

---

# 7. Shared Decision Pipeline

For every AI Turn:

```text
1. Receive PlayerView and legal Moves from the Orchestrator/Engine boundary.
2. Build an AI DecisionContext.
3. Analyze the current own hand once.
4. Analyze public game/Session context once.
5. For each candidate legal Move:
     a. simulate the resulting own hand;
     b. evaluate cards shed;
     c. evaluate remaining-hand structure;
     d. evaluate minimum future plays;
     e. evaluate control/resource cost;
     f. evaluate opponent threat response;
     g. evaluate public-card implications;
     h. evaluate mode-specific consequences;
     i. evaluate Session-level consequences;
     j. apply personality preference;
     k. perform difficulty-permitted lookahead when appropriate.
6. Rank candidates.
7. Resolve ties deterministically.
8. Return the selected legal Move.
```

The AI evaluates the **resulting hand and game position**, not only the combination being played.

---

# 8. Shared Evaluation Factors

## 8.1 Cards shed

Reducing remaining-card count is generally beneficial.

However, a larger play is not automatically better. A five-card combination may be inferior if it destroys a much stronger remaining structure or wastes critical control.

## 8.2 Remaining-hand structure

The AI should estimate how easy the resulting hand is to finish.

Relevant features include:

- useful Singles/Pairs/Triples;
- valid five-card combinations;
- awkward/orphan cards;
- overlap between possible combinations;
- number of future plays likely required;
- flexibility of the remaining cards.

## 8.3 Minimum-play solver

The initial Optimizer should include a memoized solver that estimates or computes the minimum number of valid plays needed to empty a given own-hand subset.

Conceptually:

```text
minPlays(hand) =
    min over valid combinations C in hand:
        1 + minPlays(hand - C)
```

Because an own hand contains at most 13 cards, a bitmask-based memoized state space is small enough to be practical for interactive and simulation use. The preferred exact set-partition implementation should memoize by hand mask and may reduce duplicate partition work by requiring each explored combination to contain a canonical remaining card such as the lowest-set bit. This optimization changes enumeration order only; it must not change which house-rule-valid combinations are considered.

`minPlays` is an important heuristic, not a complete measure of strategic strength; it must be combined with control, opponent threat, mode, and Session context.

## 8.4 Combination opportunity cost

A card may participate in several useful future combinations. Candidate evaluation should account for structures destroyed or preserved by a Move.

The AI should not use simplistic fixed assumptions such as:

```text
Straight is always better to play than Pair because it sheds more cards.
```

The correct question is whether the resulting hand is strategically better.

## 8.5 Control/resource preservation

Strong cards and combinations can help regain or preserve the lead.

Candidate evaluation should measure whether the bot is spending substantially more strength than required for the tactical benefit obtained.

Examples include preserving:

- 2s;
- Aces/high Singles;
- strong Pairs/Triples;
- strong five-card combinations;
- combinations that provide likely future control.

## 8.6 Free-lead value

A free lead is strategically valuable because any valid combination may be played.

When leading, the AI should emphasize hand restructuring and disposal of awkward cards/combinations.

When responding, it should weigh the value of taking control against the resources consumed to do so.

## 8.7 Opponent threat

Opponent remaining-card counts and seat/turn position influence tactical urgency.

A player with one card remaining represents greater immediate danger than one with many cards.

Threat evaluation should consider:

- opponent card count;
- whether the opponent acts soon;
- whether the opponent currently controls the trick;
- whether the opponent has already finished in Basic Mode;
- how relevant that opponent is to the current Session standings.

## 8.8 Public-card analysis

Publicly played cards may be used to determine which threats remain possible.

For example, if every legal Single stronger than one of the bot's remaining Singles is known to be gone, that card gains strong control value.

This is deterministic deduction from public information and does not constitute hidden-information access.

## 8.9 Passing

`Pass` is a legitimate candidate whenever the Engine says it is legal.

The bot may voluntarily pass when preserving cards/control has greater expected value than winning the current exchange.

It must not pass merely because it is Easy or because a random weakness rule forces it to do so.

---

# 9. Session-Aware Strategy

The bot's ultimate objective is its **final Session result after five Rounds**.

Round-level evaluation must therefore consider:

- current Session score;
- score gaps to relevant rivals;
- current Round number;
- remaining Rounds;
- whether a rival can overtake the bot;
- whether blocking one specific opponent improves the bot's expected final Session outcome;
- risk/reward of aggressive vs defensive Round play.

A bot may rationally choose a Move that slightly reduces its chance of winning the current Round when that Move materially improves its chance of winning the Session.

## 9.1 Rival targeting

Targeting a strategically important rival is permitted when supported by public Session information.

For example, in the final Round, a bot leading the Session may prefer to block the player one point behind rather than a player who cannot realistically overtake it.

This is legitimate Session strategy, not personality leakage or cheating.

Difficulty determines how accurately the bot reasons about these consequences.

---

# 10. Basic Mode Evaluation

Basic Mode continues until all placements are determined.

Its mode policy should approximate:

> Maximize expected Session outcome by improving Round placement while preserving the ability to continue competing after other players finish.

Important Basic factors include:

- expected finish position;
- probability/ability to go out early;
- ability to retain/regain control;
- hand efficiency after the Move;
- preventing important rivals from finishing ahead;
- continued value of strong cards after another player goes out;
- current Session standings.

Because gameplay continues after first place is established, a bot must continue optimizing for second/third rather than behaving as if the Round has already been lost.

The evaluator should re-assess placement goals as players finish and the active field shrinks.

---

# 11. Competitive Mode Evaluation — Deferred

Competitive Mode ends immediately when the first player empties their hand.

Its mode policy should approximate:

> Maximize expected Session outcome by winning the Round when practical while minimizing penalty exposure if another player ends the Round first.

Competitive evaluation must understand:

- remaining-card count;
- the 10-card base-penalty threshold;
- unused-bomb exposure;
- 2s remaining in hand;
- Four-of-a-Kind remaining in hand;
- Straight Flush remaining in hand;
- opponent proximity to going out;
- immediate finishing opportunities;
- potential Session score swing.

For each candidate Move, the AI should be able to evaluate a useful counterfactual:

> If another player ended the Round immediately after this Move, how dangerous would my remaining hand be?

This can cause Competitive strategy to spend cards that Basic strategy would preserve for control.

## 11.1 Penalty exposure

AI-specific analysis may represent current penalty exposure conceptually as:

```ts
interface PenaltyExposure {
  readonly remainingCardCount: number;
  readonly basePenaltyMultiplier: 1 | 2;
  readonly hasUnusedBomb: boolean;
  readonly estimatedCurrentPenalty: number;
}
```

This is AI analysis derived from authoritative scoring rules; it does not replace the Engine's scoring calculation.

---

# 12. Personality Model — Deferred Beyond Baseline

Personality and difficulty are separate dimensions.

```text
Personality = what strategic style the bot prefers.
Difficulty  = how effectively it pursues that style.
```

The initial personality is:

## 12.1 Optimizer

Optimizer attempts to maximize its expected final Session outcome using the strongest reasoning allowed by its difficulty profile.

It does not claim mathematically optimal game-theoretic play.

Its candidate utility is based on explicit evaluators and bounded search.

## 12.2 Future personalities

The architecture must support future personalities without redesigning difficulty.

Planned examples include:

- Chaotic;
- Risk-Averse / Minimizer;
- Greedy;
- Spoiler;
- Card Counter.

Future personality policies may change strategic weights, risk preference, targeting tendencies, or acceptable near-optimal alternatives.

They must still respect:

- authoritative Engine legality;
- information-access rules;
- mode rules;
- difficulty capability boundaries.

A personality should not require intentional irrationality. For example, a future Chaotic bot should prefer unconventional but defensible alternatives rather than simply selecting obviously bad Moves.

---

# 13. Difficulty Philosophy — Deferred

All difficulties:

- try to improve their final Session outcome;
- receive the same permitted information boundary;
- never receive hidden opponent cards;
- do not know opponent difficulty/personality;
- only return legal Moves supplied by the Engine;
- do not intentionally sabotage themselves;
- are deterministic in the initial implementation.

Difficulty changes **decision quality** through capability differences such as:

- candidate breadth;
- feature/evaluation sophistication;
- use of public information;
- opponent-threat analysis;
- Session reasoning depth;
- lookahead depth/budget;
- endgame planning quality.

Over sufficiently large balanced simulations, the target expectation is:

```text
Hard   > Normal > Easy
```

for average Session performance.

This is a statistical balancing target, not a guarantee that Hard wins every individual deal or Session.

---

# 14. Easy Difficulty — Deferred

Easy represents a player with sound rules knowledge and basic strategic intent but limited planning depth.

Easy should:

- evaluate a reduced set of reasonable candidate Moves;
- strongly understand immediate card reduction;
- use basic resulting-hand structure;
- use limited/minimally weighted minimum-play information;
- preserve obviously valuable control resources;
- recognize obvious threats such as an opponent with very few cards;
- use coarse Session state such as ahead / close / behind;
- make minimal use of public-card history;
- use little or no tactical lookahead;
- use only simple endgame evaluation.

Easy should lose more often over large samples because it overlooks subtle stronger lines, not because the system forces bad Moves.

---

# 15. Normal Difficulty — Deferred

Normal is the reference competent AI level and should use most of the initial Optimizer framework.

Normal should:

- consider all or nearly all meaningful legal Moves;
- use full resulting-hand analysis;
- use the minimum-play solver;
- evaluate combination opportunity cost;
- preserve control intelligently;
- use opponent card counts and turn position;
- use public played-card information;
- reason about actual Session score gaps and Rounds remaining;
- identify strategically important Session rivals;
- use selective shallow lookahead;
- use a limited endgame planner.

Normal should feel purposeful and strategically competent without attempting exhaustive hidden-information search.

---

# 16. Hard Difficulty — Deferred

Hard uses the same fair information as Easy and Normal but reasons more thoroughly.

Hard should:

- evaluate the full candidate set;
- use full hand-structure and opportunity-cost analysis;
- use the minimum-play solver systematically;
- analyze public played cards more thoroughly;
- estimate control potential more accurately;
- perform richer opponent-threat analysis;
- reason about exact Session-outcome consequences when practical;
- strategically target relevant Session rivals;
- use adaptive deeper tactical/endgame search;
- use stronger deductions from **hard public facts** such as played cards, card counts, finish state, and turn context.

Hard must not inspect hidden hands or opponent difficulty/personality.

Full inference-heavy card counting remains a potential future specialization for the Card Counter personality. Hard Optimizer may still use stronger public deduction than Normal, but should not become equivalent to a dedicated Card Counter personality by default.

---

# 17. Difficulty as Reusable Capability Profiles

Difficulty must be reusable across current and future personalities.

Avoid scattering logic such as:

```ts
if (difficulty === 'hard') {
  // special personality-specific behavior
}
```

throughout the AI.

Prefer a capability/configuration profile conceptually similar to:

```ts
interface DifficultyProfile {
  readonly candidateBreadth: CandidateBreadth;
  readonly handAnalysisLevel: HandAnalysisLevel;
  readonly publicHistoryLevel: PublicHistoryLevel;
  readonly opponentModelLevel: OpponentModelLevel;
  readonly sessionStrategyLevel: SessionStrategyLevel;
  readonly search: SearchBudget;
}

interface SearchBudget {
  readonly maxDepth: number;
  readonly maxNodes: number;
  readonly endgameCardThreshold: number;
}
```

Personality policies consume these capabilities rather than redefining difficulty.

---

# 18. Lookahead and Search

The initial AI should not use unrestricted minimax, exhaustive game-tree search, or full hidden-hand enumeration.

Hidden opponent hands make naive perfect-information minimax a poor fit, while unrestricted branching can create unnecessary runtime cost.

Use:

```text
heuristic evaluation
+
selective bounded tactical/endgame search
```

Search becomes more valuable when:

- the bot has few cards remaining;
- an opponent has very few cards remaining;
- Competitive round-end risk is high;
- the number of legal candidates is small;
- a short finishing sequence may exist;
- late-Session score consequences are important.

Every search implementation must enforce hard computation limits such as:

- maximum search depth;
- maximum visited nodes;
- mode/difficulty-specific activation conditions.

The game must not depend on intentionally slow computation to simulate thinking.

---

# 19. Endgame Planning

Endgame planning should focus on high-value short sequences rather than attempting to solve the entire hidden-information game.

Useful questions include:

### Basic

- Can the bot sequence its remaining combinations to go out soon?
- Can it preserve a control card that enables a future free lead?
- If first place is already gone, what sequence improves second/third-place chances?

### Competitive

- Can the bot finish immediately?
- Can it plausibly finish the next time it gets control?
- Is another player likely to end the Round before then?
- Which candidate leaves the lowest penalty exposure if the Round ends immediately afterward?

Difficulty determines how thoroughly these questions are explored.

---

# 20. Determinism and Tie-Breaking

For the initial implementation:

```text
same permitted game state
+ same legal Moves
+ same mode
+ same personality
+ same difficulty
= same chosen Move
```

If two candidates receive the same primary score, ties should be resolved using stable strategic secondary criteria before falling back to canonical card/Move ordering.

The exact tie-break sequence remains an implementation decision, but it must be deterministic and testable.

---

# 21. Future Controlled Randomness

Randomness is deferred from the first implementation.

When introduced, it should not normally force irrational play.

Preferred future behavior:

1. deterministically evaluate/rank candidates;
2. identify candidates within a configured utility tolerance of the best Move;
3. allow a personality/configuration to choose among those viable alternatives using seeded RNG.

A clearly inferior Move should not become eligible merely because the bot is Easy.

Different personalities may eventually use different variation tolerances while difficulty continues to control reasoning capability.

---

# 22. Candidate Evaluation Model

A useful debug-facing representation is:

```ts
interface MoveEvaluation {
  readonly move: Move;
  readonly cardsShedScore: number;
  readonly handStructureScore: number;
  readonly minPlayScore: number;
  readonly controlScore: number;
  readonly opponentThreatScore: number;
  readonly publicKnowledgeScore: number;
  readonly modeScore: number;
  readonly sessionScore: number;
  readonly personalityScore: number;
  readonly lookaheadScore: number;
  readonly totalScore: number;
}
```

The exact fields may evolve.

The important requirement is that tests and simulations can explain why one candidate outranked another without exposing these diagnostics as authoritative game rules.

---

# 23. AI Decision Context

An AI-owned context may conceptually contain:

```ts
interface AIDecisionContext {
  readonly playerId: PlayerId;
  readonly mode: GameMode;
  readonly view: PlayerView;
  readonly legalMoves: readonly Move[];
  readonly personality: AIPersonality;
  readonly difficulty: AIDifficulty;
  readonly roundNumber: number;
  readonly roundsRemaining: number;
}
```

Exact Session fields may already be available through `PlayerView`; this type should not duplicate engine contracts unnecessarily.

Opponent difficulty/personality must not be included as strategic information.

---

# 24. AI Controller Boundary

`AIController` remains an Orchestrator-owned Player Controller implementation/adapter.

Conceptually:

```text
GameRunner
   ↓
AIController
   ↓
AIStrategy / DecisionEngine
   ↓
Move
```

The AI subsystem owns the decision implementation used by the controller, while `orchestrator.md` owns when and how the controller is invoked.

A conceptual AI strategy contract may be:

```ts
interface AIStrategy {
  chooseMove(context: AIDecisionContext): Move;
}
```

The exact API is not frozen.

---

# 24.1 External Algorithm Reference Policy

Card-game algorithms and implementations may be used as references for efficient techniques, but **the Pusoy Dos house rules in `requirements.md` and the authoritative Engine contracts in `engine.md` always win**.

Borrowed techniques must be adapted and tested rather than copied semantically. In particular:

- generic Poker Straight rules must be replaced by this project's configured Straight patterns/order;
- generic hand-strength tables must not replace the project's five-card hierarchy or same-type comparison rules;
- external Big-Two assumptions about Suit order, 2s, bombs, opening rules, Round endings, or scoring must not leak into evaluation;
- AI analysis may only operate on legal Moves supplied by our Engine.

Recommended reference techniques for the POC are:

- bitmask/bitset hand representation internally;
- Rank/Suit frequency analysis;
- exact memoized set-partition DP for minimum future play count;
- lowest-set-bit/canonical-card reduction for DP partition enumeration;
- memoized hand-analysis results;
- conservative dominance/candidate pruning only when strategic equivalence is justified;
- bounded memoized DFS/endgame search.

Monte Carlo determinization/ISMCTS, rich hidden-hand belief models, and learned policies remain future experiments, not dependencies of the initial architecture.

---

# 25. Internal Performance Representation

The shared domain representation remains `Card`/`readonly Card[]`.

The AI may internally convert card sets to an efficient bitmask/bitset representation for:

- subset operations;
- candidate result simulation;
- memoization;
- minimum-play solving;
- played-card lookup;
- public remaining-card analysis.

This representation is an AI implementation detail and must not force a change to the shared domain model. Cache shape, key encoding, precomputation strategy, and memory policy are intentionally replaceable so future optimization can reduce memory or improve speed without changing callers.

---

# 26. POC Optimization Priority and Performance Requirements

The initial POC follows this engineering priority:

1. **Accuracy and reliability** --- correct house-rule interpretation, legal-candidate consumption, deterministic evaluation, and reproducible decisions.
2. **Speed** --- optimize measured bottlenecks without weakening correctness. Slower devices may require more computation time, especially for Hard decisions.
3. **Memory usage** --- memoization/caching may be generous in the POC. Reduce cache size, add eviction, or alter representations later when profiling justifies it.

The AI must still avoid unbounded work. The main protections are:

- Engine-generated legal candidates;
- shared analysis cached once per Turn where practical;
- memoized hand-analysis/min-play states;
- compact internal card representation;
- conservative candidate pruning that cannot remove strategically distinct Moves without justification;
- selective rather than unconditional search;
- hard search node/depth/termination guards.

Exact millisecond budgets are **not** frozen as product requirements for the POC. Search should return the most accurate result supported by the current bounded implementation, while leaving room for future iterative/deadline-aware search if profiling later requires device-specific time budgets.

The AI must not intentionally burn CPU time to create presentation delay. Any simulated thinking delay belongs outside the AI decision algorithm, and headless simulation uses no artificial delay.

---

# 27. Proposed Source Structure

```text
src/
  ai/
    index.ts
    decision/
      DecisionEngine.ts
      DecisionContext.ts
      MoveEvaluation.ts
    analysis/
      HandAnalyzer.ts
      MinPlaySolver.ts
      ControlAnalyzer.ts
      PublicCardAnalyzer.ts
      OpponentThreatAnalyzer.ts
      SessionAnalyzer.ts
      PenaltyExposureAnalyzer.ts
    evaluation/
      SharedEvaluator.ts
      ModeEvaluator.ts
      BasicEvaluator.ts
      CompetitiveEvaluator.ts
    personality/
      AIPersonality.ts
      PersonalityPolicy.ts
      OptimizerPolicy.ts
      // future personalities
    difficulty/
      AIDifficulty.ts
      DifficultyProfile.ts
      EasyProfile.ts
      NormalProfile.ts
      HardProfile.ts
    search/
      SearchBudget.ts
      EndgamePlanner.ts
    representation/
      CardBitset.ts
    diagnostics/
      DecisionTrace.ts
```

Exact file granularity may evolve during implementation.

---

# 28. Phase 1 Recommended Implementation Order

Phase 1 does **not** implement the full Optimizer plan described in the deferred sections above. M2 should:

1. define a small deterministic Baseline strategy behind the established controller boundary;
2. consume only safe `PlayerView` information and Engine-provided legal Moves;
3. add simple understandable hand/candidate heuristics;
4. prefer reasonable shedding while conserving powerful cards/hands when unnecessary to spend;
5. define deterministic tie-breaking;
6. test legality, determinism, information safety, and representative rational choices;
7. integrate four Baseline controllers into complete headless Basic Sessions.

Minimum-play DP, Easy/Normal/Hard profiles, deep lookahead, personalities, Competitive evaluation, and advanced tuning are deferred until post-Phase-1 planning.

---

# 29. Testing Requirements

At minimum, AI tests should verify:

- every returned Move came from the Engine-provided legal set;
- AI does not require hidden opponent hands;
- AI decision inputs do not expose opponent difficulty/personality;
- identical decision inputs produce identical Moves;
- minimum-play analysis returns expected values for known hands;
- Basic and Competitive evaluators can rank the same candidates differently when mode incentives differ;
- Competitive evaluation recognizes 10-card threshold and unused-bomb exposure;
- Session standings can change candidate preference when final Session outcome is affected;
- Easy, Normal, and Hard use their intended capability profiles;
- Easy does not intentionally select a clearly inferior Move solely because it is Easy;
- search obeys node/depth limits;
- Hard does not require hidden information;
- four-AI headless games complete without UI dependencies.

Simulation/balancing tests should additionally measure:

- Session win rate by difficulty;
- average final Session rank by difficulty;
- average Session score by difficulty and mode;
- decision runtime distribution;
- search-node counts;
- frequency of selected Move categories;
- whether `Hard > Normal > Easy` emerges statistically under balanced test conditions;
- whether any difficulty produces pathological passing, card hoarding, or repetitive behavior.

Detailed simulation infrastructure belongs in `testing-simulation.md`.

---

# 30. Cross-Document Ownership

| Concern | Owning document |
|---|---|
| Product rules and scoring | `requirements.md` |
| Shared `Card`, `Move`, `GameMode`, etc. | `domain-model.md` |
| Legal Moves, scoring, `PlayerView`, authoritative state | `engine.md` |
| Player Controller lifecycle and `AIController` invocation | `orchestrator.md` |
| AI move evaluation, personality, difficulty, AI analysis | `ai.md` |
| AI presentation delay / table feedback | `ui-ux.md` |
| AI-related saved configuration if persisted | `persistence.md` |
| AI decision/debug event retention/formatting | `events-logging.md` |
| Bulk simulations and balancing metrics | `testing-simulation.md` |

---

# 31. Deferred / Future AI Work

The following are intentionally deferred:

- additional personalities B--F;
- controlled seeded move variation;
- rich pass-history belief modeling;
- opponent personality/difficulty inference from observed behavior;
- Monte Carlo rollouts;
- probabilistic hidden-hand modeling;
- exhaustive expectimax/minimax variants;
- future setup-modifier decision logic;
- Card Exchange strategy;
- dedicated Card Counter inference model;
- online/network-specific opponent modeling.

These should be added only if simulations or gameplay show that the simpler deterministic framework needs them.

---

# 32. Open Implementation Decisions

The following details remain intentionally open for implementation/tuning:

1. Exact numerical evaluator weights.
2. Exact deterministic tie-break sequence.
3. Exact card-bitset representation in TypeScript.
4. Whether `MinPlaySolver` returns only minimum count or also a best decomposition.
5. Exact candidate-pruning policy for Easy.
6. Exact Session-utility formula for each mode.
7. Exact search activation thresholds.
8. Exact per-difficulty search depth/node budgets.
9. Exact boundary between Hard Optimizer public deduction and future Card Counter behavior.
10. Whether evaluation scores are normalized across factors or remain weighted raw values.

These are implementation choices unless testing reveals a product-level behavior that requires a requirements change.

---

# 33. Cross-Document Synchronization Status

The September 5, 2026 synchronization pass updated the product, domain, engine, orchestrator, and AI documents to reflect the confirmed AI design and algorithm policy. The following are now synchronized:

- deterministic initial Easy/Normal/Hard behavior;
- difficulty through reasoning capability rather than random sabotage;
- same fair information-access boundary across difficulties;
- Session-aware strategy and rational Session-rival blocking;
- no use of opponent configured difficulty/personality;
- future Chaotic behavior framed as unconventional but defensible rather than simply irrational random play;
- public played-card use across difficulties;
- no hard inference from voluntary Pass actions;
- explicit Round Result / **Next Round** checkpoint;
- mode-specific Session tiebreaks, with Competitive skipping average placement;
- house-rule authority over borrowed algorithms;
- accuracy/reliability > speed > memory as the POC optimization priority;
- corrected parent-document metadata.

No known unresolved rule conflict is introduced by the current AI design. Any future borrowed algorithm or optimization that would change legal combinations, comparison strength, scoring, information access, or Session behavior requires explicit design review rather than silent adaptation.

---

# 34. Current AI Design Summary

The initial AI architecture is:

```text
Shared Decision Engine
    │
    ├── Engine-provided legal Moves
    ├── own-hand analysis
    ├── minimum-play analysis
    ├── control/resource analysis
    ├── public-card analysis
    ├── opponent-threat analysis
    ├── Session-context analysis
    │
    ├── Mode Policy
    │      ├── Basic
    │      └── Competitive
    │
    ├── Personality Policy
    │      └── Optimizer (v1)
    │
    └── Difficulty Profile
           ├── Easy
           ├── Normal
           └── Hard
```

The initial bot is deterministic, fair-information-only, Session-aware, mode-aware, explainable, bounded in runtime, and designed so future personalities can reuse the same difficulty system.

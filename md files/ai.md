# Pusoy Dos --- AI System Design

## AI System Document (v1.5)

**Status:** Draft for implementation  
**Last Modified:** September 11, 2026  
**Parent document:** `requirements.md` v1.13  
**Shared model:** `domain-model.md` v1.3  
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.6  
**M2 milestone:** `m2-baseline-ai-headless-task-breakdown.md` v1.1  
**Module:** AI System  
**Language:** TypeScript

---

# 1. Purpose

The AI System chooses one `Move` for an AI-controlled player using only information that player is permitted to know. The Engine remains authoritative for legality and game truth; the Orchestrator requests and forwards controller intent.

For Phase 1, the only implemented AI is one deterministic **Baseline Bot** for Basic Mode. Difficulty levels, personalities, Competitive strategy, random variation, and advanced search are deferred.

---

# 2. Core Principles

1. **Engine-authoritative legality.** Rank Engine-authorized actions; never create a competing legal-Move authority.
2. **Fair information only.** No unrevealed opponent hands or Engine-private hidden state.
3. **Strategic PASS.** When responding, PASS is a real candidate even if beating Plays exist.
4. **Deterministic behavior.** Same permitted decision state and candidate set means same action, independent of candidate input order/cache warmth.
5. **Exact hand-structure baseline.** Use exact memoized <=13-card decomposition as the primary structural signal.
6. **Lightweight tactical context.** Combine structure with resource cost, shedding, control, Pass opportunity cost, and public opponent pressure without deep search.
7. **Explainability.** Decision components should be inspectable in tests/debugging.
8. **Accuracy-first bounded computation.** Benchmark real browser TypeScript behavior before approximating the exact small-hand algorithm.

---

# 3. Architectural Boundary

```text
Game Orchestrator
      │ safe PlayerView + Engine legal Moves
      ▼
AIController / Baseline Bot
      │ deterministic evaluation
      ▼
chosen PLAY or PASS
      │
      ▼
Game Orchestrator
      │
      ▼
Game Engine validates/applies
```

The AI may depend on shared domain types and public Engine/Orchestrator contracts. It must not import or inspect authoritative private state.

---

# 4. Permitted Information

The Baseline Bot may use:

- own hand;
- Engine-provided legal Moves;
- current hand/combination to beat;
- free-lead/response context;
- publicly played cards/history;
- public pass history;
- remaining card count of each player;
- active/finished players;
- turn order;
- Round number;
- current Session scores/standings.

It may derive the set of unseen cards from own + public cards, but **unseen cards are not known opponent holdings**.

A public PASS never proves that the passer had no legal response.

---

# 5. Selected Phase 1 Algorithm

> **Deterministic hybrid Move evaluator using exact memoized hand decomposition as the primary hand-structure signal, combined with lightweight tactical/context evaluation, strategic PASS evaluation, and canonical deterministic tie-breaking.**

```text
Receive PlayerView + Engine legal Moves
        ↓
Determine free-lead / responding context
        ↓
Build candidate set
        ↓
Canonicalize candidates
        ↓
Immediate-finish check
        ↓
Evaluate each candidate
        ├─ resulting-hand min-play decomposition
        ├─ resource cost / preservation
        ├─ immediate shedding value
        ├─ PASS opportunity cost
        ├─ Trick/control context
        └─ public opponent-card-count pressure
        ↓
Structured deterministic comparison
        ↓
Canonical total-order tie-break
        ↓
Return PLAY / PASS
```

---

# 6. Candidate Set and PASS

The Engine supplies legal Plays.

```text
free lead:
    candidates = legal Plays

responding:
    candidates = legal beating Plays + PASS
```

PASS is not merely a no-response fallback. The bot may rationally preserve a major control resource or valuable structure instead of contesting a low-pressure Trick. Conversely, PASS has an opportunity cost: it sheds no cards and may surrender control while an opponent approaches going out.

If a legal Play immediately empties the bot's hand, it takes priority over PASS and non-finishing alternatives.

---

# 7. Exact Memoized Hand Decomposition

For a Play candidate, evaluate the hand after removing its cards. For PASS, evaluate the unchanged hand.

Primary metric:

> Minimum number of valid future Plays required to partition and empty the remaining hand, ignoring opponent interference.

This is structural potential, not a guaranteed future Turn count.

With at most 13 cards, locally index cards and represent subsets as bitmasks. The complete subset domain is at most `2^13 = 8192` masks.

Conceptual exact solver:

```text
solve(mask):
    if mask == 0: return 0
    if memoized: return cached value

    pivot = fixed remaining card
    best = infinity
    for each valid playable combination in mask containing pivot:
        best = min(best, 1 + solve(mask without combination))

    cache best
    return best
```

Using a fixed pivot avoids exploring permutations of the same partition while preserving exactness. Singles guarantee a decomposition exists.

Candidate evaluations should share memoized subset results when possible. Cache traversal/warmth must never affect the selected Move.

The decomposition implementation must use/reuse canonical Engine-compatible combination semantics rather than create divergent game rules.

---

# 8. Structured Candidate Evaluation

Prefer explicit structured/lexicographic comparison over one opaque weighted sum with many magic constants. Initial design direction:

1. immediate finish / terminal opportunity;
2. resulting-hand efficiency (`minPlays`);
3. urgent public opponent pressure;
4. resource cost / preservation;
5. immediate shedding progress;
6. lightweight Trick/control value;
7. canonical deterministic tie-break.

This hierarchy may be refined during detailed M2 design when behavior examples expose conflicts. Exact decomposition is the primary hand-structure signal but must not become an absolute rule that prevents obvious tactical overrides.

Resource heuristics should avoid double-counting structural damage already reflected in `minPlays`.

---

# 9. Deterministic Tie-Breaking

Required contract:

```text
same permitted PlayerView
+ same private hand
+ same candidate action set
+ same Baseline configuration
= same selected action
```

The result must also be unchanged by legal-Move array reordering.

Every candidate therefore needs a stable total-order representation. It may include PLAY/PASS, card count, canonical combination/category strength, and canonical sorted card identifiers. The exact key is finalized in M2 detailed design.

Avoid decision dependence on `Math.random()`, timing, unstable iteration, insertion order, unordered ties, floating-point ambiguity without a tie policy, or cache traversal order.

---

# 10. Instrumentation / DecisionTrace

AI diagnostics should be available for tests and M3 failure analysis without changing decision semantics. A trace may include:

- candidate actions;
- canonical candidate order;
- immediate-finish status;
- resulting `minPlays`;
- resource/shedding/control/pressure/pass evaluation components;
- decomposition states visited;
- cache hits/misses;
- final tie-break reason;
- selected action;
- decision duration.

Developer traces must not expose hidden information to the AI itself.

---

# 11. Performance Policy

No fixed millisecond SLA is currently approved. Benchmark the real TypeScript implementation on representative and adversarial states, including 13-card free leads, many legal Moves, overlapping five-card combinations, cold cache, and smaller endgame hands.

Priority remains: **accuracy/reliability > speed > memory usage**.

If exact decomposition is unexpectedly costly, profile and optimize memoization/combination-mask reuse first. Any switch to approximation is a material design change and must not be silent.

---

# 12. Required Behavioral Tests

Cover at minimum:

- immediate finish;
- free lead with many combinations;
- cheap response vs unnecessarily strong response;
- PASS despite legal beating Play;
- cheap Play preferred over unnecessary PASS;
- PASS preferred over wasting a major resource when final evaluator implies it;
- opponent one-card pressure;
- own two/three-card endgame;
- breaking/preserving Pair or five-card structure;
- candidates with different `minPlays`;
- strategically equal candidates and canonical tie-break;
- shuffled `legalMoves` order;
- repeated decision execution;
- cold vs warm cache;
- special Straight structures involving A/2;
- high-value 2 usage;
- hidden-information isolation.

Expected Moves must be consequences of the documented policy rather than arbitrary fixtures.

---

# 13. Explicitly Deferred

Do not add during M2 solely to make the Baseline stronger:

- Easy/Normal/Hard;
- personalities;
- random variation;
- sophisticated opponent inference;
- deep lookahead;
- Minimax/MaxN;
- hidden-hand determinization;
- Monte Carlo;
- MCTS/ISMCTS;
- machine learning/neural networks;
- advanced card counting;
- Competitive Mode AI.

Preserve only clean replaceable strategy boundaries where currently justified.

---

# 14. Known Baseline Limitations

- `minPlays` assumes ideal future partitioning and does not model opponent interference.
- Opponent reasoning is limited primarily to public card-count pressure.
- Control value is heuristic, not searched through future Tricks.
- Strategic PASS remains heuristic because optimal Pass decisions would require deeper imperfect-information reasoning.

These are acceptable Phase 1 limitations.

---

# 15. Research / Decision Provenance

The selected hybrid is a project engineering decision informed by external Big Two rule-based AI work, stronger MCTS/ISMCTS research, general subset dynamic programming, and inspectable implementations using exact bitmask/set-partition decomposition.

External sources support techniques, not this project's exact combined architecture. House rules always override external rule semantics.

Research references retained for design provenance include:

- Chih-Chin Wang et al., "A Rule-Based AI Method for an Agent Playing Big Two," Applied Sciences (2021), DOI `10.3390/app11094206`.
- Peter I. Cowling, Edward J. Powley, Daniel Whitehouse, "Information Set Monte Carlo Tree Search" (2012).
- Big2 multi-opponent/multi-movement prediction research referenced in the algorithm handoff.
- XavionM/Big_Two as inspectable engineering evidence for exact bitmask/set-partition decomposition.
- "Dynamic Greedy Algorithm for Big Two Card Game's AI" as historical heuristic evidence.

Do not import external game rules from these sources.

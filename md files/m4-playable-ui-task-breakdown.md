# Pusoy Dos --- M4 Minimal Playable UI

## Milestone Design + Task Breakdown (v1.2)

**Status:** Approved milestone design and implementation task plan  
**Last Modified:** September 15, 2026  
**Milestone:** M4 --- Minimal Playable UI  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.14  
**Shared model:** `domain-model.md` v1.3  
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.6  
**AI design:** `ai.md` v1.5  
**UI/UX design:** `ui-ux.md` v1.4  
**Testing strategy:** `testing-simulation.md` v1.8

---

# 1. Milestone Goal

M4 turns the M1-M3 production system into the first human-playable product: one human completes a five-Round Basic Session against three deterministic Baseline bots in a landscape-first browser UI using the same Engine, Orchestrator, controllers, and AI already proven headlessly.

# 2. Architecture

```text
React UI
   ↓ human intent
HumanController / async input boundary
   ↓
GameRunner / Orchestrator
   ↓
Game Engine
   ↑
authoritative state/events/views
```

React owns presentation only: selection, manual display order, overlays, pacing/animation, and responsive layout. Engine/Orchestrator remain authoritative for legality, hidden/public information, turn/round/session state, scoring, and results.

# 3. Approved Phase 1 Product Flow

**Home → Start Game → Game Table → 4th-place hand reveal → Round Result overlay → Next Round → ... → Round 5 Result overlay → Session Summary.**

Start Game immediately starts the fixed Basic Session. Keep a clean startup/configuration seam so a future setup sub-screen can be inserted when real options exist. Session Summary provides Play Again and Home.

# 4. Approved Table and Interaction Contract

- Human South; bots West/North/East.
- Bot names come from a user-provided random-name pool.
- Bot hands: overlapping face-down cards + numeric count.
- Center: Discard Pile button + current hand to beat (cards/type/player) or FREE LEAD.
- Bottom-left: Event Log + Leave Game.
- Bottom-center/top: human hand. Bottom-center/below: Sort Rank + Sort Suit.
- Bottom-right: large Play + Pass controls.
- Human cards share one baseline; constrained layouts increase horizontal overlap. Selected cards rise.
- Click/tap toggles selection. Empty-table click does not clear selection.
- Bounded drag reorders within the hand region and never changes selection.
- Sort Rank/Suit always remain present and preserve selection; no Custom sort state.
- Play is disabled/gray when illegal and shows a useful Engine-derived reason. Valid Play shows recognized combination.
- Pass remains legal strategically while responding even when a beating Play exists. If no legal Play exists, Pass says **No valid plays**. No auto-pass.
- Every successfully played card immediately appears in Discard Pile.
- Discard Pile groups suit Clubs→Spades→Hearts→Diamonds, rank 3→...→A→2.
- Event Log preview shows latest event; popup opens at newest and scrolls upward toward the first event.
- Discard/Event/Leave overlays pause progression.
- Bots decide only when their Turn begins; no precomputation during another player's Turn. Presentation delay is separate from AI computation.

# 5. End-of-Round and Results Contract

After 3rd place finishes, interaction stops and the 4th-place remaining hand is revealed in its seat, sorted by Rank, for roughly 1.5–2 seconds; click/tap may skip. This information becomes public only after Round completion.

Round Result is a non-dismissible modal over the dimmed completed table. It initially uses the standings before the Round score, then Round points appear, totals update, and rows rearrange by new cumulative total. The final heading is **Total**. The animation is skippable but a skip input must not trigger Next Round. Rounds 1–4 use Next Round; Round 5 uses View Session Results.

Session Summary uses the official final ranking/tiebreaks, shows all five Round results and final scores, gives 1st/2nd/3rd explicit gold/silver/bronze treatment, and provides Play Again + Home.

# 6. Responsive Contract

Landscape-first: large desktop, laptop, windowed desktop, tablet landscape, large phone landscape, and a defined small supported phone landscape. Portrait pauses/prevents play and shows rotate guidance. Too-small landscape shows resize/unsupported guidance. Do not force exact 16:9 or fullscreen. Cards preserve aspect ratio; text/control sizing is bounded; secondary UI reflows before core gameplay becomes unusable.

Exact viewport dimensions/minimums are frozen in T04, not guessed in this planning document.

# 7. Testing Contract

- Vitest/React Testing Library for component/application behavior.
- Playwright for a small high-value real-browser suite. Codex creates/runs applicable tests.
- Human manual acceptance for observable usability. Codex writes the checklist; humans execute it. Never ask humans to measure precise milliseconds or inspect internal implementation state.
- M1-M3 regression, typecheck, and production build remain mandatory milestone gates.

# 8. Milestone Definition of Done

M4 is complete when a human can start immediately from Home, complete all five Basic Rounds against production Baseline bots, use selection/sorting/manual arrangement and Play/Pass correctly, inspect public Discard/Event history, understand bot actions and Round/Session results, recover from supported orientation/viewport changes, and finish through Session Summary without a UI-specific rules/game loop or hidden-information leak. All required automated suites pass and the milestone human acceptance checklist has been executed with no unresolved blocking defect.

---

# 9. Task Planning Principles

Each Txx is independently reviewable but should remain large enough to avoid repeated repository/context rediscovery. Every task includes Goal, Work, Automated Tests, Manual Tests, Expected Result, and Definition of Done. Manual verification may remain pending when a task is code-complete, but milestone completion requires the designated acceptance checklist.

# 10. Task Map

| Task | Technical checkpoint |
|---|---|
| T01 | App shell + extensible immediate Session startup |
| T02 | HumanController async input boundary |
| T03 | Production state/events → React presentation adapter |
| T04 | Responsive contract + frozen viewport matrix + Playwright harness |
| T05 | Card/player visual primitives |
| T06 | Core table/center/bot-seat layout |
| T07 | Human hand selection, sorting, overlap, manual drag/reorder |
| T08 | Engine-authoritative Play/Pass feedback and submission |
| T09 | Bot-turn pacing, turn transitions, stale-input safety |
| T10 | Discard Pile + Event Log overlays and pause coordination |
| T11 | Leave confirmation + portrait/unsupported pause behavior |
| T12 | End-of-Round 4th-hand reveal + result scoring/reorder overlay |
| T13 | Session Summary + Play Again/Home |
| T14 | Full responsive hardening across frozen matrix |
| T15 | Phase 1 browser E2E + human acceptance + regression gate |

---

# M4-T01 — Application Shell and Immediate Session Startup

### Goal
Create Home and production Session startup without a Phase 1 setup screen while preserving a clean future setup/configuration seam.

### Must Read
`requirements.md`, `orchestrator.md`, `ui-ux.md`, this task.

### Work
- Build Home with Start Game.
- Start fixed Basic Session: human + 3 Baseline bots, five Rounds.
- Introduce only the minimal application/session configuration boundary needed so a future setup sub-screen can provide options.
- Use a bot-name provider/pool seam; final name strings come from the user-provided list. Do not invent personality/difficulty semantics.
- Do not add Stats/Settings/Resume/Competitive controls.

### Automated Tests
Vitest/RTL: Home renders; Start Game invokes one Session startup; duplicate rapid activation does not create duplicate Sessions; startup configuration is Basic/four players.

### Manual Tests
Start app, press Start Game, confirm the table appears without an intermediate setup screen and no deferred controls are visible.

### Expected Result
A fixed Phase 1 Session starts immediately through a future-extensible startup boundary.

### Definition of Done
- [ ] Home → Start Game → production Session works.
- [ ] No speculative setup UI.
- [ ] Bot-name pool is replaceable with user-provided names.
- [ ] Focused tests pass.

# M4-T02 — HumanController Async Input Boundary

### Goal
Connect human UI intent to the existing PlayerController/Orchestrator contract without bypassing production execution.

### Work
Implement pending-turn request exposure, Play/Pass resolution, cancellation/pause handling, request identity, and stale-response rejection compatible with existing Orchestrator contracts.

### Automated Tests
Vitest: one active request; valid resolution; stale/cancelled request cannot advance; pause does not resolve a Move; bot controllers unaffected.

### Manual Tests
None beyond a smoke check if UI exists; this is primarily a boundary task.

### Expected Result
Human input is a production controller source, not a direct Engine mutation path.

### Definition of Done
- [ ] HumanController uses production contract.
- [ ] Stale/cancelled input is safe.
- [ ] No rule logic duplicated.
- [ ] M2/M3 controller tests remain green.

# M4-T03 — Production State/Event Presentation Adapter

### Goal
Expose only the safe authoritative/public data React needs.

### Work
Map runner/Engine views/events to UI presentation data for seats, turn, current hand to beat/free lead, scores, counts, PASS/DONE, public played cards/events, Round checkpoint, and Session completion. Keep hidden bot hands inaccessible during active play. Add a post-Round-only projection for 4th-place remaining cards if existing contracts do not already safely expose it; stop for approval if this requires a substantial public contract change.

### Automated Tests
Vitest: correct mapping; active-play hidden hands absent; post-Round reveal unavailable before completion and available after; event order preserved.

### Manual Tests
Inspect table through a short game and confirm only public information is visible before Round end.

### Expected Result
React can render the game without owning authoritative state or leaking hidden information.

### Definition of Done
- [ ] Safe adapter exists.
- [ ] Hidden-information tests pass.
- [ ] Post-Round reveal boundary is explicit.

# M4-T04 — Responsive Contract, Viewport Matrix, and Playwright Harness

### Goal
Freeze measurable UI support boundaries and establish focused real-browser testing.

### Work
- Choose exact representative CSS viewport dimensions for large desktop, laptop, small/windowed desktop, tablet landscape, large phone landscape, small supported phone landscape, portrait unsupported, and undersized landscape.
- Freeze minimum readable text/control/card targeting constraints where practical.
- Add Playwright as a dev/test dependency and configure the smallest useful browser-test harness.
- Document commands and matrix for later tasks.

### Automated Tests
Playwright smoke: app loads at each matrix viewport; portrait/undersized states route to guidance once implemented or mark those assertions pending their implementation task. Vitest/config checks as useful.

### Manual Tests
Open representative viewports/devices and confirm the chosen matrix is realistic; do not measure human-perceived timing.

### Expected Result
All later responsive work shares one explicit QA contract and runnable browser harness.

### Definition of Done
- [ ] Exact viewport matrix documented.
- [ ] Playwright installed/configured without unrelated dependency upgrades.
- [ ] Browser smoke command works.
- [ ] Existing regression/typecheck/build unaffected.

# M4-T05 — Card and Player Visual Primitives

### Goal
Create reusable proportional cards, card backs, player panels, status labels, and visual tokens.

### Work
Implement off-white face cards, four-color suits, constant aspect ratio, CSS/SVG back, player name/count/score, turn highlight, PASS, DONE/placement, and restrained responsive sizing.

### Automated Tests
RTL: semantic card/player labels and status variants. Playwright: card ratio/visibility smoke at representative large/small supported viewports where practical.

### Manual Tests
Confirm suits/cards are distinguishable, card backs do not reveal faces, status labels remain understandable without color alone.

### Expected Result
Reusable primitives support all table positions and responsive layouts.

### Definition of Done
- [ ] Constant card ratio.
- [ ] Four-color suits + labels.
- [ ] Player status variants.
- [ ] No raster 52-card dependency required.

# M4-T06 — Core Game Table, Center, and Bot Seats

### Goal
Render the main table hierarchy and bot hands before human-hand complexity.

### Work
- Seats Human South, bots W/N/E.
- Render overlapping face-down bot hands + count.
- Center current hand to beat with cards/type/player or FREE LEAD.
- Add Discard Pile button placeholder and Round/score context.
- Preserve current hand through Passes until authoritative beat/reset.

### Automated Tests
RTL: seat mapping, turn/current-hand/free-lead states, counts/PASS/DONE. Playwright: core elements visible without critical overlap at representative viewports.

### Manual Tests
Confirm a person can quickly answer whose turn, what must be beaten, and each opponent's remaining count.

### Expected Result
A readable production-state table exists.

### Definition of Done
- [ ] Fixed seats correct.
- [ ] Bot hands/counts correct and hidden.
- [ ] Center state authoritative.
- [ ] Core hierarchy readable.

# M4-T07 — Human Hand Selection, Sorting, Overlap, and Manual Reorder

### Goal
Implement the complete Phase 1 hand-manipulation contract.

### Work
- Render human cards on one baseline with responsive horizontal overlap.
- Click/tap toggles selection; selected cards rise. Empty-table click does not clear selection.
- Add always-visible Sort Rank and Sort Suit using canonical orders.
- Implement bounded mouse/touch drag reorder within the hand region.
- Reorder and sorting preserve selection; moving neighboring cards never changes selection.
- Ensure enough exposed card area remains targetable.

### Automated Tests
RTL: selection toggling, sorting order, selection survives sort/reorder state operations. Playwright: drag card to new position, selected card remains selected, bounded drag does not escape hand, overlapped cards remain targetable at representative constrained viewport.

### Manual Tests
Select several cards; drag selected/unselected cards; confirm selection never changes unintentionally. Sort both ways. On a small supported landscape viewport, click every card in a 13-card hand and verify selected cards clearly rise.

### Expected Result
Human hand manipulation feels card-game-like and remains reliable under overlap.

### Definition of Done
- [ ] Selection/order independence proven.
- [ ] Manual drag is bounded.
- [ ] Sort buttons always present.
- [ ] Small-screen targetability verified.

# M4-T08 — Authoritative Play/Pass Feedback and Submission

### Goal
Make human actions understandable while keeping Engine legality authoritative.

### Work
- Inspect selected cards through existing Engine/application contracts.
- Large Play control shows recognized valid selection or specific invalid/non-beating reason and is disabled when illegal.
- Pass appears only when rules permit; strategic Pass remains possible with legal Plays.
- If zero legal Plays exist, Pass includes **No valid plays**.
- Successful Play/Pass resolves HumanController request; successful Play clears selection and closes hand gaps.

### Automated Tests
RTL/integration: no selection, invalid combo, wrong count, non-beating, opening 3♣ requirement, valid Play, strategic Pass, no-valid-play Pass, free-lead Pass disabled. Use Engine-produced results rather than UI rule replicas.

### Manual Tests
Try representative invalid selections and confirm the reason is understandable. Confirm Pass remains available when you could play and clearly explains No valid plays when you cannot.

### Expected Result
Human always understands whether Play/Pass is available and why.

### Definition of Done
- [ ] Engine-authoritative feedback.
- [ ] Useful invalid reasons.
- [ ] Strategic/no-valid Pass states correct.
- [ ] Submission uses HumanController/Orchestrator.

# M4-T09 — Bot Turn Pacing and Interaction Safety

### Goal
Make production bot turns readable without changing deterministic AI behavior.

### Work
- Ensure bot controller request starts only on that bot's authoritative Turn; no later-turn precomputation.
- Add tunable presentation delay separate from AI compute time.
- Update center/count/PASS/Event preview after actions.
- Disable/stale-protect human controls outside the active human request.

### Automated Tests
Integration: serialized controller requests, no premature bot request, stale human action ignored, AI decision determinism unchanged. Use fake timers/state checkpoints for presentation where appropriate rather than brittle wall-clock tests.

### Manual Tests
Play several Tricks and judge whether bot actions are easy to follow. Report too fast/slow qualitatively; do not time milliseconds.

### Expected Result
Turns are understandable and production controller sequencing remains correct.

### Definition of Done
- [ ] No bot precompute across Turns.
- [ ] Presentation delay cannot affect authoritative decision.
- [ ] Human stale input blocked.

# M4-T10 — Discard Pile, Event Log, and Overlay Pause

### Goal
Provide complete public Round history without a permanent large log panel.

### Work
- Discard Pile overlay: all successfully played cards, including current Trick, grouped canonical suit/rank order; close returns to table.
- Event Log button previews latest event; overlay opens at newest, scroll up toward earliest.
- Include Round start/opener, exact Plays/combinations, Pass, reset/free lead, finishes/placements.
- Opening either overlay pauses progression; close resumes exact execution.

### Automated Tests
RTL: grouping/order, event chronology/preview, no Pass card. Integration/Playwright: open during bot-capable state, verify progression does not advance while open, close and verify it resumes.

### Manual Tests
Inspect both overlays mid-Round; confirm contents are understandable, exit is obvious, and no bot action is missed behind them.

### Expected Result
Players can inspect cards/history without losing track of live play.

### Definition of Done
- [ ] Every played card appears immediately in Discard Pile.
- [ ] Event Log is chronological and public-only.
- [ ] Overlay pause/resume is safe.

# M4-T11 — Leave Confirmation and Unsupported-Layout Pause

### Goal
Prevent accidental Session loss and unsafe play in portrait/undersized layouts.

### Work
- Leave Game opens confirmation with unsaved warning and Yes/Leave + Return/Stay.
- Confirmation pauses progression.
- Add best-effort browser unload warning.
- Portrait shows rotate guidance and pauses/prevents play; undersized landscape shows resize guidance.
- Returning to supported landscape restores coherent state.

### Automated Tests
RTL/Playwright: leave cancel/confirm; portrait/undersized guidance; no progression while blocked; return to supported viewport preserves state.

### Manual Tests
Attempt accidental Leave then Return. Rotate/resize during a live Session and confirm state is understandable after returning.

### Expected Result
Unsafe navigation/layout transitions cannot silently lose or advance play.

### Definition of Done
- [ ] Leave confirmation works.
- [ ] Portrait/undersized states block gracefully.
- [ ] Resume after supported layout restores state.

# M4-T12 — End-of-Round Reveal and Round Result Animation

### Goal
Implement the approved Round-completion presentation without changing authoritative scoring.

### Work
- After 3rd place finishes and Round is authoritative complete, reveal 4th-place remaining hand at that seat sorted by Rank.
- Keep active-play hidden-hand boundary intact.
- Show reveal ~1.5–2s with click/tap skip; skip input cannot activate result action.
- Dim completed table and show non-dismissible result overlay.
- Initial row order uses pre-Round-score standings; Round points appear; totals update; rows reorder by new cumulative total; settle on Total heading.
- Keep stable prior relative order for interim tied totals.
- Animation skippable without triggering Next Round.
- R1–R4 Next Round; R5 View Session Results.

### Automated Tests
RTL/integration: post-Round reveal only, rank-sorted cards, authoritative score values, initial/final row ordering, tie stability, continuation gating. Playwright: skip reveal/animation does not double-activate; overlay remains over completed table. Avoid exact millisecond assertions.

### Manual Tests
Observe a Round end. Confirm 4th hand is readable, result scoring progression is understandable, row movement explains standings changes, and skipping never jumps into the next Round.

### Expected Result
Round completion is informative, satisfying, and safe.

### Definition of Done
- [ ] Reveal occurs only after Round completion.
- [ ] Result uses authoritative scores.
- [ ] Reorder animation matches approved sequence.
- [ ] Explicit continuation only.

# M4-T13 — Session Summary and Replay Navigation

### Goal
Finish the five-Round product lifecycle.

### Work
Render official final ranking/scores, five Round results, relevant tiebreak explanation, explicit 1st/2nd/3rd gold/silver/bronze treatment plus placement text, Play Again, and Home. Play Again starts a fresh Session through the T01 startup boundary.

### Automated Tests
RTL/integration: official ordering/tie result presentation; five Round rows; Play Again fresh startup; Home navigation.

### Manual Tests
Complete/fixture a Session and confirm final ranking is easy to understand and medal colors are not the only placement cue.

### Expected Result
The product has a clear terminal state and clean restart/home paths.

### Definition of Done
- [ ] Official final ranking displayed.
- [ ] Gold/silver/bronze + explicit placement.
- [ ] Play Again/Home work without persistence assumptions.

# M4-T14 — Full Responsive Hardening

### Goal
Make the completed table usable across the frozen T04 viewport matrix.

### Work
Tune overlap, bounded typography, control sizing, overlays, table fit, and reflow. Preserve one-baseline unselected human cards; selected cards alone rise. Secondary UI compresses before core controls. Do not solve constraints by distorting card ratio.

### Automated Tests
Playwright matrix: core controls visible/targetable; no critical clipping/overlap; cards keep ratio; 13-card hand targetable; overlays usable; Round Result/Session Summary usable; portrait/undersized guidance correct.

### Manual Tests
Run the human viewport checklist on each supported class. Confirm readability, targetability, hand dragging, and result overlays by observation rather than pixel-perfect aesthetic judgment.

### Expected Result
One coherent landscape-first product works from supported phone landscape through desktop/windowed browser.

### Definition of Done
- [ ] Frozen matrix passes browser checks.
- [ ] Human checklist has no blocking viewport defect.
- [ ] Card ratio/selection baseline invariant preserved.

# M4-T15 — Phase 1 End-to-End Acceptance and Regression Gate

### Goal
Prove M4 and Phase 1 are actually complete.

### Work
- Add/finish a small deterministic Playwright E2E suite covering startup, critical human interaction, overlays, Round result, and Session completion where fixtures/controllers make it practical.
- Run full Vitest/RTL, Playwright, M1-M3 regressions, typecheck, and production build.
- Produce a structured human acceptance checklist with both scripted functional checks and task-based usability checks.
- A real person executes the checklist and records pass/fail/notes. Codex must not self-certify subjective/manual results.

### Automated Tests
All milestone-required automated suites. Do not duplicate every Engine rule in Playwright.

### Manual Tests
At minimum: complete a real five-Round Session; identify turns/hand-to-beat; select every overlapped card at least once on constrained layout; reorder selected/unselected cards; sort both ways; exercise legal/illegal Play and strategic/no-valid Pass; inspect Discard/Event overlays; observe bot pacing; use Leave confirmation; rotate/resize; observe 4th-hand reveal and result reordering; use Next Round/View Session Results; verify Session Summary and Play Again/Home.

Task-based usability check: give a tester the goal **“Start a game and play through at least one Round”** without telling them which controls to press; record confusion points separately from functional defects.

### Expected Result
Phase 1 has automated regression evidence plus actual human-observed usability evidence.

### Definition of Done
- [ ] Required automated suites pass.
- [ ] M1-M3 regressions pass.
- [ ] Typecheck/build pass.
- [ ] Human acceptance executed; no unresolved blocking defect.
- [ ] No deferred feature is required for a five-Round Session.
- [ ] Completion report distinguishes automated results from human-reported manual results.

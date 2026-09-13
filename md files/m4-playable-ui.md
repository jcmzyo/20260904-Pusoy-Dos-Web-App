# Pusoy Dos --- M4 Minimal Playable UI

## Milestone Design + Task Breakdown (v1.1)

**Status:** Approved milestone design and implementation task plan  
**Last Modified:** September 14, 2026  
**Milestone:** M4 --- Minimal Playable UI  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.14  
**Shared model:** `domain-model.md` v1.3
**Engine design:** `engine.md` v1.7  
**Orchestrator design:** `orchestrator.md` v1.6  
**AI design:** `ai.md` v1.5  
**UI/UX design:** `ui-ux.md` v1.2  
**Testing strategy:** `testing-simulation.md` v1.7

---

# 1. Milestone Goal

M4 turns the M1-M3 production game system into the first human-playable product.

A human must be able to complete a full five-Round Basic Session against three deterministic Baseline bots in a web browser using the same Engine, Orchestrator, and AI already proven headlessly.

M4 is **landscape-first**. It supports desktop/laptop browser play, non-fullscreen/windowed browser play, tablet landscape, and supported phone landscape. Portrait gameplay is not required for Phase 1.

---

# 2. Core Architecture

```text
React UI
   ↓ human intent
Human PlayerController / input boundary
   ↓
GameRunner / Orchestrator
   ↓
Game Engine
   ↑
authoritative state/events/views
```

React owns presentation state only, such as:

- selected cards;
- opened overlays;
- local sort presentation;
- temporary messages;
- layout mode.

The Engine/Orchestrator remain authoritative for gameplay state and legality.

M4 must not replace the proven headless execution path with a UI-specific rules/game loop.

---

# 3. Phase 1 Screens

```text
Home
 ↓
Minimal Game Setup
 ↓
Game Table
 ↓
Round Result
 ↓
Next Round
 ↓
...
 ↓
Session Summary
```

No Resume, Stats, Settings, tutorial/rules system, difficulty/personality selection, or Competitive setup is required.

---

# 4. Gameplay Viewport Strategy

Phase 1 gameplay uses a **landscape-first, ratio-controlled play area**.

Supported target classes:

- large desktop landscape;
- normal desktop/laptop landscape;
- smaller non-fullscreen/windowed desktop browser;
- tablet landscape;
- large phone landscape;
- small supported phone landscape.

Portrait mobile/tablet gameplay does not need a compressed table layout. Instead:

```text
portrait detected
→ pause/prevent gameplay interaction as appropriate
→ show clear "Rotate your device to continue" state
→ restore table when supported landscape dimensions return
```

Where the viewport is too small even in landscape, show clear resize/unsupported-size guidance rather than shrinking the game into an unreadable state.

Do not depend on browser orientation locking; it may be unavailable or restricted.

---

# 5. Ratio-Controlled Game Area

The game should not assume fullscreen.

The main play area must fit within the available browser viewport while staying inside documented layout/aspect-ratio constraints.

```text
browser viewport
┌──────────────────────────────────────┐
│ margins / available excess space    │
│   ┌──────────────────────────────┐   │
│   │ controlled GAME PLAY AREA    │   │
│   │ proportional table layout    │   │
│   └──────────────────────────────┘   │
│                                      │
└──────────────────────────────────────┘
```

The exact target aspect ratio/range may be finalized during M4 detailed UI design. A 16:9-like landscape family is a candidate, not yet a frozen rule.

The UI may use safe margins or letterboxing instead of stretching components disproportionately to fill arbitrary browser shapes.

---

# 6. Component Scaling Invariants

## 6.1 Cards

Every card component must preserve one consistent width:height ratio across all supported viewports.

This applies to:

- human-hand cards;
- played cards;
- card backs;
- card miniatures/history where the same visual component is used.

Cards must never independently stretch horizontally/vertically to fill a layout slot.

When space becomes constrained, prefer controlled overlap, scrolling, or layout reflow before distorting card proportions.

## 6.2 Text

Core gameplay text must remain readable at all supported viewport classes.

Use bounded responsive typography rather than blindly scaling the entire interface.

Conceptually:

```text
font-size = clamp(min-readable, responsive value, max-useful)
```

When a viewport would force text below the documented minimum, change/reflow the layout or reject that viewport rather than continue shrinking.

## 6.3 Controls

Play, Pass, card selection, Next Round, and other critical interactive controls must retain usable click/touch target sizes.

The game may collapse/rearrange secondary panels before shrinking primary controls below usability.

---

# 7. Responsive Reflow Principle

Responsive behavior does not mean every component scales uniformly.

Priority:

> same information hierarchy + controlled reflow + proportional cards/components + minimum readability/usability.

On larger screens, Played Cards/Event Log may remain persistent panels. On constrained landscape screens, secondary information may become buttons, drawers, tabs, or overlays.

Core game state must remain immediately understandable:

- whose turn;
- hand to beat/free lead;
- player/opponent remaining counts;
- human hand;
- Play/Pass actions;
- essential score/status information.

---

# 8. Game Table Requirements

The table must show:

- Human South;
- bots West/North/East;
- current turn;
- current hand to beat, including actual cards/type/player;
- `FREE LEAD` when appropriate;
- opponent remaining-card counts;
- current/running Session score;
- PASS indicators;
- DONE/placement indicators;
- human hand;
- Play/Pass controls.

The holder of 3♣ determines Round opener; fixed visual seat does not determine first player.

---

# 9. Human Hand and Actions

M4 supports:

- click/tap card selection;
- clear selected-card visual state;
- Sort by Rank;
- Sort by Suit;
- Play;
- Pass when legally allowed.

Arbitrary drag/manual hand arrangement remains deferred.

The UI asks the Engine/application layer for authoritative inspection/legality feedback. React must not duplicate combination or beating rules.

Invalid/no selection keeps Play disabled and shows understandable feedback. Valid legal selection identifies the recognized combination and enables Play.

If no legal Play exists while responding, explicitly state that no legal move is available and make Pass obvious. Phase 1 does not auto-pass the human.

---

# 10. Bot Turns and Interaction Safety

Bot actions run through the same Orchestrator/controller path proven in M2/M3.

Any visual thinking delay is presentation-only and separate from actual Baseline computation.

The UI must prevent stale human actions from being accepted after authoritative state has advanced.

Opening overlays that hide meaningful game state should pause/coordinate progression so important bot actions do not occur unseen where the selected UX requires pause behavior.

---

# 11. Played Cards and Event Log

Phase 1 includes:

- Played Cards view for the current Round;
- chronological factual Event Log.

Both derive from authoritative public Engine events/history.

On constrained landscape screens, these may be accessed through overlays/drawers rather than permanently consuming table area.

---

# 12. Round Result and Session Summary

Round Result is an explicit checkpoint showing:

- official Basic placements;
- points gained that Round;
- updated cumulative Session scores;
- explicit **Next Round** action.

Human play must not automatically advance to the next Round.

After Round 5, Session Summary shows:

- winner;
- final ranking;
- final Session scores;
- results of all five Rounds;
- relevant tiebreak explanation when needed.

---

# 13. Unsaved Session Behavior

Phase 1 has no persistence.

In-app leave/navigation from an unfinished Session must warn that progress will not be saved.

Browser refresh/tab/window close may use supported unload warnings where available; custom browser warning wording is not guaranteed.

---

# 14. Visual Foundation

Use the approved modern casino-table direction:

- green table foundation;
- off-white cards;
- Hearts red;
- Diamonds orange;
- Clubs blue;
- Spades black;
- clean sans-serif/system typography;
- CSS/component-driven cards;
- simple CSS/SVG card back;
- explicit labels in addition to color.

Major animation, sound, custom character art, and extensive polish remain deferred.

---

# 15. QA Viewport Matrix

M4 must explicitly test representative viewport classes rather than rely on vague "responsive" acceptance.

For every supported class verify:

- no core content overlap;
- no clipped critical controls;
- card aspect ratio remains constant;
- cards remain distinguishable/selectable;
- core text remains readable;
- core buttons remain usable;
- human hand remains navigable;
- current turn/hand-to-beat remain obvious;
- secondary panels remain accessible;
- Round Result is usable;
- Session Summary is usable.

For unsupported portrait/undersized states verify:

- clear guidance is shown;
- gameplay is not presented as a distorted/cramped usable table;
- returning to supported landscape/size restores a coherent game view.

Exact representative CSS viewport dimensions should be frozen during M4 task design and then used consistently in manual/automated visual-layout checks where practical.

---

# 16. Definition of Done

M4 is COMPLETE only when:

- [ ] Human can start a new Basic Session in the browser.
- [ ] One human and three Baseline bots participate through production controller boundaries.
- [ ] Production M1 Engine remains the sole gameplay authority.
- [ ] Production M2 Orchestrator coordinates human and bot turns.
- [ ] M3-proven execution is not replaced by a UI-specific game loop.
- [ ] React does not hold a competing authoritative game-state/rules implementation.
- [ ] Human can select/deselect cards and Sort by Rank/Suit.
- [ ] Combination/legality feedback is derived from authoritative Engine/application contracts.
- [ ] Play is enabled only for a legal proposed Play.
- [ ] Pass is available only where canonical rules allow it.
- [ ] No-legal-Play state is clearly communicated.
- [ ] Current Turn and current hand to beat/free lead are obvious.
- [ ] PASS and DONE/placement indicators behave correctly.
- [ ] Opponent remaining-card counts are visible without revealing hidden hands.
- [ ] Played Cards and Event Log reflect authoritative public history.
- [ ] Current cumulative Session score is visible.
- [ ] Round Result shows official result + updated cumulative totals.
- [ ] Human must explicitly choose Next Round.
- [ ] Exactly five Rounds can be completed to Session Summary.
- [ ] Session Summary presents correct final ranking/scores/tiebreak information.
- [ ] Stale human input cannot be accepted after state advancement.
- [ ] Landscape-first gameplay works at documented desktop/laptop/tablet/phone landscape viewport classes.
- [ ] Non-fullscreen/windowed browser play remains usable within the supported viewport/aspect-ratio envelope.
- [ ] All card renderings preserve the documented card aspect ratio.
- [ ] Core gameplay typography never falls below the documented readable minimum on supported viewports.
- [ ] Critical controls meet the documented minimum usable click/touch sizing.
- [ ] Secondary UI reflows/collapses/scrolls before core game elements become unusably small.
- [ ] Portrait/undersized unsupported states fail gracefully with rotate/resize guidance rather than a distorted table.
- [ ] Leaving/reloading an unfinished Session does not imply that progress was saved.
- [ ] Critical React/application integration tests pass.
- [ ] M1-M3 regression suites pass.
- [ ] Typecheck and production build pass.
- [ ] No deferred feature is required to complete the Session.

**Technical deliverable:**

> A landscape-first web UI in which a human can complete a five-Round Basic Pusoy Dos Session against three deterministic Baseline bots using the same production Engine/Orchestrator proven headlessly, with proportional cards, readable text, usable controls, and graceful handling of unsupported viewport/orientation states.


---

# 17. Task Breakdown

## 17.1 Task Planning Principles

M4 tasks are sized for short, isolated coding-agent cycles while still producing visible, testable product increments.

The UI must remain a consumer of the production Engine/Orchestrator proven in M1–M3. React may own presentation state, but it must not become a second rules authority or introduce a UI-specific game loop.

Responsive dimensions that were intentionally unfrozen are resolved in an early dedicated task before final responsive implementation. This is a design/QA task, not permission to change the landscape-first product requirement.

A task is COMPLETE only when every task-specific Definition of Done item is satisfied. If required verification cannot run, report **PARTIAL / NOT VERIFIED**.

## 17.2 Task Map

| Mini-milestone | Tasks | Technical checkpoint |
|---|---|---|
| MM1 UI/application boundary | M4-T01–T03 | Browser shell, human controller, and UI-facing production state flow work |
| MM2 Responsive/design foundation | M4-T04–T05 | Viewport contract and reusable card/visual primitives are frozen |
| MM3 Core table | M4-T06–T10 | Human can understand/select/validate/play/pass through production flow |
| MM4 Supporting game information | M4-T11–T12 | Bot progression, public history, overlays, and pause coordination work |
| MM5 Results/lifecycle | M4-T13–T15 | Round Result, five-Round completion, Session Summary, and leave behavior work |
| MM6 Responsive hardening | M4-T16 | Full table reflows correctly across the approved viewport matrix |
| MM7 Acceptance | M4-T17 | Phase 1 human-playable product passes end-to-end QA |

**Total: 17 tasks.**

---

## M4-T01 — Build Phase 1 Application Shell and Screen Navigation

### Goal

Create the minimal React application flow without gameplay implementation.

### Work

Implement screen/application states for:

```text
Home
→ Minimal Game Setup
→ Game Table
→ Round Result
→ Session Summary
```

At this stage, Game Table/Result/Summary may use placeholders. Setup supports only Phase 1 choices needed to start Basic Mode; no difficulty/personality/Competitive selectors.

### Tests

Verify:

- Home can navigate to setup;
- setup can initiate the application flow;
- only Phase 1 screens/options are exposed;
- navigation does not imply Resume/Stats/Settings;
- screen routing/state does not implement gameplay rules.

### Expected Result

A minimal browser shell exists with the complete Phase 1 screen topology ready for production-game integration.

### Definition of Done

- [ ] Home, minimal setup, table, result, and summary screen states/components exist.
- [ ] Basic Mode is the only playable mode.
- [ ] No difficulty/personality/persistence UI is introduced.
- [ ] Navigation tests pass.
- [ ] Typecheck/build pass.
- [ ] No gameplay loop is implemented in React.

---

## M4-T02 — Implement Human PlayerController / Async Input Boundary

### Goal

Create the human controller adapter that satisfies the same M2 `PlayerController` contract used by AI controllers.

### Work

Implement the async boundary that:

- receives a `PlayerTurnRequest`;
- exposes the current safe request to the UI;
- awaits one human action;
- resolves the request with the submitted `Move`;
- handles cancellation/staleness according to Orchestrator contracts.

Do not build card-selection UI yet.

### Tests

Verify:

- controller waits for human input rather than inventing a Move;
- one request resolves once;
- stale/cancelled request cannot resolve a newer turn;
- controller exposes only safe request data;
- no direct Engine mutation is possible.

### Expected Result

The production Orchestrator can treat the human seat as a normal asynchronous controller.

### Definition of Done

- [ ] Human controller implements production controller contract.
- [ ] Await/resolve lifecycle is explicit.
- [ ] Duplicate/stale completion is protected.
- [ ] Only safe player-facing data is exposed.
- [ ] Focused tests, M1–M3 regressions, and typecheck pass.
- [ ] No card-selection/table UI is required yet.

---

## M4-T03 — Connect Production Game State to React Presentation

### Goal

Provide a one-way UI-facing state/update path from the production Orchestrator/Engine to React.

### Work

Create the smallest adapter/store/hook boundary needed for React to observe:

- current screen/lifecycle checkpoint;
- current player/turn;
- safe human view;
- public table state;
- Round/Session results;
- factual public events needed by M4.

Keep presentation-only state separate.

### Tests

Verify:

- authoritative updates propagate to React;
- selected cards/open overlays/sort order remain presentation state;
- React cannot directly mutate Engine state;
- hidden opponent hands are absent;
- unmount/remount of presentation components does not create a competing game state.

### Expected Result

React can render the live production game without owning rule/state authority.

### Definition of Done

- [ ] UI state adapter is implemented.
- [ ] Authoritative and presentation state are clearly separated.
- [ ] Hidden information is not exposed.
- [ ] No duplicate scoring/turn/trick state machine is created.
- [ ] Focused integration tests/regressions/typecheck pass.

---

## M4-T04 — Define Responsive Layout Contract and QA Viewport Matrix

### Goal

Freeze the responsive design values intentionally left open in earlier planning.

### Work

Define and document, using the actual Phase 1 component/content needs:

- representative viewport dimensions for large desktop, normal laptop, small/windowed desktop, tablet landscape, large phone landscape, small supported phone landscape;
- minimum supported landscape dimensions;
- unsupported portrait/undersized conditions;
- game-area aspect-ratio/envelope;
- constant card width:height ratio;
- minimum readable core typography;
- minimum usable critical control/touch sizes;
- rules for safe margins/letterboxing;
- which secondary panels collapse/reflow first.

This task defines the contract; it does not need to finish the full responsive table.

### Tests

Use a lightweight prototype/layout harness if useful to confirm the proposed minimums are plausible. Verify no selected threshold forces core content below readable/usable limits.

### Expected Result

M4 has one concrete responsive/QA specification instead of ad-hoc breakpoints discovered late.

### Definition of Done

- [ ] Representative viewport matrix is explicit.
- [ ] Minimum supported landscape size is explicit.
- [ ] Portrait/undersized rejection criteria are explicit.
- [ ] Game-area envelope/aspect-ratio rule is explicit.
- [ ] Card ratio and text/control minimums are explicit.
- [ ] Secondary-panel reflow priority is explicit.
- [ ] Values are recorded in M4/UI implementation notes/tests as appropriate.
- [ ] No separate mobile game implementation is proposed.

---

## M4-T05 — Build Reusable Visual Primitives and Card Component

### Goal

Create the small visual system needed to render cards and core controls consistently.

### Work

Implement:

- programmatic card face;
- simple card back;
- constant card aspect ratio from T04;
- four-color suits: Hearts red, Diamonds orange, Clubs blue, Spades black;
- off-white card foundation;
- base typography/button/panel tokens needed by the table;
- explicit non-color status affordances where appropriate.

Do not build the whole table.

### Tests

Verify:

- all ranks/suits render;
- suit symbol remains visible;
- card ratio remains constant at representative component sizes;
- selected/disabled states are distinguishable without relying on color alone;
- card component supports human hand and played-card use.

### Expected Result

M4 has reusable proportional card/control primitives instead of screen-specific card markup.

### Definition of Done

- [ ] Programmatic card face/back components exist.
- [ ] Four-color mapping is correct.
- [ ] Card aspect ratio is invariant.
- [ ] Basic selected/disabled/accessibility semantics exist.
- [ ] Component tests/typecheck/build pass.
- [ ] No 52-image asset set or elaborate animation is introduced.

---

## M4-T06 — Build Core Game Table Layout and Player Seats

### Goal

Render the authoritative public game state in the fixed Phase 1 seating/table layout.

### Work

Implement:

- Human South;
- bots West/North/East;
- player names/placeholders;
- current-turn indicator;
- opponent remaining-card counts;
- hand-to-beat area with actual cards/type/player;
- `FREE LEAD`;
- running Session score;
- PASS indicators;
- DONE/placement indicators.

Use production/public UI state from T03.

### Tests

Verify representative public states:

- different opening player despite fixed visual seats;
- current turn changes correctly;
- Pass badges clear on new Play/Trick reset according to authoritative events/state;
- finished players show DONE/placement and no live PASS;
- opponent hands are never rendered/revealed.

### Expected Result

The browser displays a readable live Pusoy Dos table before human hand actions are added.

### Definition of Done

- [ ] Four fixed seats render correctly.
- [ ] Current turn and hand-to-beat/free-lead are obvious.
- [ ] Remaining counts, scores, PASS, and DONE states render from authoritative data.
- [ ] No hidden hand information leaks.
- [ ] Component/integration tests pass.
- [ ] No rule logic is duplicated in React.

---

## M4-T07 — Implement Human Hand Rendering, Selection, and Sorting

### Goal

Allow the player to view and manipulate presentation of their own hand without submitting Moves yet.

### Work

Implement:

- render human cards;
- click/tap toggle selection;
- visible selected state;
- clear selection behavior;
- Sort by Rank;
- Sort by Suit;
- horizontal scrolling/controlled overlap hook for constrained layouts.

Sorting changes presentation order only.

### Tests

Verify:

- only owned cards render;
- selection toggles predictably;
- sort operations preserve exact card set;
- selected card identity survives/reconciles sorting;
- no arbitrary drag/manual arrangement exists;
- presentation sorting does not mutate authoritative hand order/state.

### Expected Result

Human hand interaction works independently from legality/submission.

### Definition of Done

- [ ] Human cards render using T05 component.
- [ ] Select/deselect works by physical card identity.
- [ ] Rank/suit sorts work.
- [ ] No cards are lost/duplicated by sorting.
- [ ] Engine state is not mutated.
- [ ] Focused UI tests/typecheck/build pass.

---

## M4-T08 — Add Authoritative Selection Inspection and Play Feedback

### Goal

Tell the human whether the currently selected cards form a legal Play without duplicating combination rules in React.

### Work

Connect selected cards to the Engine/application inspection/validation contract and present:

- no selection;
- invalid combination;
- valid combination that cannot beat current Trick;
- valid legal Play;
- recognized combination/type/strength information needed for clarity;
- `NOT VALID`/useful explanation;
- enabled/disabled Play button.

Do not submit the Move yet.

### Tests

Cover:

- invalid card counts/combinations;
- valid but non-beating selection;
- valid free-lead selection;
- valid response;
- opening move 3♣ requirement through authoritative validation;
- UI enablement follows authoritative result rather than duplicated local rules.

### Expected Result

The player gets immediate authoritative legality feedback for current selection.

### Definition of Done

- [ ] Selection inspection uses Engine/application contract.
- [ ] Invalid/non-beating selections cannot enable Play.
- [ ] Legal selection identifies recognized combination and enables Play.
- [ ] Error feedback is understandable.
- [ ] React contains no independent combination comparator.
- [ ] Focused tests/regressions/typecheck/build pass.

---

## M4-T09 — Submit Human Play and Pass Through Production Orchestrator

### Goal

Complete the human action path from UI intent to authoritative Engine transition.

### Work

Wire:

- PLAY for current legal selection;
- PASS only when responding and Engine/controller contract permits it;
- human controller resolution;
- post-action selection cleanup;
- stale/rapid input protection;
- explicit “No legal moves available” state when Engine reports no legal Play.

Phase 1 does not auto-pass.

### Tests

Verify:

- legal Play submits once;
- invalid/disabled Play cannot submit;
- Pass unavailable on free lead/opening;
- Pass works while responding;
- no-legal-Play message appears and Pass remains explicit;
- rapid/double click does not submit duplicate Move;
- stale human action cannot affect advanced state.

### Expected Result

The human can legally take a Turn through the same Orchestrator/Engine path as headless controllers.

### Definition of Done

- [ ] Human PLAY resolves current controller request exactly once.
- [ ] Human PASS follows canonical availability.
- [ ] No auto-pass is introduced.
- [ ] Stale/duplicate input is protected.
- [ ] Authoritative state updates after accepted action.
- [ ] Focused integration tests, M1–M3 regressions, typecheck/build pass.

---

## M4-T10 — Complete Core Human-vs-Bot Turn Interaction

### Goal

Prove normal gameplay can alternate between the human controller and three Baseline controllers on the rendered table.

### Work

Integrate the T06–T09 UI with production bot turns. Add only minimal presentation pacing needed for comprehension; any visual delay is separate from Baseline computation.

Ensure interaction controls are unavailable while it is not the human's turn.

### Tests

Verify:

- human → bot → bot → bot/current-turn sequences render correctly;
- human cannot act during bot turn;
- bot action updates current Trick/table;
- bot PASS/DONE states display correctly;
- actual AI compute result is not changed by presentation delay.

### Expected Result

A human can play through ordinary multi-player Turn flow against production Baseline bots.

### Definition of Done

- [ ] Mixed human/bot controller mapping works.
- [ ] Human controls respect turn ownership.
- [ ] Bot Plays/Passes appear through authoritative updates.
- [ ] Presentation pacing does not alter gameplay/determinism.
- [ ] Representative mixed-turn integration test passes.
- [ ] Regressions/typecheck/build pass.

---

## M4-T11 — Implement Played Cards and Event Log

### Goal

Expose authoritative public history for gameplay comprehension and QA.

### Work

Implement:

- Played Cards view for the current Round;
- sort/grouping Clubs → Spades → Hearts → Diamonds, each 3 → ... → A → 2;
- chronological factual Event Log for Plays, exact cards/combination, Pass, finish, Trick reset/free lead, and other required public events.

Both must derive from authoritative public events/history.

### Tests

Verify:

- played-card set exactly matches public cards played;
- Pass adds no card;
- card ordering is correct;
- Event Log chronology matches Engine events;
- hidden cards never appear;
- new Round resets/current-Round Played Cards appropriately.

### Expected Result

The player can inspect what has happened without the UI maintaining an independent gameplay history.

### Definition of Done

- [ ] Played Cards is authoritative and correctly ordered.
- [ ] Event Log is chronological and factual.
- [ ] No hidden information leaks.
- [ ] No duplicate history state machine is introduced.
- [ ] Focused tests/typecheck/build pass.

---

## M4-T12 — Add Information Overlays and Progression Pause Coordination

### Goal

Make secondary information usable on constrained layouts without allowing important bot actions to advance unseen behind blocking overlays.

### Work

Add overlay/drawer access for secondary panels where required by T04, especially Played Cards/Event Log. Coordinate with Orchestrator/application lifecycle so blocking information overlays pause/resume progression safely.

Do not pause by mutating Engine rules/state.

### Tests

Verify:

- overlay open/close state is presentation/application state;
- bot progression does not advance invisibly while designated blocking overlay is open;
- closing overlay resumes safely;
- stale controller response protections remain intact;
- overlays are keyboard/touch dismissible as applicable.

### Expected Result

Secondary information can collapse away on small landscape screens without confusing hidden gameplay progression.

### Definition of Done

- [ ] Required secondary overlays/drawers exist.
- [ ] Designated blocking overlays coordinate pause/resume safely.
- [ ] Engine rules/state are not modified to implement pause.
- [ ] No stale action is accepted after pause/resume transitions.
- [ ] Focused integration tests/regressions/typecheck/build pass.

---

## M4-T13 — Implement Round Result and Explicit Next Round

### Goal

Render the real Round Result checkpoint and require explicit human continuation.

### Work

At official Round completion show:

- placements;
- Round points;
- updated cumulative Session totals;
- explicit **Next Round**.

Next Round must invoke the production continuation seam established in M2; React must not manufacture/deal the next Round itself.

### Tests

Verify:

- Round Result appears only after Engine/Orchestrator completion;
- official result values are displayed;
- next Round does not start automatically for human play;
- Next Round advances once;
- rapid/double activation cannot start multiple Rounds;
- after Rounds 1–4, next Round returns to table.

### Expected Result

Human gameplay respects the approved Round Result checkpoint instead of headless auto-continuation.

### Definition of Done

- [ ] Official placements/points/totals display correctly.
- [ ] Explicit Next Round is required.
- [ ] Next Round uses production Orchestrator continuation.
- [ ] No duplicate continuation occurs.
- [ ] Round 1–4 integration tests pass.
- [ ] Regressions/typecheck/build pass.

---

## M4-T14 — Implement Session Summary and Five-Round Completion

### Goal

Complete the Phase 1 gameplay lifecycle after Round 5.

### Work

Render Session Summary with:

- winner;
- final ranking;
- final Session scores;
- all five Round results;
- relevant Basic tiebreak explanation when needed.

Simple Home/New Session actions may be included if they do not imply persistence.

### Tests

Verify:

- Session Summary appears after exactly Round 5;
- no sixth Round can start;
- final ranking/scores come from authoritative Session result;
- all five Round results display;
- tiebreak information is correct when supplied by authoritative result;
- optional Home/New Session resets application lifecycle cleanly.

### Expected Result

A human can reach a correct final result after a complete five-Round Session.

### Definition of Done

- [ ] Summary appears only on completed Session.
- [ ] Winner/ranking/scores/results are authoritative.
- [ ] Exactly five Rounds are represented.
- [ ] No sixth Round progression exists.
- [ ] Relevant Basic tiebreak is explainable.
- [ ] Focused integration tests/regressions/typecheck/build pass.

---

## M4-T15 — Implement Unsaved-Session Leave and Reload Warnings

### Goal

Ensure Phase 1 never implies that unfinished gameplay is persisted.

### Work

Implement:

- in-app Leave/Home confirmation during unfinished Session;
- clear progress-loss wording;
- browser-supported `beforeunload`/equivalent warning where appropriate;
- no Resume behavior after refresh/close.

Do not add persistence/localStorage game snapshots.

### Tests

Verify:

- in-app leave warns during unfinished Session;
- user can cancel leaving;
- completed/no-active Session does not receive unnecessary warning;
- browser unload hook is registered/removed appropriately where testable;
- reload/new launch does not present fake Resume state.

### Expected Result

The product communicates Phase 1's no-persistence limitation honestly and consistently.

### Definition of Done

- [ ] In-app unfinished-session leave confirmation works.
- [ ] Browser-supported unload protection is attempted where appropriate.
- [ ] No custom browser-warning wording is assumed.
- [ ] No Session persistence/Resume is implemented.
- [ ] Focused tests/typecheck/build pass.

---

## M4-T16 — Implement and Verify Full Responsive Reflow

### Goal

Apply the T04 responsive contract to the completed gameplay/result UI across the full supported viewport matrix.

### Work

Harden layouts for:

- large desktop;
- normal laptop;
- small/windowed desktop;
- tablet landscape;
- large phone landscape;
- small supported phone landscape;
- unsupported portrait;
- undersized landscape.

Apply:

- ratio-controlled game area;
- constant card ratio;
- bounded typography;
- minimum control targets;
- hand scrolling/controlled overlap;
- secondary panel collapse/reflow;
- safe margins/letterboxing;
- rotate/resize guidance.

### Tests

For every supported viewport verify:

- no critical overlap/clipping;
- current turn/hand-to-beat/actions remain obvious;
- hand remains navigable;
- card ratio is preserved;
- core text/control minimums are respected;
- secondary information remains reachable;
- Round Result/Summary remain usable.

For unsupported states verify guidance and clean recovery when returning to supported dimensions.

### Expected Result

One responsive component hierarchy remains usable across the frozen Phase 1 viewport matrix without a separate mobile implementation.

### Definition of Done

- [ ] All T04 representative viewport classes are exercised.
- [ ] No supported viewport has blocking overlap/clipping.
- [ ] Cards preserve ratio everywhere.
- [ ] Typography/control minimums are respected.
- [ ] Secondary UI reflows before core game UI becomes unusable.
- [ ] Portrait/undersized guidance works and restores cleanly.
- [ ] Automated layout/component checks pass where practical.
- [ ] Manual viewport QA evidence is recorded.

---

## M4-T17 — Phase 1 End-to-End Acceptance and Regression Verification

### Goal

Verify M4 and the complete Phase 1 working product.

### Work

Execute the full product flow:

```text
Home
→ Setup
→ Game Table
→ human + 3 Baseline bots
→ Round Result
→ explicit Next Round
→ ...
→ Round 5
→ Session Summary
```

Also run:

- critical React/application integration tests;
- viewport matrix QA;
- leave/reload behavior;
- offline gameplay verification;
- target-browser smoke testing as practical;
- full M1–M3 regression suites;
- typecheck;
- production build.

**Defect-routing rule:** substantial defects discovered here should be fixed in the task/component that owns the behavior, with focused regression coverage, then M4 acceptance rerun. T17 is not a catch-all feature task.

### Tests

Acceptance must demonstrate:

- correct human Play/Pass flow;
- no hidden information leak;
- no React rules duplication;
- no stale/duplicate human action;
- public history/status correctness;
- all five Round Result checkpoints;
- final Session Summary;
- supported landscape usability;
- graceful unsupported orientation/size handling;
- no persistence implication.

### Expected Result

Phase 1 delivers its first complete human-playable Pusoy Dos product.

### Definition of Done

- [ ] Every M4 milestone DoD item is PASS or explicitly unresolved.
- [ ] Human completes a real five-Round Basic Session against three Baseline bots.
- [ ] Same production Engine/Orchestrator/controller architecture is used.
- [ ] Critical UI/application tests pass.
- [ ] Frozen viewport matrix passes documented QA.
- [ ] Offline gameplay works without gameplay network requests after required assets are available.
- [ ] Practical target-browser smoke checks are recorded.
- [ ] M1–M3 regressions pass.
- [ ] Typecheck and production build pass.
- [ ] No deferred feature is required for successful Phase 1 completion.
- [ ] Unrun verification is reported as NOT VERIFIED, never falsely PASS.

---

# 18. Dependency Model and Recommended Order

```text
T01 App shell/navigation
 ↓
T02 Human controller
 ↓
T03 Production state → React
 ↓
T04 Responsive/QA contract
 ↓
T05 Visual/card primitives
 ↓
T06 Core table
 ↓
T07 Human hand interaction
 ↓
T08 Authoritative selection validation
 ↓
T09 Human Play/Pass submission
 ↓
T10 Mixed human/bot gameplay
 ↓
T11 Played Cards/Event Log
 ↓
T12 Overlays/pause coordination
 ↓
T13 Round Result/Next Round
 ↓
T14 Session Summary
 ↓
T15 Unsaved-session warnings
 ↓
T16 Responsive hardening
 ↓
T17 Phase 1 acceptance
```

The order establishes the human-controller/application boundary before rich UI, freezes responsive constraints before the final table is hardened, and postpones broad responsive QA until the complete information hierarchy exists.

T11–T15 are functionally separable once T10 works, but sequential implementation is preferred for the current coding-agent workflow to minimize conflicting edits and repeated repository/context discovery.

---

# 19. Per-Task Scope Guardrails

1. React must not become a second rules/scoring authority.
2. Human and bot actions must continue through production controller/Orchestrator/Engine paths.
3. Do not add Competitive Mode, difficulty/personality selection, persistence/Resume, Stats, Settings, auto-pass, manual drag ordering, sound, or major animation.
4. Do not reveal hidden opponent hands.
5. Do not use presentation delay to change Baseline AI computation/decisions.
6. Do not create separate desktop and mobile game implementations.
7. Unsupported portrait/undersized states should guide the user rather than distort the table.
8. Material ambiguity is `CONFLICT / CLARIFICATION REQUIRED`, not a silent design choice.
9. Never report tests/builds/manual QA as passed unless actually executed.
10. Follow repository Git safety rules; Git writes remain user-controlled.

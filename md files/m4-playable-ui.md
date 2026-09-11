# Pusoy Dos --- M4 Minimal Playable UI

## Milestone Design Document (v1.0)

**Status:** Approved design baseline for later task decomposition  
**Last Modified:** September 11, 2026  
**Milestone:** M4 --- Minimal Playable UI  
**Phase:** Phase 1 --- Initial Playable Basic Game  
**Parent requirements:** `requirements.md` v1.13  
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

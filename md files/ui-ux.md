# Pusoy Dos --- UI / UX Design

## UI / UX Document (v1.1)

**Status:** Phase 1 design baseline with deferred approved ideas  
**Last Modified:** September 8, 2026
**Committed scope:** Phase 1 — Minimal Playable Basic Game UI

---

> This document separates **Phase 1 requirements** from **deferred approved design**. Deferred sections preserve decisions but are not implementation commitments or a post-Phase-1 timeline.

# 1. Product Experience Goal

Phase 1 must make the already-tested production game system human-playable without creating a second rules authority in React. UI priorities are: **clarity → functionality → implementation simplicity → responsiveness → visual polish**.

A player should always be able to answer: **Whose turn is it? What hand must be beaten? What can I do?**

# 2. Architectural Boundary

React owns presentation state such as selected cards, open overlays, sort order, and temporary messages. Engine/Orchestrator-owned state includes current player, trick, authoritative hands, scores, finished state, legal Moves, and winners.

Flow: **React intent → Orchestrator → Engine; Engine state/events → Orchestrator → safe UI state → React.** Combination recognition and Move legality remain Engine-owned even when the UI disables an invalid action for convenience.

# 3. Phase 1 Screens

Phase 1 uses: **Home → minimal Game Setup → Game Table → Round Result → Next Round/Game Table → Session Summary**. No Resume, Stats, Settings, Rules/Tutorial, difficulty/personality configuration, or Competitive setup is required.

# 4. Seating and Players

Fixed visual seats: Human South; bots West, North, East. Seats do not determine the opening player; the holder of 3♣ starts each Round. Play remains clockwise. Bots use simple placeholder names and remaining-card counts. Phase 1 bots are Baseline bots; no difficulty/personality labels or selectors are shown.

# 5. Game Table — Phase 1

The table must show current Round/mode context, current turn, current hand to beat with actual cards/type/player, opponent remaining-card counts, current/running scores, live PASS state, DONE/placement state, the human hand, and available human actions.

## 5.1 Current trick

The center retains the current hand-to-beat through Passes until it is beaten or the Engine officially resets the Trick. Free lead is explicitly labeled **FREE LEAD**. After a Basic finisher's final play, keep that final combination visible while the continuation rule resolves.

## 5.2 PASS and DONE

PASS appears beside the relevant player panel for the current response cycle. A new successful Play or Trick reset clears prior PASS indicators. Historical Passes remain in Event Log. Finished/ineligible players never show PASS.

Finished players remain visible and show persistent **DONE**. Basic Mode may show `DONE — 1st`, `DONE — 2nd`, etc.

## 5.3 Human hand

Tap/click toggles card selection; selected cards visibly raise/highlight. Phase 1 supports **Sort by Rank** and **Sort by Suit**. Arbitrary manual rearrangement is deferred. Horizontal hand scrolling is acceptable on mobile.

## 5.4 Selection and Play feedback

The UI asks the Engine to inspect/validate selected cards. No selection, invalid combination, or a valid combination that cannot beat the current trick keeps the action disabled and shows **NOT VALID** with a useful explanation. A valid legal selection shows the recognized hand and enables **PLAY**.

Phase 1 does not proactively highlight all legal cards/moves.

## 5.5 Pass and no-legal-move feedback

Passing is available only while responding. Phase 1 does not auto-pass. If the Engine reports no legal Play, explicitly tell the player **No legal moves available** (or equivalent clear wording) and make the required Pass action obvious so a new player does not appear stuck.

# 6. Scores and Results

During play, show current cumulative Session scores in a simple visible location; an overlay is not required for Phase 1.

Round Result is a real checkpoint. It shows official Basic placements, points gained that Round, and the updated running Session total. The next Round starts only after explicit **Next Round** input.

Session Summary shows winner, final ranking, all five Round results, final Session scores, and tiebreak information when relevant. It may offer Rematch/New Session/Home if those actions are straightforward and do not imply persistence.

# 7. Played Cards and Event Log

Phase 1 includes a Played Cards view and Event Log because both aid gameplay comprehension and manual QA.

Played Cards shows exact publicly played cards from the current Round, grouped Clubs → Spades → Hearts → Diamonds and ordered 3 → ... → A → 2 within a suit. Pass adds no card.

Event Log shows chronological factual events such as player, exact played cards, recognized combination, Pass, finish, and Trick reset/free lead. Both derive from authoritative public Engine history/events rather than independent duplicate state.

Information overlays pause Orchestrator progression while open so bot turns do not advance unseen behind them.

# 8. Leaving an Unsaved Session

Phase 1 has no persistence. In-app Leave/Home actions during an unfinished Session must explicitly warn that progress will not be saved. Refresh/tab/window close should use the browser-supported unload warning where available; custom wording or interception is not guaranteed by browsers.

# 9. Phase 1 Visual Foundation

Use a simple **Modern Casino Table** direction: green table cues translated into clean digital UI, not a photorealistic gambling environment. Prefer CSS/components over custom artwork.

Use related green shades for page, table, panels, interactions, and overlays; off-white cards; near-black primary card text; readable muted-light text on green. Exact color tokens are not frozen until the first functional table is evaluated.

Cards are programmatic React components with simple rounded rectangles and suit/rank symbols. Phase 1 default suit colors are **Hearts red, Diamonds orange, Clubs blue, Spades black**. There is no color-mode toggle in Phase 1. Suit symbols remain visible so meaning never depends on color alone.

Use one clean sans-serif/system font stack, a small consistent button system, simple placeholder bot avatars/initials, and a CSS/SVG card back. No custom portraits, 52 raster card images, sound files, or elaborate animation assets are required.

Status must never rely on color alone: current turn has explicit text/highlight; PASS and DONE have labels; selected cards have position/treatment; invalid actions have text.

# 10. Responsive Requirement

Use one responsive component hierarchy rather than separate desktop/mobile game implementations. Mobile may scroll the human hand horizontally. Phase 1 must remain usable on common phone and desktop widths; visual perfection is not required before functional correctness.

# 11. Deferred Approved UI Ideas — No Timeline

Preserved for later evaluation, not Phase 1 commitments: persistence/Resume UI; Stats; Settings; auto-pass; two-color/four-color suit preference; difficulty/personality configuration; Surprise Me; Mystery Bots with end-of-Session reveal; Competitive penalty breakdown and loser-hand reveal; arbitrary manual card rearrangement; richer animations/audio/branding/progression; additional accessibility controls.

# 12. Possible Future Directions — Not Committed

Online/multiplayer UI and other product expansions are not part of the committed roadmap. They must be separately planned if selected after Phase 1 evaluation.

# 13. Phase 1 UI Acceptance

M4/Phase 1 is complete when a human can start a Basic Session, understand the active turn and current trick, select/validate/play/pass, receive explicit no-legal-move guidance, observe PASS/DONE/public history/scores, complete five Rounds with explicit Round Result checkpoints, and reach a correct Session Summary using the production Engine/Orchestrator without duplicated game-rule logic in React.

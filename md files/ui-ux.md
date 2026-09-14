# Pusoy Dos --- UI / UX Design

## UI / UX Document (v1.2)

**Status:** Phase 1 design baseline with deferred approved ideas  
**Last Modified:** September 15, 2026  
**Parent document:** `requirements.md` v1.14  
**Committed scope:** Phase 1 — Minimal Playable Basic Game UI

---

# 1. Product Experience Goal

Phase 1 makes the proven production game human-playable without creating a second rules authority in React. UI priorities are **clarity → functionality → implementation simplicity → responsiveness → visual polish**.

A player should always be able to answer: **Whose turn is it? What hand must be beaten? What can I do?**

# 2. Architectural Boundary

React owns presentation state such as selected cards, manual display order, opened overlays, animation/pacing state, and responsive layout state. Engine/Orchestrator-owned state includes current player, Trick, authoritative hands, scores, finished state, legal Moves, winners, and factual public events.

Flow: **React intent → HumanController/Orchestrator → Engine; Engine state/events → Orchestrator → safe UI state → React.** Combination recognition and Move legality remain Engine-owned.

Phase 1 Start Game immediately starts the fixed Basic Session, but startup must use a small configuration/application boundary so a future setup sub-screen can be inserted without replacing Session startup architecture.

# 3. Phase 1 Screen Flow

**Home → Start Game → Game Table → Round Result overlay → Next Round/Game Table → ... → Round 5 Result overlay → Session Summary.**

There is no Phase 1 setup screen because there are no meaningful user-selectable game options yet. No Resume, Stats, Settings, Rules/Tutorial, difficulty/personality configuration, or Competitive setup is required.

Session Summary offers **Play Again** and **Home**.

# 4. Seating, Names, and Players

Fixed visual seats: Human South; bots West, North, East. Seats do not determine the opener; the holder of 3♣ starts each Round. Bots use names randomly chosen from a user-provided name pool, with no difficulty/personality labels.

Bot hands are rendered as overlapping face-down cards plus an explicit remaining-card count. The UI never reveals bot card faces during active play.

# 5. Game Table Layout

The table must show current Round context, current turn, cumulative scores, player names/counts, PASS/DONE/placement status, the human hand, and human actions.

## 5.1 Center table

The center contains:

- a **Discard Pile** button;
- the current hand to beat with actual cards, recognized type/rank where useful, and the player who made that Play;
- explicit **FREE LEAD** when appropriate.

The current hand to beat remains visible through Passes until beaten/reset. Every successfully played card immediately belongs to the public Discard Pile, including cards from the current Trick.

## 5.2 Bottom human area

The bottom relationship is:

- **left:** Event Log button and Leave Game;
- **center/top:** human cards;
- **center/bottom:** Sort by Rank and Sort by Suit;
- **right:** large Play and Pass controls.

This is a responsive relationship, not fixed pixel positioning.

# 6. Human Hand, Selection, Sorting, and Manual Arrangement

Human cards remain on one horizontal baseline. When space is constrained, cards overlap horizontally while enough of each card remains exposed for reliable click/tap and drag targeting.

Tap/click toggles selection. Selected cards visibly rise to a higher horizontal level while preserving their position in hand order. Clicking empty table space does not clear selection.

Phase 1 supports bounded manual rearrangement by mouse/touch drag within the hand region. Cards cannot be dragged indefinitely around the table. Reordering changes only display order; it does **not** select/deselect cards. A selected card remains selected when moved, and moving neighboring cards does not change selection.

**Sort by Rank** and **Sort by Suit** are always visible and usable even when the hand already matches that order. Sorting preserves current selection and simply reapplies canonical display order; no separate Custom sort state is needed.

- Sort by Rank: Rank 3 → ... → A → 2; ties Clubs → Spades → Hearts → Diamonds.
- Sort by Suit: Clubs → Spades → Hearts → Diamonds; within suit Rank 3 → ... → A → 2.

# 7. Play, Pass, and Validation Feedback

The large Play control carries selection feedback. No selection/invalid/non-beating selection keeps Play disabled/gray. Where practical, show a specific Engine-derived reason such as **Invalid combination**, **Wrong number of cards**, **Must include 3♣**, or **Doesn't beat Pair of 9s**. A valid legal selection shows the recognized combination and enables Play.

Pass is available only where canonical rules allow it. Strategic Pass remains available even when legal beating Plays exist. If no legal Play exists while responding, the Pass control explicitly includes **No valid plays** so the player understands the state. Phase 1 does not auto-pass.

After a successful human Play, played cards leave the hand, selection clears, remaining cards close gaps, and the authoritative play becomes the current hand to beat and part of the Discard Pile.

# 8. Bot Turns and Pacing

Bots use the same production Orchestrator/controller path. A bot starts deciding only after the Orchestrator gives that bot the active Turn; bots do not precompute decisions during another player's Turn.

Actual Baseline computation is separate from presentation delay. Use a short readable presentation delay as a tunable UI value, initially around 0.6–1.0 seconds per bot action. Do not make exact millisecond timing a human acceptance requirement.

A bot Play updates the center cards, count, and Event Log. A bot Pass shows PASS beside that player. PASS remains for the current response cycle and clears on the next successful Play or Trick reset.

# 9. Discard Pile and Event Log

## 9.1 Discard Pile

The Discard Pile button opens an overlay containing **all cards successfully played so far in the current Round**, including the current Trick. Group Clubs → Spades → Hearts → Diamonds; within each suit order 3 → ... → A → 2. Pass contributes no card. Close/Exit returns to the table.

## 9.2 Event Log

The bottom Event Log button shows the most recent factual event as compact preview text where space permits. Opening it shows the chronological public Round history. It initially opens at the newest event; scrolling upward moves toward earlier events and the first event is at the top.

Record useful public gameplay events such as Round start/opener, exact Play + recognized combination, Pass, Trick reset/free lead, and player finish/placement. It is a player-facing factual history, not a debug trace.

Both overlays derive from authoritative public Engine history/events. While either overlay is open, Orchestrator progression is paused so bot actions do not occur unseen. Closing resumes from the same execution point.

# 10. Leave Game

Leave Game is a secondary left-side action. During an unfinished Session it opens an application confirmation overlay explaining that progress is not saved, with **Yes/Leave Game** and **Return/Stay** actions. The confirmation pauses progression. Browser refresh/tab/window close uses supported unload warnings where available; browser wording is not guaranteed.

# 11. End-of-Round Reveal

When the 3rd-place player finishes, the Engine has completed the Basic Round and the 4th-place player is known. Normal interaction stops. Before the result overlay appears, reveal the 4th-place player's remaining cards in that player's normal table position, sorted by Rank. This information is exposed only after Round completion; active-play hidden-information boundaries remain intact.

Show the reveal for roughly **1.5–2 seconds**. A click/tap may finish the reveal immediately. The same input must not accidentally activate the next result action.

# 12. Round Result Overlay

Round Result is a modal/overlay over the dimmed completed table, not a separate page. It is not dismissible by outside click/Escape; progression occurs through its explicit action.

The scoring presentation sequence is:

1. rows appear arranged by standings **before** the just-completed Round score;
2. Round points (+5/+3/+2/+0) appear;
3. Total values update;
4. rows smoothly rearrange by the new cumulative total;
5. the heading/column presentation settles on **Total** rather than permanently retaining a Previous Total column.

The animation is short and skippable by click/tap; skipping completes the visual state but must not trigger Next Round. Ties during an unfinished Session retain stable previous relative order rather than inventing a final ranking.

Rounds 1–4 show **Next Round**. Round 5 shows **View Session Results**.

# 13. Session Summary

After Round 5, Session Summary shows the official final ranking ordered by final Session result, final scores, all five Round results, and tiebreak explanation when relevant. Apply the official Basic tiebreak rules here.

Give 1st/2nd/3rd restrained gold/silver/bronze background/border treatment while retaining explicit placement text so meaning is not color-only. Provide **Play Again** and **Home**.

# 14. Responsive and Orientation Contract

Gameplay is landscape-first and must support large desktop, normal laptop, smaller/windowed desktop, tablet landscape, large phone landscape, and a defined small supported phone landscape. Portrait is unsupported gameplay orientation: pause/prevent interaction and show **Rotate your device to continue**; returning to landscape restores coherent state. Too-small landscape shows resize/unsupported guidance rather than an unreadable table.

Use a bounded ratio-controlled play area rather than assuming fullscreen or exact 16:9. Cards preserve a constant aspect ratio. Text uses bounded readable sizing and critical controls retain usable click/touch targets. Secondary UI compresses/reflows before core gameplay becomes unusable.

Human cards remain on the same baseline; constrained layouts increase horizontal overlap rather than vertically staggering unselected cards. Selected cards alone rise.

Exact representative CSS viewport dimensions and minimum supported dimensions are frozen during M4 implementation task T04 and reused for automated/manual QA.

# 15. Visual Foundation

Use a modern green casino-table direction, off-white cards, Hearts red, Diamonds orange, Clubs blue, Spades black, clean system/sans typography, component/CSS cards, and a simple CSS/SVG card back. Use labels in addition to color. Major sound, character art, and elaborate animation remain deferred.

# 16. UI Testing Strategy

Use complementary layers:

- **Vitest + React Testing Library:** component/application behavior and integration boundaries.
- **Playwright:** a small set of high-value real-browser tests for startup, responsive/orientation behavior, drag/reorder, overlay pause behavior, and critical end-to-end flows. Codex may create and run these tests as part of M4 tasks.
- **Human manual acceptance:** observable usability and comprehension. Codex writes the checklist; a real person performs it. Do not ask humans to verify internal state or precise millisecond timing.

Human checks should include whether the tester can understand whose turn it is, identify the hand to beat, click overlapped cards, see selected cards rise, rearrange without changing selection, use sorting, understand invalid Play reasons and No valid plays, inspect/exit overlays, follow bot actions, understand the 4th-hand reveal and result-score reordering, recover from portrait, and safely leave a Session.

# 17. Deferred Approved UI Ideas

Deferred: persistence/Resume UI; Stats; Settings; auto-pass; suit-color preference toggle; difficulty/personality configuration; Surprise Me; Mystery Bots; Competitive-specific result details; richer animation/audio/branding/progression; additional accessibility controls. Manual hand rearrangement is **not deferred**; it is Phase 1 scope.

# 18. Phase 1 UI Acceptance

M4/Phase 1 is complete when a human can start a Basic Session immediately from Home, play a complete five-Round Session against three Baseline bots through production Engine/Orchestrator boundaries, use selection/sorting/manual arrangement and Play/Pass correctly, inspect public Discard/Event history without hidden-information leakage, understand Round/Session results, and use the same coherent landscape-first UI across the documented supported viewport matrix.

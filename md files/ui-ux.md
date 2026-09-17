# Pusoy Dos --- UI / UX Design

## UI / UX Document (v1.6)

**Status:** Phase 1 design baseline with deferred approved ideas  
**Last Modified:** September 18, 2026  
**Parent document:** `requirements.md` v1.15  
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

Every combination type displays its cards in a fixed canonical order — never the order the cards happened to be selected/submitted in:

- **Single:** the one card, unchanged.
- **Pair** and **Triple:** all cards share one Rank, so they are ordered by Suit low → high (`Clubs < Spades < Hearts < Diamonds`, §2.2 of `requirements.md`).
- **Straight** and **Straight Flush:** the five cards in that combination's own ascending house-rule sequence (§2.4.1 of `requirements.md`: `A-2-3-4-5`, `2-3-4-5-6`, `3-4-5-6-7`, ..., `10-J-Q-K-A`, `J-Q-K-A-2`), not the hand's own Sort-by-Rank order (§6). The two orders differ only for the two special low Straights, where Sort-by-Rank's Ace/2-high convention would otherwise scatter the low cards to the end of the display (e.g. showing `3,4,5,A,2` instead of `A,2,3,4,5`).
- **Flush:** the five same-suit cards ordered by Rank low → high (`3 → ... → A → 2`, the same Rank order §6's Sort by Rank uses).
- **Full House:** the Triple's three cards first (themselves ordered by Suit low → high), then the Pair's two cards (themselves ordered by Suit low → high) — `requirements.md` §2.4.3's own "Triple"/"Pair" distinction, not submission order.
- **Four-of-a-Kind:** the four matching cards first (themselves ordered by Suit low → high — all four suits are necessarily present), then the kicker last — `requirements.md` §2.4.4's own "four matching cards"/"kicker" distinction.

This is a UI presentation choice layered on an already-Engine-validated `Combination`; it never changes what combination was recognized, its legality, or its comparison strength (M4-T12.5).

Card face detail (corner index vs. center pip) is defined in §5.6.

## 5.2 Bottom human area

The bottom area is three aligned horizontal containers, sharing one row:

- **left container:** the Event Log button and Leave Game, stacked vertically and centered within the container, both the same fixed length regardless of their own label length;
- **middle container:** human cards on top, Sort by Rank / Sort by Suit side by side and centered beneath them. Its own width is reserved for the maximum possible 13-card hand and held constant as cards are played away during a Round — a smaller hand simply stays centered within that reserved width rather than narrowing it. Height still sizes to its own content (the cards plus the Sort buttons), so the card size (and headroom for a selected/raised card) always takes priority;
- **right container:** Play stacked above Pass, large primary controls. Each shows its own recognized-combination/invalid-reason/"No valid plays" text as a smaller second line inside the button itself; the Play/Pass label itself reads as clearly primary (roughly three-quarters of its own text weight) against that smaller second line, and both buttons keep a fixed size regardless of whether the second line is present.

The three containers share one row and read as one coherent, evenly-aligned band; which container ends up tallest in practice does not change that. This is a responsive relationship, not fixed pixel positioning.

The Event Log and Leave Game buttons render now as inert placeholders — pressing them currently does nothing — the same way the center table's own Discard Pile button (§5.1) has since its own introduction. Their actual overlay/confirmation behavior is separate, later work (§9.2, §10).

## 5.3 Bot seat layout (West/East)

West and East bot hands stack lengthwise (vertically) along the seat's outer edge, with that player's details (name, remaining-card count, score, turn/PASS/DONE status) positioned toward the center table rather than the outer edge — the same details-near-center relationship North and South already have. Read left to right: **Lengthwise cards | West details | Center table | East details | Lengthwise cards.** This keeps a full 13-card overlapping hand contained within the table border rather than spilling past it, at every supported viewport (§14).

West and East render each face-down card **rotated 90° to match the seat's own vertical stacking axis**, at the same physical card size as North/South's cards (not shrunk to fit the rotation), rather than upright cards stacked sideways. The rotated footprint must not exceed the space a same-size card's rotation naturally produces, preserving the existing full-hand-stays-within-the-table-border guarantee at every supported viewport (§14).

## 5.4 Per-seat Play/Pass trail

In addition to the center table's current hand to beat (§5.1), each seat shows **its own most recent Play for the active response cycle**, inside that seat's own panel (alongside its name/count/score/status):

- When a seat successfully Plays, that combination renders as a compact rank+suit corner badge per card (not a shrunk full card face, which reads illegibly at that size) inside the seat's own panel. The badge row wraps and stays within the panel's own width so it never grows out into the center table's own space. It follows the same canonical card-order rule as the center table's own hand to beat (§5.1), for every combination type.
- That seat's own last Play is shown at full visibility while it is still the hand to beat, and **dimmed ("grayed out")** once a later Play beats it — it is not removed, so the player can see what was beaten and by how much.
- A seat that Passes shows an explicit **PASS** at its own position (already specified in §8) **instead of** any earlier Play indicator from that same seat this cycle — a seat's own Pass replaces its own prior Play badge rather than showing both together, even if that Play had not yet been beaten.
- While a seat's own "deciding" indicator (§8) is showing, its Play trail is hidden — it is about to be replaced by that seat's next decision anyway.
- All per-seat Play/Pass indicators are cleared together the moment the response cycle resets to a **FREE LEAD** (Trick reset) — matching the same reset boundary that already clears PASS in §8.
- **Exception:** if that same Trick reset is also the Round's own completion (the 3rd-place finisher's final Play), every seat's trail is left showing as-is rather than cleared, so the Play that ended the Round doesn't disappear before the person ever sees it. It clears normally on the next genuine mid-Round reset, and always clears going into the next Round.

This is presentation only: it derives from the same authoritative public Play/Pass/Trick-reset events already used for the center table and Event Log (§9.2), and does not change what information is public or when.

## 5.5 In-table finish and turn glow

Each seat's panel gets a glow, separate from its text status, so who has finished (and in what place) and whose Turn it is are each recognizable at a glance without reading text:

- **1st place finish:** gold glow.
- **2nd place finish:** silver glow.
- **3rd place finish:** bronze glow.
- **Current Turn:** white glow — deliberately distinct from the gold "finished 1st" glow so the two are never confused.
- A 4th-place finish (or any not-yet-placed finish) gets no special glow.

This is an additional glance-able cue; the existing text status (Turn/PASS/DONE + ordinal, §5 intro) still carries the same meaning without color, per §15's label-plus-color rule. This extends the medal-color convention already used for the Session Summary (§13) to the live table itself. The glow is a border-color/box-shadow treatment only — it never changes that panel's own layout size (§5.7).

## 5.6 Card face detail: corner index vs. center pip

Every face-up card always shows the two corner rank/suit indices. Whether it additionally shows a large center suit pip depends on context:

- **The player's own held hand** (§6): corners **and** a center pip — held cards have room to spare, and read as visually incomplete without it.
- **The center table's current hand to beat** (§5.1) and **each seat's own per-seat Play/Pass trail** (§5.4): corners only, no center pip — these render more cards in less space, where a large center pip visually collided with the corner indices and made them harder to read at a glance.

## 5.7 Table and panel dimension stability

The table's own bordered box does not change size as a Round is played, and neither does any individual seat's own panel — each reserves its own worst case (a full 13-card hand for the bot-hand stack, a wrapped 5-card trail for the panel, a full hand-to-beat display for the center) and holds it constant through the Round, rather than growing or shrinking as that seat's hand empties or its status/trail come and go. Only an actual viewport resize changes these sizes.

Within a panel, content is vertically centered as a block, and the status badge and Play trail each occupy an always-reserved slot (empty when there is nothing to show) rather than being removed outright — so an idle seat with no badge, or a seat with no trail to show, doesn't shift its name/count position or leave a lopsided gap.

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

Play defaults to a neutral gray/white appearance and turns green, with a glowing yellow highlight, only once the current selection is a valid, legal Play; it is otherwise visually indistinguishable from any other disabled control. Pass keeps its own always-blue appearance and is separately highlighted (the same glowing-yellow treatment) only when responding with no legal Play available. Both the recognized combination name and any invalid/"No valid plays" reason render as a smaller second line inside the button itself, and remain available to assistive technology via the button's accessible description even though the button's own accessible name stays the fixed "Play"/"Pass"; the "Play"/"Pass" label itself is the visually dominant text in the button (roughly three-quarters of its own text weight), with that second line clearly secondary; Play and Pass keep a fixed size whether or not the second line is present — color alone never carries the state, per §15's label-plus-color rule.

# 8. Bot Turns and Pacing

Bots use the same production Orchestrator/controller path. A bot starts deciding only after the Orchestrator gives that bot the active Turn; bots do not precompute decisions during another player's Turn.

Actual Baseline computation is separate from presentation delay. Use a short readable presentation delay as a tunable UI value; the current default is **0.8 seconds** per bot action (tuned from an initial 0.6–1.0 second range: first raised to 1.5s, then brought back down to 0.8s once the person could compare both in practice). Do not make exact millisecond timing a human acceptance requirement.

While a bot's presentation delay is in progress, that bot's panel shows a small non-blocking "deciding" indicator so the player can see whose Turn is being processed; it is purely presentational and never reflects real computation time.

A bot Play updates the center cards, count, and Event Log. A bot Pass shows PASS beside that player. PASS remains for the current response cycle and clears on the next successful Play or Trick reset.

# 9. Discard Pile and Event Log

## 9.1 Discard Pile

The Discard Pile button opens an overlay containing **all cards successfully played so far in the current Round**, including the current Trick. Group Clubs → Spades → Hearts → Diamonds; within each suit order 3 → ... → A → 2. Pass contributes no card. Close/Exit returns to the table.

## 9.2 Event Log

The bottom Event Log button shows the most recent factual event as compact preview text where space permits. Opening it shows the chronological public **Session** history, not only the current Round's — so an already-completed Round's own history remains reachable after that Round's Result overlay closes and the next Round begins, rather than resetting every Round. It initially opens at the newest event; scrolling upward moves toward earlier events and the first event of the whole Session is at the top.

Record useful public gameplay events such as Round start/opener, exact Play + recognized combination, Pass, Trick reset/free lead, and player finish/placement. Each Round's own start and completion entries double as that Round's own boundary markers within the combined Session history, so earlier Rounds read as one continuous history rather than needing a separate marker event of their own. It is a player-facing factual history, not a debug trace.

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

## 12.1 Round-Start Transition Screen

Between clicking **Next Round** and the next Round's own opening Turn becoming interactive, a brief transition screen dims the table and shows the destination Round number (e.g. **Round 3**), then lights the table back up once that Round is actually live. The next Round's own dealing/start is deferred until this transition ends — by its own short timer or an earlier click/tap skip — rather than the new Round flashing into view underneath the transition screen.

The same dim/label/lit treatment also covers Round 1's own very first start, immediately after Start Game, so every Round — including the first — gets the identical transition rather than only Rounds 2 and later. Round 1 is already dealt and live the moment the table first renders, so there is nothing to defer there; the transition instead pauses ordinary Turn advancement for its own short duration (the same reference-counted pause any open overlay already uses, §9.2), purely so the same visual sequence applies uniformly across every Round.

The transition is short, matching the same brief/skippable presentational-delay convention used elsewhere (§8's bot pacing, §11's reveal) rather than a longer ceremony. A click/tap skip only ends the transition itself; it never also advances into further gameplay on its own — the same "skipping must not accidentally activate the next action" rule §11 and §12 already state.

This is presentation only, layered on the same authoritative Round-boundary state already described above; it introduces no new Engine/Orchestrator state.

# 13. Session Summary

After Round 5, Session Summary shows the official final ranking ordered by final Session result, final scores, all five Round results, and tiebreak explanation when relevant. Apply the official Basic tiebreak rules here.

Give 1st/2nd/3rd restrained gold/silver/bronze background/border treatment while retaining explicit placement text so meaning is not color-only. Provide **Play Again** and **Home**.

# 14. Responsive and Orientation Contract

Gameplay is landscape-first and must support large desktop, normal laptop, smaller/windowed desktop, tablet landscape, large phone landscape, and a defined small supported phone landscape. Portrait is unsupported gameplay orientation: pause/prevent interaction and show **Rotate your device to continue** — but only on a touch/coarse-pointer device that can actually be physically rotated (a phone or tablet); a portrait-shaped window on a mouse/trackpad (fine-pointer) desktop or laptop cannot be rotated, so it instead gets the same resize/unsupported guidance as too-small landscape (M4-T11 follow-up). Returning to landscape, or to a supported size, restores coherent state. Too-small landscape shows resize/unsupported guidance rather than an unreadable table.

Use a bounded ratio-controlled play area rather than assuming fullscreen or exact 16:9. Cards preserve a constant aspect ratio. Text uses bounded readable sizing and critical controls retain usable click/touch targets. Secondary UI compresses/reflows before core gameplay becomes unusable.

The play area (table plus the bottom action bar) scales as a single proportional unit rather than each element resizing independently, so relative proportions — table, seats, cards, controls — stay visually consistent from large screens down to small ones, and the whole area fits within the viewport height without requiring a scrollbar at any supported size. When a real device's available height is unusually short relative to its width (a real mobile browser's own address bar/chrome can leave noticeably less usable height than device-emulated estimates assume), height is the binding constraint: the scale is derived from available height first, and width follows from that scale, producing a narrower but fully height-fit table rather than one that fills available width and overflows vertically. M4-T14 (Full Responsive Hardening) owns applying this scaling approach across the frozen viewport matrix.

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

Deferred: persistence/Resume UI; Stats; Settings; auto-pass; suit-color preference toggle; difficulty/personality configuration; Surprise Me; Mystery Bots; Competitive-specific result details; richer animation/audio/branding/progression; additional accessibility controls; an adaptive playable-portrait layout (Phase 2 idea — §14's landscape-first contract, including rotate guidance for portrait, remains Phase 1 behavior; a portrait-specific reflowed layout is not Phase 1 scope). Manual hand rearrangement is **not deferred**; it is Phase 1 scope.

# 18. Phase 1 UI Acceptance

M4/Phase 1 is complete when a human can start a Basic Session immediately from Home, play a complete five-Round Session against three Baseline bots through production Engine/Orchestrator boundaries, use selection/sorting/manual arrangement and Play/Pass correctly, inspect public Discard/Event history without hidden-information leakage, understand Round/Session results, and use the same coherent landscape-first UI across the documented supported viewport matrix.

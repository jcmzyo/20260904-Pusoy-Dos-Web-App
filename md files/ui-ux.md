# Pusoy Dos --- UI / UX Design

## UI / UX Document (v1.11)

**Status:** Phase 1 design baseline with deferred approved ideas  
**Last Modified:** September 19, 2026  
**Parent document:** `requirements.md` v1.16  
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

- the current hand to beat with actual cards, recognized type/rank where useful, and the player who made that Play;
- explicit **FREE LEAD** when appropriate.

**Follow-up (M4-T14):** the **Discard Pile** button no longer sits in the center; it moved to the bottom area's left container (§5.2). At the frozen minimum touch-target height (§14) it no longer fit above the hand to beat without making the smallest play area about 50px taller, which would shrink everything on a phone-sized screen.

The current hand to beat remains visible through Passes until beaten/reset. Every successfully played card immediately belongs to the public Discard Pile, including cards from the current Trick.

Every combination type displays its cards in a fixed canonical order — never the order the cards happened to be selected/submitted in. Across every type, the card(s) whose Rank actually determines that combination's comparison strength (`requirements.md` §2.4.2-§2.4.4) always display **rightmost**:

- **Single:** the one card, unchanged.
- **Pair** and **Triple:** all cards share one Rank, so they are ordered by Suit low → high (`Clubs < Spades < Hearts < Diamonds`, §2.2 of `requirements.md`) — the highest-Suit card, which alone breaks a tie between two equal-Rank Pairs (§2.4.2), lands rightmost.
- **Straight** and **Straight Flush:** the five cards in that combination's own ascending house-rule sequence (§2.4.1 of `requirements.md`: `A-2-3-4-5`, `2-3-4-5-6`, `3-4-5-6-7`, ..., `10-J-Q-K-A`, `J-Q-K-A-2`), not the hand's own Sort-by-Rank order (§6). The two orders differ only for the two special low Straights, where Sort-by-Rank's Ace/2-high convention would otherwise scatter the low cards to the end of the display (e.g. showing `3,4,5,A,2` instead of `A,2,3,4,5`). The sequence's own effective-highest card, which determines Straight/Straight Flush strength, lands rightmost.
- **Flush:** the five same-suit cards ordered by Rank low → high (`3 → ... → A → 2`, the same Rank order §6's Sort by Rank uses) — the highest card, which determines Flush strength (§2.4.2), lands rightmost.
- **Full House:** the Pair's two cards first (themselves ordered by Suit low → high), then the Triple's three cards (themselves ordered by Suit low → high) — `requirements.md` §2.4.3's own "Pair"/"Triple" distinction, not submission order. A Full House is ranked by **the Triple's Rank only** (the Pair never affects comparison, §2.4.3), so the Triple — the actual power determiner — lands rightmost, not the Pair.
- **Four-of-a-Kind:** the kicker first, then the four matching cards (themselves ordered by Suit low → high — all four suits are necessarily present) — `requirements.md` §2.4.4's own "kicker"/"four matching cards" distinction. A Four-of-a-Kind is ranked by **the rank of the four matching cards only** (the kicker never affects comparison, §2.4.4), so the quad — the actual power determiner — lands rightmost, not the kicker.

This is a UI presentation choice layered on an already-Engine-validated `Combination`; it never changes what combination was recognized, its legality, or its comparison strength (M4-T12.5). (M4-T12.5 correction: an earlier version of this section had the Full House and Four-of-a-Kind orders backwards — Triple-then-Pair and quad-then-kicker — which put the non-power-determining part rightmost, breaking the same "power determiner lands rightmost" convention every other combination type above already follows. The orders above are the corrected ones.)

Card face detail (corner index vs. center pip) is defined in §5.6.

## 5.2 Bottom human area

The bottom area is three aligned horizontal containers, sharing one row:

- **left container:** the Event Log button, the **Check Discard Pile** button (§9.1), and Leave Game, stacked vertically against the row's left edge, all the same fixed size regardless of their own label length (M4-T14: the frozen minimum touch-target height, §14, with the longest label wrapping onto two lines). Leave Game is red, as the one destructive action; its label carries the meaning without the color (§15);
- **middle container:** human cards on top, Sort by Rank / Sort by Suit side by side and centered beneath them. Its own width is reserved for the maximum possible 13-card hand and held constant as cards are played away during a Round — a smaller hand simply stays centered within that reserved width rather than narrowing it. Height still sizes to its own content (the cards plus the Sort buttons), so the card size (and headroom for a selected/raised card) always takes priority;
- **right container:** Play stacked above Pass against the row's right edge, large primary controls. Each shows its own recognized-combination/invalid-reason/"No valid plays" text as a smaller second line inside the button itself; the Play/Pass label itself reads as clearly primary (roughly three-quarters of its own text weight) against that smaller second line, and both buttons keep a fixed size regardless of whether the second line is present.

The three containers share one row and read as one coherent, evenly-aligned band; which container ends up tallest in practice does not change that. The left and right containers are equal in width, so the hand stays centered however wide the play area is (§14). The whole row, like the title row above the table, is inset from the play area's edges to where the table's rounded corners end and its straight edge begins (56 design px), so Event Log/Leave Game line up with the title and Play/Pass with the Round line rather than hugging the window edge; on a play area too narrow for that, the inset shrinks (to the table's own 8px margin) so the row still fits. This is a responsive relationship, not fixed pixel positioning.

Check Discard Pile, Event Log, and Leave Game open their own overlay or confirmation (§9.1, §9.2, §10). (M4-T14 update: an earlier version of this section described them as inert placeholders, which has not been true since those overlays shipped.)

## 5.3 Bot seat layout (West/East)

West and East bot hands stack lengthwise (vertically) along the seat's outer edge, with that player's details (name, remaining-card count, score, turn/PASS/DONE status) positioned toward the center table rather than the outer edge — the same details-near-center relationship North and South already have. Read left to right: **Lengthwise cards | West details | Center table | East details | Lengthwise cards.** This keeps a full 13-card overlapping hand contained within the table border rather than spilling past it, at every supported viewport (§14).

West and East render each face-down card **rotated 90° to match the seat's own vertical stacking axis**, at the same physical card size as North/South's cards (not shrunk to fit the rotation), rather than upright cards stacked sideways. The rotated footprint must not exceed the space a same-size card's rotation naturally produces, preserving the existing full-hand-stays-within-the-table-border guarantee at every supported viewport (§14).

**Follow-up (M4-T14):** North's bot-hand cards stay stacked directly above North's details and centered over them, as in every earlier version. West/East's outer columns are never narrower than their own content (the bot-hand column plus the fixed-width panel), so the seat contents can never spill past the table border; beyond that minimum the three table columns share the width 1:2:1 with each seat centered in its own column. These are consequences of authoring the play area in design units with a minimum design size and scaling it as a unit (§14), not separate per-viewport rules. The bot-hand overlap is tighter than before (12px rather than 20px in design units) so a 13-card fan still fits that column.

**Title row (M4-T14):** "Pusoy Dos" and the Basic/Round line sit in their own row above the table (title left, Round right), never over it.

**Card-to-panel gap (M4-T14):** every bot's cards sit the same small distance (4px in design units) from its own panel: North's cards above it, West's and East's beside theirs.

## 5.4 Per-seat Play/Pass trail

In addition to the center table's current hand to beat (§5.1), each seat shows **its own most recent Play for the active response cycle**, inside that seat's own panel (alongside its name/count/score/status):

- When a seat successfully Plays, that combination renders as a compact rank+suit corner badge per card (not a shrunk full card face, which reads illegibly at that size) inside the seat's own panel. The badge row is sized to fit a full 5-card combination on one line (§5.7) rather than wrapping — a wrap would put the row's own last card on its own second line, which read poorly for a 5-card Straight/Flush/Full House/Four-of-a-Kind/Straight Flush (person's own follow-up report). It follows the same canonical card-order rule as the center table's own hand to beat (§5.1), for every combination type.
- That seat's own last Play is shown at full visibility while it is still the hand to beat, and **dimmed ("grayed out")** once a later Play beats it — it is not removed, so the player can see what was beaten and by how much.
- A seat that Passes shows an explicit **PASS** at its own position (already specified in §8) **instead of** any earlier Play indicator from that same seat this cycle — a seat's own Pass replaces its own prior Play badge rather than showing both together, even if that Play had not yet been beaten.
- While a seat's own "deciding" indicator (§8) is showing, its Play trail is hidden — it is about to be replaced by that seat's next decision anyway.
- All per-seat Play/Pass indicators are cleared together the moment the response cycle resets to a **FREE LEAD** (Trick reset) — matching the same reset boundary that already clears PASS in §8.
- **Exception:** a seat that has itself finished (1st-3rd) keeps its own final Play showing for the rest of the Round, through every later mid-Round reset, rather than being cleared the instant the very next Trick concludes — a finished seat never takes another Turn this Round, so there is nothing to clear it *to*. This includes but is not limited to the Round's own completion (the 3rd-place finisher's final Play). **Follow-up correction (post-M4-T12.5):** this was originally implemented only for the Round-ending finish; an earlier (1st/2nd place) finisher's own final Play was still being wiped by the next mid-Round reset, reading as if it never happened — reported as inconsistent between seats. Every finisher's own last Play now persists the same way, whether or not their finish also ends the Round. It clears normally on the next genuine mid-Round reset for every *other* (still-active) seat, and always clears every seat going into the next Round.

This is presentation only: it derives from the same authoritative public Play/Pass/Trick-reset events already used for the center table and Event Log (§9.2), and does not change what information is public or when.

**Follow-up correction (post-M4-T12.5):** a seat's own Pass is meant to permanently replace its own prior Play badge for the rest of that response cycle (the bullet above), but a gap let it reappear: when a later Play by anyone else makes every previously-Passed player newly eligible to respond again (the Engine's own house rule — Passing does not remove a player from the current Trick, and a fresh higher bid gives every earlier Passer another chance to beat it), that same reset was also, incidentally, un-marking this seat's own already-cleared Pass in the presentation layer — letting its stale pre-Pass Play badge reappear at its seat as if it had just Played again, reported as "I passed, but my previous play was still present" (and, inconsistently across seats, as some Play badges reading correctly grayed-out/beaten while a reappeared stale one did not). A seat's own Pass now stays cleared through this reset too, reappearing only once that same seat actually takes its own next Turn (a fresh Play, or another Pass).

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

The table's own bordered box does not change size as a Round is played, and neither does any individual seat's own panel — each reserves its own worst case (a full 13-card hand for the bot-hand stack, a single-row 5-card trail for the panel, a full hand-to-beat display for the center) and holds it constant through the Round, rather than growing or shrinking as that seat's hand empties or its status/trail come and go. Only an actual viewport resize changes these sizes.

Within a panel, content is vertically centered as a block, and the status badge and Play trail each occupy an always-reserved slot (empty when there is nothing to show) rather than being removed outright — so an idle seat with no badge, or a seat with no trail to show, doesn't shift its name/count position or leave a lopsided gap.

**Follow-up corrections (post-M4-T12.5):** two further gaps in this same worst-case-reservation contract, both reported by the person: (1) a panel's own *width* was only a minimum, not held constant the same way its height already was — the longer "DONE · 1st"/"2nd"/"3rd"/"4th" status text widened the panel relative to "Turn"/"PASS"/plain "DONE", reading as the panel changing size. Width is now fixed the same way height already was. (2) West/East's own rotated bot-hand column reserved height for the empty case but not width, and North/South's reserved width but not height — at 0 cards, the empty axis collapsed to 0 and visibly shifted the panel (observed at East). Both axes are now floored to one card's own footprint regardless of card count.

**Further follow-up correction (post-M4-T12.5):** the fixed panel width set by (1) above was itself too narrow for two of the panel's own worst-case contents it was meant to cover: a full 5-card Play trail (§5.4) wrapped its last card onto its own second row instead of one line, and the widest status text ("DONE · 2nd" and every other placement, all the same length) line-wrapped and visibly overlapped the row below it — both reported by the person ("Make sure the seat width can fit the 5 hands"; "'Done . 2nd' doesn't fit in one line and blocks text"). The panel's fixed width is now sized to fit both without wrapping, and the status badge itself never line-wraps regardless of available width.

**Follow-up (M4-T14):** the panel's own fixed height is now 122px (previously 152px) with a 34px trail slot, and Play/Pass are fixed at 150×72px (previously 140×96px), all in the play area's own design units (§14). Everything is still reserved at its own worst case and held constant through a Round; only its absolute size changed, to fit the whole play area on one screen without scrolling. The trail's card badges and every other piece of text are at least 14px in those units, so they meet the frozen text minimum wherever the play area renders at scale 1 or larger.

# 6. Human Hand, Selection, Sorting, and Manual Arrangement

Human cards remain on one horizontal baseline. When space is constrained, cards overlap horizontally while enough of each card remains exposed for reliable click/tap and drag targeting.

Tap/click toggles selection. Selected cards visibly rise to a higher horizontal level while preserving their position in hand order. Clicking empty table space does not clear selection.

Phase 1 supports bounded manual rearrangement by mouse/touch drag within the hand region. Cards cannot be dragged indefinitely around the table. Reordering changes only display order; it does **not** select/deselect cards. A selected card remains selected when moved, and moving neighboring cards does not change selection.

**Sort by Rank** and **Sort by Suit** are always visible and usable even when the hand already matches that order. Sorting preserves current selection and simply reapplies canonical display order; no separate Custom sort state is needed.

- Sort by Rank: Rank 3 → ... → A → 2; ties Clubs → Spades → Hearts → Diamonds.
- Sort by Suit: Clubs → Spades → Hearts → Diamonds; within suit Rank 3 → ... → A → 2.

**Follow-up (person's own follow-up report):** the row holding the cards themselves reserved only a `min-height` approximation, not an exact one — at wider viewports a real card's own rendered height exceeded that approximation, so an emptied hand (nothing left to establish the row's own content height) fell back to the shorter approximate floor, visibly shifting **Sort Rank**/**Sort Suit** (stacked directly beneath, in the same reserved-width column, §5.2) out of their earlier position. That row's height is now a fixed expression derived only from the viewport — the same card-width formula the cards themselves already use, at their own fixed aspect ratio — so it, and everything anchored beneath it, holds one constant position regardless of how many cards (including zero) are actually held.

**Follow-up (M4-T14):** the card width that the hand row's own height and overlap derive from is now the play area's one shared design-unit card width (60px), scaled with the whole play area (§14) rather than a separate viewport-relative clamp. The row's height is still a fixed expression independent of how many cards are held, and the exposed part of every card is still at least 70% of its width, widened when the play area is scaled down so that at least 28px of every card stays visible on screen. A card on the center table is the same size as a card in the hand. **Sort by Rank** and **Sort by Suit** are at least the minimum touch-target height. Dragging compensates for the play area's scale, so a dragged card tracks the pointer 1:1 at every size.

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

**Follow-up (M4-T13 UI refinement):** the human player's own restrained highlight (§13's own follow-up) colors only their own name within an entry's text, not the whole entry. A Round-start boundary marker ("Round 1 started.") gets its own more prominent, centered treatment distinct from an ordinary Play/Pass/finish entry, so it reads clearly as a Round divider rather than another event in the list. The list's own scrollbar keeps a small, deliberate gap from its content (both a reserved gutter and real padding) rather than sitting flush against it. While this overlay (or any full-viewport modal — Round Result, Session Summary) is open, the page behind it cannot itself be scrolled by a wheel/trackpad gesture that starts outside the modal's own scrollable content.

# 10. Leave Game

Leave Game is a secondary left-side action. During an unfinished Session it opens an application confirmation overlay explaining that progress is not saved, with **Yes/Leave Game** and **Return/Stay** actions. The confirmation pauses progression. Browser refresh/tab/window close uses supported unload warnings where available; browser wording is not guaranteed.

**Follow-up (M4-T13 UI refinement):** the browser unload warning stops once the Session's own official result exists (Round 5's own checkpoint, §12/§13) — from that point on (including while still watching Round 5's own settled Result overlay auto-advance into Session Summary, §12) there is no further unsaved progress left to lose, so closing the tab needs no confirmation (the person's own follow-up request: "you can remove the prompt for asking if the tab can be exited through closing the tab" at Session Summary).

# 11. End-of-Round Reveal

When the 3rd-place player finishes, the Engine has completed the Basic Round and the 4th-place player is known. Normal interaction stops. Before the result overlay appears, reveal the 4th-place player's remaining cards in that player's normal table position, sorted by Rank. This information is exposed only after Round completion; active-play hidden-information boundaries remain intact.

Show the reveal for roughly **1.5–2 seconds**. A click/tap may finish the reveal immediately. The same input must not accidentally activate the next result action.

**Follow-up correction (post-M4-T12):** once shown, the 4th-place player's revealed hand stays visible at that seat (dimmed behind the Result overlay, same as the rest of the table) for as long as that Round's own Result overlay is showing - it must not flip back to face-down the instant that overlay opens, which read as if the reveal never happened at all. It only clears once the Round-start transition to the next Round actually begins.

# 12. Round Result Overlay

Round Result is a modal/overlay over the dimmed completed table, not a separate page. It is not dismissible by outside click/Escape; progression occurs through its explicit action.

The scoring presentation sequence is:

1. rows appear arranged by standings **before** the just-completed Round score;
2. Round points (+5/+3/+2/+0) appear;
3. Total values update;
4. rows smoothly rearrange by the new cumulative total;
5. the heading/column presentation settles on **Total** rather than permanently retaining a Previous Total column.

The animation is short and skippable by click/tap; skipping completes the visual state but must not trigger Next Round (or, for Round 5, the automatic Session Summary transition below). Ties during an unfinished Session retain stable previous relative order rather than inventing a final ranking.

Rounds 1–4 show **Next Round**, requiring an explicit click. Round 5 shows no continuation button at all: once the scoring animation settles, the overlay automatically replaces itself in place with the Session Summary (§13) after a short additional presentational delay, matching the same brief/skippable-animation convention used elsewhere (§8, §11) rather than a longer ceremony (Follow-up, M4-T13 UI refinement — replaces the earlier explicit **View Session Results** button; a click/tap on the settled overlay before that delay elapses is harmless and has no effect, since the animation is already at its settled state).

## 12.1 Round-Start Transition Screen

Between clicking **Next Round** and the next Round's own opening Turn becoming interactive, a brief transition screen dims the table and shows the destination Round number (e.g. **Round 3**), then lights the table back up once that Round is actually live.

**Follow-up correction (post-M4-T12.5):** the next Round's own dealing/start used to be deferred until this transition ended, on the theory that dealing early would let the new Round flash into view underneath the transition screen. In practice this left the *previous* Round's own leftover cards (whatever remained in each hand when it ended) sitting dimmed underneath for the whole transition, which then visibly swapped for the freshly dealt Round the instant the screen cleared — reported as the cards "flipping" and getting replaced. The next Round is now dealt immediately when **Next Round** is clicked, before this screen even opens; the dimmed table already shows the fresh Round throughout the transition, so lighting it back up only ever brightens it rather than replacing anything.

The same dim/label/lit treatment also covers Round 1's own very first start, immediately after Start Game, so every Round — including the first — gets the identical transition rather than only Rounds 2 and later. Round 1 is already dealt and live the moment the table first renders, so there is nothing to defer there; the transition instead pauses ordinary Turn advancement for its own short duration (the same reference-counted pause any open overlay already uses, §9.2), purely so the same visual sequence applies uniformly across every Round.

The transition is short, matching the same brief/skippable presentational-delay convention used elsewhere (§8's bot pacing, §11's reveal) rather than a longer ceremony. A click/tap skip only ends the transition itself; it never also advances into further gameplay on its own — the same "skipping must not accidentally activate the next action" rule §11 and §12 already state.

This is presentation only, layered on the same authoritative Round-boundary state already described above; it introduces no new Engine/Orchestrator state.

# 13. Session Summary

After Round 5, Session Summary shows the official final ranking ordered by final Session result, final scores, all five Round results (labeled **Round-by-Round Summary**, with plain point values — no +/- prefix, since Basic Mode has no loser deductions to distinguish from a gain), and tiebreak explanation when relevant. Apply the official Basic tiebreak rules here.

Give 1st/2nd/3rd restrained gold/silver/bronze background/border treatment while retaining explicit placement text so meaning is not color-only. Provide **Play Again** and **Home**.

**Follow-up (M4-T13 UI refinement):** Session Summary presents as a popup/overlay over the same dimmed completed table Round Result used (§12), replacing the Round Result overlay in place rather than opening as a separate full screen, and is reached automatically once Round 5's own scoring animation settles (§12) — no explicit action is required. Both the Final Ranking and Round-by-Round Summary tables center their own cell text/numbers, and each fits within the panel without its own inner scrollbar. The human player's own seat gets a restrained visual highlight wherever their name appears — here, in the Round Result overlay (§12), and in the Event Log (§9.2) — distinct from the gold/silver/bronze medal colors; the existing "You" name text already carries the identity, so this is purely an additional glance-able cue, consistent with §15's label-plus-color rule. In a table row this colors only the name cell's own text, not the row's background (a background tint visibly fought with a medal-colored row it shared, e.g. a tied 1st-place human row); in the Event Log it colors only the actor's own name within an entry's text, not the whole entry. Session Summary provides its own **Event Log** button, ordered **Event Log**, **Home**, **Play Again** (left to right), that opens the same dismissible Event Log overlay (§9.2, including its card-icon badges, and this overlay's own follow-up note on the human's own name-only highlight/Round-marker emphasis) over Session Summary, showing the whole Session's own chronological history — not an always-visible embedded panel of its own.

**Follow-up (M4-T14):** at viewport heights of 660px or less, Final Ranking and Round-by-Round Summary sit side by side instead of stacked, so the whole Summary (including **Play Again**/**Home**) fits without an inner scrollbar or clipping at the shortest supported landscape viewports; taller viewports keep the stacked layout. All text in the overlay is at least 14px and its actions at least 44px tall. Each table is one solid rounded card (its outline, background and clipping belong to the card, so the caption and medal rows never show square corners past the rounded edge), and each action button's label is centered in the button.

# 14. Responsive and Orientation Contract

Gameplay is landscape-first and must support large desktop, normal laptop, smaller/windowed desktop, tablet landscape, and phone landscape down to the frozen minimum supported viewport (**844×390**; raised from 667×375 in M4-T14). Portrait is unsupported gameplay orientation: pause/prevent interaction and show **Rotate your device to continue** — but only on a touch/coarse-pointer device that can actually be physically rotated (a phone or tablet); a portrait-shaped window on a mouse/trackpad (fine-pointer) desktop or laptop cannot be rotated, so it instead gets the same resize/unsupported guidance as too-small landscape (M4-T11 follow-up). Returning to landscape, or to a supported size, restores coherent state. Too-small landscape shows resize/unsupported guidance rather than an unreadable table.

Use a bounded ratio-controlled play area rather than assuming fullscreen or exact 16:9. Cards preserve a constant aspect ratio. Text uses bounded readable sizing and critical controls retain usable click/touch targets. Secondary UI compresses/reflows before core gameplay becomes unusable.

The play area (table plus the bottom action bar) scales as a single proportional unit rather than each element resizing independently, so relative proportions — table, seats, cards, controls — stay visually consistent from large screens down to small ones, and the whole area fits within the viewport height without requiring a scrollbar at any supported size. When a real device's available height is unusually short relative to its width (a real mobile browser's own address bar/chrome can leave noticeably less usable height than device-emulated estimates assume), height is the binding constraint: the scale is derived from available height first, and width follows from that scale, producing a narrower but fully height-fit table rather than one that fills available width and overflows vertically. **As implemented (M4-T14):** every card, panel, control, and gap in the play area (the table plus the bottom bar) is sized in design units, and the play area itself is fluid: it is never laid out smaller than 896×656 design units, and otherwise fills the viewport. The one uniform scale factor is 1 for any viewport from that size up to 1440×900, so a desktop or laptop window shows everything at natural size with the extra room spread between the seats instead of zoomed in. Below 896×656 in either dimension the whole area is scaled down to fit, `min(viewport width / 896, viewport height / 656)`; above 1440×900 it is scaled up to keep the laid-out area at that size, capped at 2× (bounded typography). Full-viewport overlays (Discard Pile, Event Log, Leave, Round Result, Session Summary, the Round-start screen) are rendered outside the scaled area, at real pixel sizes.

**Two sizing tiers (M4-T14 decision):** the frozen minimum text size (14px) and touch-target size (44×44px) hold literally, on rendered sizes, wherever the scale is 1 or larger — viewports of at least 896×656 (`FULL_SCALE_LANDSCAPE_*`, `layoutThresholds.ts`). From there down to the minimum supported viewport (844×390) the play area is scaled down to fit (the *phone tier*, scale about 0.59–0.94), so those two constants are exempt there. The exposed-card width (28px) applies at every supported size: in the phone tier the hand's card overlap loosens as the scale drops so that at least 28px of each card stays visible on screen. Landscape phones are supported at the minimum size and above; smaller phones, and windows below the minimum, get the resize guidance.

Human cards remain on the same baseline; constrained layouts increase horizontal overlap rather than vertically staggering unselected cards. Selected cards alone rise.

Exact representative CSS viewport dimensions and minimum supported dimensions are frozen during M4 implementation task T04 and reused for automated/manual QA. (M4-T14 raised the minimum from 667×375 to 844×390; the README's matrix table and `tests/browser/viewportMatrix.ts` carry the current values.)

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

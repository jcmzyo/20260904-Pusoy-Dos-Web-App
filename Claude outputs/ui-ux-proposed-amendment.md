# Proposed `ui-ux.md` amendment (v1.3 → v1.4)

Per "Documentation and Decisions: Propose changes to Markdown documents for user approval before editing," this amendment is **not yet applied** to the canonical `ui-ux.md` in the project. It consolidates every design decision already implemented in code across this whole round of follow-up polish on M4-T06/T07/T08.

**Versioning note (per your instruction):** earlier drafts of this file numbered themselves up once per follow-up round (v1.4, v1.5, v1.6...) purely for my own tracking while drafting. Since all of that is one continuous review cycle, the actual write to the canonical doc will be a single step from **v1.3 to v1.4** — not v1.6/v1.7 — so the version number doesn't run far ahead of where we started. This file now reflects that: it's the one, final v1.4 amendment, superseding every earlier numbered draft I sent you.

Item 5 from the "make it fit the screen without scrolling" round (full cross-viewport, resize-adaptive hardening) is **not** included here — that's a separate scope question, not yet resolved, and not part of this amendment.

Please review whenever you're ready, and say "approved" (or ask for changes) and I will write this into the project doc as v1.4.

Sections affected: §5.2, §5.3, §5.4, §5.5 (new), §5.6 (new), §5.7 (new), §7, §8.

---

## §5.2 Bottom human area — replace existing bullet list with:

> The bottom area is three aligned horizontal containers, sharing one row:
>
> - **left container:** the Event Log button and Leave Game, stacked vertically and centered within the container, both the same fixed length regardless of their own label length;
> - **middle container:** human cards on top, Sort by Rank / Sort by Suit side by side and centered beneath them. Its own width is reserved for the maximum possible 13-card hand and held constant as cards are played away during a Round — a smaller hand simply stays centered within that reserved width rather than narrowing it. Height still sizes to its own content (the cards plus the Sort buttons), so the card size (and headroom for a selected/raised card) always takes priority;
> - **right container:** Play stacked above Pass, large primary controls. Each shows its own recognized-combination/invalid-reason/"No valid plays" text as a smaller second line inside the button itself; the Play/Pass label itself reads as clearly primary (roughly three-quarters of its own text weight) against that smaller second line, and both buttons keep a fixed size regardless of whether the second line is present.
>
> The three containers share one row and read as one coherent, evenly-aligned band; which container ends up tallest in practice does not change that. This is a responsive relationship, not fixed pixel positioning.
>
> The Event Log and Leave Game buttons render now as inert placeholders — pressing them currently does nothing — the same way the center table's own Discard Pile button (§5.1) has since its own introduction. Their actual overlay/confirmation behavior is separate, later work (§9.2, §10).

**Why:** Play/Pass enlarged and given inline feedback text; Sort centered, then genuinely centered under North/South; Play/Pass switched from side-by-side to stacked and finally arranged into three explicit horizontal containers; Event Log/Leave Game actually placed as (inert) buttons, equal length; the middle container's own width fixed against a shrinking hand.

## §5.3 Bot seat layout (West/East) — append:

> West and East render each face-down card **rotated 90° to match the seat's own vertical stacking axis**, at the same physical card size as North/South's cards (not shrunk to fit the rotation), rather than upright cards stacked sideways. The rotated footprint must not exceed the space a same-size card's rotation naturally produces, preserving the existing full-hand-stays-within-the-table-border guarantee at every supported viewport (§14).

**Why:** "nobody plays cards this way" (added the rotation); the rotated cards had shrunk to fit safely within the old reserved space, making them visibly smaller than North/South's — now sized to match, with the reserved space recalculated instead of the cards shrunk.

## §5.4 Per-seat Play/Pass trail (new section)

> In addition to the center table's current hand to beat (§5.1), each seat shows **its own most recent Play for the active response cycle**, inside that seat's own panel (alongside its name/count/score/status):
>
> - When a seat successfully Plays, that combination renders as a compact rank+suit corner badge per card (not a shrunk full card face, which reads illegibly at that size) inside the seat's own panel. The badge row wraps and stays within the panel's own width so it never grows out into the center table's own space.
> - That seat's own last Play is shown at full visibility while it is still the hand to beat, and **dimmed ("grayed out")** once a later Play beats it — it is not removed, so the player can see what was beaten and by how much.
> - A seat that Passes shows an explicit **PASS** at its own position (already specified in §8) **instead of** any earlier Play indicator from that same seat this cycle — a seat's own Pass replaces its own prior Play badge rather than showing both together, even if that Play had not yet been beaten.
> - While a seat's own "deciding" indicator (§8) is showing, its Play trail is hidden — it is about to be replaced by that seat's next decision anyway.
> - All per-seat Play/Pass indicators are cleared together the moment the response cycle resets to a **FREE LEAD** (Trick reset) — matching the same reset boundary that already clears PASS in §8.
> - **Exception:** if that same Trick reset is also the Round's own completion (the 3rd-place finisher's final Play), every seat's trail is left showing as-is rather than cleared, so the Play that ended the Round doesn't disappear before the person ever sees it. It clears normally on the next genuine mid-Round reset, and always clears going into the next Round.
>
> This is presentation only: it derives from the same authoritative public Play/Pass/Trick-reset events already used for the center table and Event Log (§9.2), and does not change what information is public or when.

**Why:** introduced from an original West-plays-beaten-by-North example; the shrunk-card look was replaced with a compact corner badge, moved inside the panel; a seat's own Pass was made to override its own prior badge; hidden while a seat is "deciding"; and finally, not wiped by the same Trick-end that completes the Round.

## §5.5 In-table finish and turn glow (new section)

> Each seat's panel gets a glow, separate from its text status, so who has finished (and in what place) and whose Turn it is are each recognizable at a glance without reading text:
>
> - **1st place finish:** gold glow.
> - **2nd place finish:** silver glow.
> - **3rd place finish:** bronze glow.
> - **Current Turn:** white glow — deliberately distinct from the gold "finished 1st" glow so the two are never confused.
> - A 4th-place finish (or any not-yet-placed finish) gets no special glow.
>
> This is an additional glance-able cue; the existing text status (Turn/PASS/DONE + ordinal, §5 intro) still carries the same meaning without color, per §15's label-plus-color rule. This extends the medal-color convention already used for the Session Summary (§13) to the live table itself.

**Why:** "it's pretty hard to see who is done at the table."

## §5.6 Card face detail: corner index vs. center pip (new section)

> Every face-up card always shows the two corner rank/suit indices. Whether it additionally shows a large center suit pip depends on context:
>
> - **The player's own held hand** (§6): corners **and** a center pip — held cards have room to spare, and read as visually incomplete without it.
> - **The center table's current hand to beat** (§5.1) and **each seat's own per-seat Play/Pass trail** (§5.4): corners only, no center pip — these render more cards in less space, where a large center pip visually collided with the corner indices and made them harder to read at a glance.

**Why:** the center pip was removed everywhere to fix a corner/pip collision in the center hand-to-beat; the player's own larger, less-crowded held cards then looked "barren" without it, so the pip returns there specifically while the smaller/denser contexts keep the fix.

## §5.7 Table and panel dimension stability (new section)

> The table's own bordered box does not change size as a Round is played, and neither does any individual seat's own panel — each reserves its own worst case (a full 13-card hand for the bot-hand stack, a wrapped 5-card trail for the panel, a full hand-to-beat display for the center) and holds it constant through the Round, rather than growing or shrinking as that seat's hand empties or its status/trail come and go. Only an actual viewport resize changes these sizes.
>
> Within a panel, content is vertically centered as a block, and the status badge and Play trail each occupy an always-reserved slot (empty when there is nothing to show) rather than being removed outright — so an idle seat with no badge, or a seat with no trail to show, doesn't shift its name/count position or leave a lopsided gap.

**Why:** "the main table border also changes size and it is kinda trippy"; once the panel's own height was fixed to its worst case, a mostly-idle seat looked "too tall" with all its empty space dumped at the bottom — centering the content, and reserving (rather than removing) the optional rows, fixed that without reopening the resize problem.

## §7 Play, Pass, and Validation Feedback — append three sentences:

> Play defaults to a neutral gray/white appearance and turns green, with a glowing yellow highlight, only once the current selection is a valid, legal Play; it is otherwise visually indistinguishable from any other disabled control. Pass keeps its own always-blue appearance and is separately highlighted (the same glowing-yellow treatment) only when responding with no legal Play available. Both the recognized combination name and any invalid/"No valid plays" reason render as a smaller second line inside the button itself, and remain available to assistive technology via the button's accessible description even though the button's own accessible name stays the fixed "Play"/"Pass"; the "Play"/"Pass" label itself is the visually dominant text in the button (roughly three-quarters of its own text weight), with that second line clearly secondary; Play and Pass keep a fixed size whether or not the second line is present — color alone never carries the state, per §15's label-plus-color rule.

**Why:** highlight colors introduced; feedback text moved inside the button; Play/Pass fixed so they stop changing size as that text (and the valid-Play glow) appear or disappear; the "Play"/"Pass" label made clearly dominant over that second line.

## §8 Bot Turns and Pacing — replace the pacing sentence and append one more:

> Actual Baseline computation is separate from presentation delay. Use a short readable presentation delay as a tunable UI value; the current default is **0.8 seconds** per bot action (tuned from an initial 0.6–1.0 second range: first raised to 1.5s, then brought back down to 0.8s once the person could compare both in practice). Do not make exact millisecond timing a human acceptance requirement.
>
> While a bot's presentation delay is in progress, that bot's panel shows a small non-blocking "deciding" indicator so the player can see whose Turn is being processed; it is purely presentational and never reflects real computation time.

**Why:** the "deciding" indicator was added; the delay was raised to 1.5s, found too slow, and brought back down to 0.8s — within the originally-documented range, so no further range change is needed.

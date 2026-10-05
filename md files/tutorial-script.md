# Pusoy Dos --- Five-Round Tutorial Script

## Authored Learning Script (v0.1)

**Status:** Concrete content draft; reference deals and guided action traces checked against the production Engine. Tutorial runtime/UI and human comprehension are not yet verified.  
**Last Modified:** September 29, 2026  
**Product authority:** [requirements.md](requirements.md) §2 and §3.6  
**Execution contract:** [tutorial.md](tutorial.md)  
**Implementation owner:** [M7 task breakdown](m7-tutorial-rules-task-breakdown.md), using the M6 framework and M5 presentation foundation

# 1. Experience and Learning Goal

**Main menu → Play → Tutorial → one complete five-Round Basic Session → real Session Summary.** The cards are arranged to create useful teaching moments. The learner plays real Moves, bots respond through production authority, and official scores accumulate across all five Rounds. No disconnected mini-games, fabricated results, or mid-Round replacement hands.

Opening message:

> “Welcome! We’ll play five Rounds together. Your goal is to empty your hand. I’ll guide the first few plays, then give you more freedom. These cards are arranged for learning, but the rules are the same as Basic Game. You don’t need to win to complete the tutorial.”

Round introductions identify their lesson and show **Round n of 5**. The learner is South; West, North, and East below identify seats, not fixed player-facing names. Use the actual bot names on screen. Hands/deals in the author appendix are private implementation material, never an invitation to reveal live opponent hands.

| Round | What the player learns | Guidance |
|---|---|---|
| 1 — Your first plays | Selection, playing, ranks/suits, Singles/Pairs/Triples, required and optional Pass, Free Lead, history tools | Explicit early card targets, then several valid choices |
| 2 — Five cards change the contest | Straight, Flush, five-card hierarchy, stronger rank/category, inspecting public history | Guided five-card sets and contextual explanations |
| 3 — Big combinations | Full House, Four-of-a-Kind plus kicker, stronger triple/quad rank, preserving useful groups | Goal-based selection; any valid kicker |
| 4 — Someone finishes: keep playing | Straight Flush, responding to a finisher, both continuation branches, practical use of 2♦ | Short setup prompts, then learner chooses response |
| 5 — Play your own Round | Put the rules together, choose strategy, consult tools/reference, understand Session result | No required card highlights or strategy restrictions |

# 2. Exploration, Feedback, and Bot Script Rules

## 2.1 Let the learner explore without losing the lesson

- At every human Turn, allow inspection, selection/deselection, sorting, and bounded rearrangement. Rearranging/sorting never changes which physical cards are selected. The learner may inspect Event Log, Discard Pile, or How to Play whenever their entry controls are available.
- Before a constrained instructional Play, allow the learner to examine other selections and Engine-derived combination/legality feedback. If another legal Move is outside the current lesson, explain **“That is legal, but for this step we’re practising …”** before submission. Never call it illegal or accept then undo it. Only the clearly identified guided beats constrain submission.
- An illegal selection shows the existing Engine-derived reason; where Play is disabled, the learner does not need to press a disabled button to receive feedback. The learner may change the selection and retry. No card, Turn, score, or lesson progress is consumed by inspection/rejection.
- Open practice follows each guided prefix. From that point all Engine-valid Plays and Passes are accepted. The script must not demand an optimal move, a particular finishing place, or that the human win.
- All learner alternatives explicitly listed below are supported routes, not just examples of a single accepted answer. Card-array/display order is irrelevant. A lawful alternative in an open-practice section is never rejected for leaving the sample trace.
- Guidance pauses progression where required so explanations and tool demonstrations can be read. Opening a history/reference overlay pauses play; closing it cannot release another active teaching gate.

## 2.2 Bot behavior and continuity

The exact guided action traces in Appendix B establish the lesson situations using legal Plays and genuine explicit Passes. A scripted Pass may deliberately decline a legal response; this is legal and is disclosed as a teaching choice. Do not claim a bot “cannot beat it” without Engine evidence.

At each Round’s named **open-practice handoff**, scripted bots explicitly switch to the existing deterministic Baseline decision policy on their subsequent requests for that Round. This is an authored phase transition, not a fallback when a script fails. Round 5 uses that policy throughout. Keep the same authoritative Session/Round and safe controller request path; no normal-game strategy change or new AI level. M6-T01 must review the minimal tutorial-owned integration, including request cancellation and stale callbacks. An illegal/unavailable scripted action is still a diagnosed scenario defect, never silently replaced by Baseline.

The remainder of each Round is genuinely played to completion. Its length, winner, and points can vary with learner choices. Deal the next listed full deck only after the current Round ends and the learner selects Next Round. No reseeding/resetting the active Round to force the next lesson. Round 5 transitions to the real Session Summary using the existing result flow.

## 2.3 Reusable feedback copy

| Situation | Player-facing response |
|---|---|
| First selected card | “A raised card is selected. Tap it again to put it back.” |
| Wrong response count | “Match the number of cards on the table: one, two, three, or five. A bigger pile of cards does not automatically win.” |
| Weaker legal combination shape | “That is a valid combination, but it does not beat the current play. Check its rank, suit, or five-card category.” Use the Engine’s specific reason where available. |
| Trying to Pass on opening/Free Lead | “You are leading this Trick. Choose a valid Play; you cannot Pass when there is no play to answer.” |
| Correct guided action | Briefly explain the successful rule, then continue; avoid a congratulation popup after every routine action. |
| A strategic choice | “That is a legal choice.” Explain tradeoffs if requested; do not grade strategy as right/wrong. |
| Guidance lookup | “Need a reminder? How to Play explains the rules; Event Log and Discard Pile show what happened here.” |

# 3. Round 1 — Your First Plays

**Human opening hand:** 3♣ 6♣ 6♦ 7♣ 7♠ 8♣ 8♠ 8♥ J♣ Q♠ K♦ A♣ 2♦. Full private deal: Appendix A.

| Beat | Spoken/written instruction | Learner action and authoritative checkpoint |
|---|---|---|
| R1.1 Find your hand | “These are your 13 cards. The other players also have 13. Empty your hand to finish; the first three finishers earn places.” Identify current Turn, opponents’ counts, and center play area. | Tap a card, deselect it, then select 3♣. Let the learner try Sort Rank and Sort Suit and move a selected card within the hand. Selection remains unchanged by sorting/rearranging. These UI actions do not submit Moves. |
| R1.2 Open the Round | “You have 3♣, so you start. The first Play must contain it. Let’s begin with one card: select 3♣ and press Play.” | Require 3♣ as a Single for this introductory beat. Explain that opening with a Pair, Triple, or valid five-card combination containing 3♣ is also allowed in general. Advance on accepted Play, not selection. |
| R1.3 Watch rank and suit | West plays 5♣, North 5♠, East 5♥. “A higher rank beats a lower one. For the same rank, suits rise Clubs, Spades, Hearts, Diamonds.” | Pause briefly on the public changes. Ask for 6♣: “Beat the 5 with a higher rank.” Accept that guided Single. Explain that even the lowest suit of a higher rank wins. |
| R1.4 Beat the same rank | West plays 6♠; North and East explicitly Pass. “Both are sixes. Your 6♦ wins because Diamonds is higher than Spades.” | Select/play 6♦. Allow other selections for exploration, but clearly identify this beat as same-rank suit practice. All three bots then Pass, giving South Free Lead. |
| R1.5 Inspect what happened | “Open Event Log. Find your 6♦ Play and the Passes after it. Close it, then open Discard Pile and find the cards already played.” | Open/inspect/close both tools; point to actual public entries/cards, never private hands. Explain that Pass adds no card to the Discard Pile, the pile is organized for lookup, and the log preserves event order. Resume the still-pending Free Lead only after dialogs and guidance close. |
| R1.6 Lead a Pair | “Everyone else passed after your Play. That gives you Free Lead: choose the size of the next contest. Play the two sevens together.” | Accept 7♣ 7♠. Explain that two same-rank cards form a Pair; two unrelated cards do not. Bots Pass. |
| R1.7 Lead a Triple | “Now try three cards of the same rank.” | Accept 8♣ 8♠ 8♥ on Free Lead. West replies with 9♣ 9♠ 9♥; North and East Pass. Explain that Triple comparison uses rank, not suit. |
| R1.8 No legal Play | “You have no Triple left that can answer those nines. A Single—even 2♦—cannot beat a Triple. Press Pass.” | Assert Engine reports no legal Play, then accept the learner’s explicit Pass. Never auto-pass. West now has Free Lead. |
| R1.9 Passing is also a choice | West leads 2♣; North and East Pass. “You could beat this with 2♦. But you’re also allowed to Pass. For this step, practise saving it: press Pass.” | Assert 2♦ is an Engine-valid beating Single, then accept Pass as the taught action. Explain that passing does not remove the player and does not lock them out for the rest of the Round. |
| R1.10 Rejoin with a choice | West leads 4♣; North and East Pass. “You’re still in the game. Choose any Single you hold that beats this four.” | Accept any of J♣, Q♠, K♦, A♣, or 2♦. All five routes satisfy the lesson. Do not demand the cheapest card or punish spending 2♦. |

**Open-practice handoff:** after R1.10’s accepted Play. Bots now use the authored Baseline-policy phase. The learner may make any Engine-valid move; retain basic Turn/combination feedback. If the learner finishes before the Round ends, explain their DONE/place indicator and let the other active players finish normally.

**First Round Result:** “Basic scoring is 5 points for first, 3 for second, 2 for third, and 0 for fourth. Your points add up over five Rounds.” Highlight actual earned points and Total. Explain that the Round ends when third place is decided; fourth place may still have cards. Show only the production-authorized fourth-hand reveal. Let the player select Next Round.

# 4. Round 2 — Five Cards Change the Contest

**Human opening hand:** 3♣ 4♠ 5♥ 6♦ 7♣ 8♦ 9♦ J♦ Q♦ A♦ K♠ 2♠ 2♥.

| Beat | Instruction | Action/checkpoint |
|---|---|---|
| R2.1 Recognize a Straight | “Five consecutive ranks make a Straight. They do not need the same suit. This one includes 3♣, so it can open the Round.” | Select/play 3♣ 4♠ 5♥ 6♦ 7♣. Show Engine classification: Straight. |
| R2.2 A stronger Straight | West plays 4♣ 5♠ 6♥ 7♦ 8♣; North/East Pass. “An eight-high Straight beats a seven-high Straight. If the high rank ties, compare that high card’s suit.” | Observe the actual stronger Straight and its player attribution. Do not call all Straights suit-first. |
| R2.3 Change to a stronger category | “A Flush is five cards of one suit. Your Diamonds are not consecutive, so this is a Flush rather than a Straight Flush. Every Flush beats every Straight.” | Select/play 8♦ 9♦ J♦ Q♦ A♦. Encourage inspecting other five-card selections before committing the taught Flush. |
| R2.4 Follow the hierarchy | West plays 9♣ 9♠ 9♥ 4♥ 4♦ (Full House). North plays 10♣ 10♠ 10♥ 10♦ 3♦ (Four-of-a-Kind). East plays J♣ Q♣ K♣ A♣ 2♣ (Straight Flush). | After each accepted event, identify the category and explain why it beats the previous one. These are real successive five-card responses; do not show all as simultaneous hands to beat. |
| R2.5 Respond to the latest Play | “The current play is now the Straight Flush. You must beat that—not an earlier Straight. You only have three cards left, so Pass.” | Accept explicit human Pass, then West/North Pass. East gets Free Lead. The highest five-card category does not become a special move that can beat a Pair or Triple. |
| R2.6 Use history to review | “Check the Event Log to follow the five-card chain. In the Discard Pile, you can inspect the public cards, but it does not replace the log’s order.” | Let the learner open/close the actual tools and review the hierarchy. Show the concise hierarchy as a reminder: Straight < Flush < Full House < Four-of-a-Kind < Straight Flush. |

**Open-practice handoff:** after R2.5 and the optional R2.6 inspection gate. The learner still holds K♠ and a Pair of twos, so they can choose how to use their remaining cards; do not force a finishing plan.

**Optional explanation in How to Play, not another forced Round:** A-2-3-4-5 is the weakest Straight (5 high); 2-3-4-5-6 is next (6 high). J-Q-K-A-2 is legal and high; K-A-2-3-4 and Q-K-A-2-3 are invalid. These rank patterns describe rules, not extra cards dealt into this Round.

# 5. Round 3 — Big Combinations and Useful Choices

**Human opening hand:** 3♣ 3♠ 3♥ 6♣ 6♦ 8♣ 8♠ 8♥ 8♦ 5♣ J♠ Q♥ 2♦.

| Beat | Instruction | Action/checkpoint |
|---|---|---|
| R3.1 Full House | “A Triple plus a Pair makes a Full House. Play your three threes with your two sixes.” | Accept 3♣ 3♠ 3♥ 6♣ 6♦. The opening includes 3♣. Let the learner inspect the grouping before Play. |
| R3.2 Compare Full Houses | West answers 4♣ 4♠ 4♥ 7♣ 7♦; North/East Pass. “For Full Houses, compare the Triple. The Pair does not decide which Full House wins.” | Show the authoritative category/rank comparison, not a second UI scoring algorithm. |
| R3.3 Four-of-a-Kind needs five cards | “You have all four eights. Add any one other card as the fifth card—the kicker. Choose which spare card to use.” | Accept the four eights plus **any of 5♣, J♠, Q♥, or 2♦**. All four satisfy this objective. Selecting only the four eights shows why four cards alone are not a legal Play. |
| R3.4 The kicker does not determine strength | West Passes. North plays 9♣ 9♠ 9♥ 9♦ 4♦; East Passes. “Four nines beat four eights. A higher kicker would not have changed that.” | Human explicitly Passes, then West Passes; North gains Free Lead. Show no suggestion that spending 2♦ as kicker would strengthen the four eights. |

**Choice-sensitive tip after R3.3:** If the learner used 5♣, “Using a spare low card can keep a high Single for later.” If they used another kicker, “That was legal. The kicker changes what remains in your hand, not how strong the four eights are.” No penalty or forced retry for a legal strategic choice.

**Open-practice handoff:** after R3.4. Encourage the learner to inspect remaining cards, sort or rearrange if helpful, and choose legal plays. Explain only on request or when genuinely new factual state needs identification.

# 6. Round 4 — Someone Finishes: Keep Playing

**Human opening hand:** 4♦ 5♦ 6♦ 7♦ 8♦ 5♠ 10♠ A♥ 2♦ 3♦ 6♠ 9♥ K♠. West holds 3♣ and opens this Round; the human is not always the opener.

The opening sequence deliberately prepares a finisher situation using real play. Introduce it honestly: “This Round we’ll let West use a few combinations so you can practise what happens when someone finishes. Some of these Passes are choices.”

| Beat | Instruction | Action/checkpoint |
|---|---|---|
| R4.1 Observe another opener | West leads 3♣ 4♣ 5♣ 6♣ 7♣, a Straight Flush; North/East Pass. “Same suit and consecutive ranks together form a Straight Flush. Your Diamonds could beat this one, but for this setup, Pass and keep them together.” | Accept guided human Pass. Clearly disclose that it is voluntary; the human’s 4♦–8♦ is a legal stronger Straight Flush. |
| R4.2 Match size, even with powerful cards | West leads 8♣ 8♠ 8♥; North/East Pass; human Passes. West then leads 9♣ 9♠; North/East Pass; human Passes. | Human has no Triple or Pair respectively. Show the Engine’s no-valid-Play feedback. A held Straight Flush cannot answer a two- or three-card Trick. |
| R4.3 Take a Single, then choose to save a higher one | West leads J♣; North/East Pass. Guide human to play K♠. West beats it with 2♣; North/East Pass. “You could spend 2♦ now. For this example, Pass and keep it for the next decision.” | Accept K♠ then the clearly identified guided voluntary Pass. West now holds only Q♣. The single-card count is public. |
| R4.4 Someone goes out | West leads its last card, Q♣, and is marked DONE/1st. “West has finished, but the Round is not over. We still answer that final Queen.” North and East each explicitly Pass on their real Turns. | Pause at the human’s actual response Turn. Do not erase Q♣, skip other players’ Turns, or give the human Free Lead merely because West finished. |
| R4.5 Choose your response | “Play a higher Single, or Pass. Try either—you can continue the lesson with both choices.” | Accept A♥, 2♦, or Pass. These are all legal; lower Singles/new combinations are not valid responses. Both Play and all-Pass routes are authored below. |
| R4.6 Play your Straight Flush | Once the learner legitimately earns Free Lead: “Lead the five consecutive Diamonds, 4♦ through 8♦.” | Accept 4♦ 5♦ 6♦ 7♦ 8♦. This is the learner’s own Straight Flush Play. North/East Pass; the human has Free Lead again. |

**R4.5 route A — the learner beats Q♣:** A♥ or 2♦ becomes the current Play; West stays out of rotation. North and East explicitly Pass, so the human earns Free Lead. Proceed to R4.6.

**R4.5 route B — the learner Passes:** Every remaining active player has now explicitly passed against West’s final Queen. North, the next active seat after West, earns Free Lead—not the human and not the finished player. North leads 3♠; East Passes. Prompt: “Use A♥ or 2♦ to take this Single while keeping your Straight Flush together.” Accept either; North/East then Pass. The human now legitimately earns Free Lead and proceeds to R4.6. Other legal selections can be inspected; the stated instructional goal reserves the five Diamonds for R4.6, rather than pretending those other selections are illegal.

**Open-practice handoff:** after R4.6 and North/East’s explicit Passes. West remains DONE. Continue normal three-active-player gameplay to third place, then fourth-place assignment and real points. No finished player receives another Turn.

**Practical tip, never a forced strategy rule:**

> “2♦ is the strongest Single. Saving it can help you take control later—but only when the table is playing Singles. It cannot beat a Pair, Triple, or five-card hand by itself. Sometimes using it now is better, especially when an opponent is close to finishing. Don’t save it so long that you never get to use it.”

Also offer: “Look at public card counts before spending a strong card. Try keeping useful Pairs or five-card groups together, but break them when the situation calls for it.” Do not claim this guarantees a win or add a Basic scoring penalty for holding twos; Basic points remain placement-based.

# 7. Round 5 — Your Round

Introduction:

> “You’ve tried the main hand types and seen how play continues. This Round, choose your own moves. Use How to Play, Event Log, or Discard Pile whenever you need them. Any legal choice is welcome—you do not have to finish first.”

- Use the fixed complete Round 5 deal in Appendix A and the existing Baseline policy for all bots from the start. The 3♣ holder opens according to the Engine.
- No forced card highlights, target sequence, requested strategic Pass, or prescribed win. All Engine-valid Plays and Passes are allowed. Retain ordinary legal/illegal feedback and visible game status.
- If the player opens a reference, answer through the comprehensive guide; do not add an automatic “best Move” recommender. Tool use is a skill, not a reason to fail completion.
- Let the player experiment with selection/order, compare legal options, decide when to Pass, and follow a finisher without a teaching gate telling them each action.
- If the human finishes early, explain once that the remaining players still determine second/third/fourth place. Otherwise do not interrupt with repeated coaching.
- Finish the real fifth Round and display the real Session Summary. No exact order, score, or winner is scripted for acceptance.

Completion message, after official Session completion:

> “You’ve completed five Rounds. You can now choose legal hands, beat a play by rank, suit, or five-card category, decide when to Pass, follow Free Lead, and keep playing after someone finishes. Ready for a fresh deal? Choose Basic Game from Play. How to Play is always available from the main menu.”

Explain the actual result: highest total wins; tied totals use most Round wins, then lower average placement, then highest single-Round score, then a genuine tie. Do not invent a tiebreak event if this run was not tied. Provide the full order in the guide. Tutorial completion does not require winning or passing a scored quiz.

# 8. Topics That Need Careful Reference Examples

These supplement hands-on play rather than introduce extra Rounds. Each comparison below is a separate illustrative example, not a claim that these cards exist in the current live hands. No example reveals an unrevealed opponent card.

| Topic | Valid example / explanation |
|---|---|
| Pair suit comparison | 7♠ 7♦ beats 7♣ 7♥: same Pair rank, compare the highest suit in each Pair. These four cards are distinct. |
| Flush is suit-first | A Diamonds Flush such as 3♦ 5♦ 7♦ 9♦ J♦ beats a Hearts Flush such as 6♥ 8♥ 10♥ Q♥ A♥ even though the Hearts’ high card is larger. Neither set is a Straight Flush. |
| Same-suit Flush comparison | 4♣ 6♣ 8♣ 10♣ A♣ beats 3♣ 5♣ 7♣ 9♣ K♣; inspect ranks high to low. The two sets are disjoint. |
| Straight Flush is rank-first | 6♣ 7♣ 8♣ 9♣ 10♣ beats 3♦ 4♦ 5♦ 6♦ 7♦: ten high beats seven high before considering suit. |
| Straight suit tiebreak | 3♣ 4♥ 5♠ 6♦ 7♥ beats 3♦ 4♣ 5♣ 6♣ 7♣: both are seven high, so compare the sevens’ suits. |
| Special low sequences | A-2-3-4-5 and 2-3-4-5-6 are valid low sequences, using 5/6 as effective high cards; do not rank them as 2-high. Invalid wraps remain invalid. |
| Pass is temporary | Passing is declining this response, not leaving the Round and not permanent exclusion from the Trick if play later reaches you again. Opening/Free Lead requires a Play. |
| Public tools and hidden hands | Log/discard/counts help explain known actions. They do not reveal opponents’ remaining cards. Fourth-place reveal occurs only after Round completion. |
| Leaving/restarting | Unfinished progress is not saved. Use the approved confirmation/restart flow; restarting is explicit, never punishment for a wrong selection. |

# 9. Coverage and Acceptance Map

| Requested / additional topic | Required learner evidence |
|---|---|
| 1-, 2-, 3-card hands | R1 accepted Single, Pair, and Triple |
| All five-card categories | Human Straight/Flush in R2, Full House/Four-of-a-Kind in R3, Straight Flush in R4; full hierarchy observed in R2 |
| Playing with higher rank | R1 6♣ over 5♥, plus stronger Straight/Full House/quad examples |
| Playing with higher suit | R1 6♦ over 6♠; Pair/straight tie details in reference |
| Playing with higher combination | R2 Flush over Straight; R3 Four-of-a-Kind over Full House |
| Passing because no Play exists | R1 after Triple nines; R2 after five-card chain; R4 size-mismatch examples |
| Optional passing | R1 2♦ could beat 2♣ but learner Passes; R4 voluntary examples and choice against finisher |
| Logs/discards/controls | R1 hands-on log/discard, select/deselect/sort/rearrange; R2 public history chain; direct comprehensive guide access |
| Basic tips | R3 kicker tradeoff; R4 2♦/public counts/group preservation; none enforced as optimal strategy |
| Free play | Open-practice tails in R1–R4 and unrestricted R5; every legal action accepted |
| After someone finishes | R4 response-to-final-play versus all-Pass branch; explicit active-player Turns, correct next leader, finished player skipped |
| Opening / Free Lead | R1 Single and R2/R3 five-card openings include 3♣; R4 another seat opens; opening/lead cannot Pass |
| Scoring / Session | Real results every Round, five-Round cumulative total, real Summary, reference tiebreak order |
| Rule distinctions | Strongest classification, same-type comparison exceptions, special Straights, no cross-size “bomb” response |

Automated delivery acceptance must verify full deal uniqueness, each guided action/event/checkpoint, all listed alternatives, off-objective versus illegal feedback, tool pause/return, no old callback after restart, all five real Round results, and final unrestricted choices. A repeated click/selection event is not objective completion. Compare combinations using production Engine APIs only.

Human acceptance: give a new player this tutorial without developer coaching. Record whether they can choose a legal response, explain required versus optional Pass, locate a previous Play, identify Free Lead, continue after a finisher, and play the final Round with reference help if desired. Record confusion and revise copy; do not claim understanding from automated completion. A loss is not a failure. Use the approved portrait/landscape, input, and accessibility matrix.

The authored sample prefix is constrained to guarantee the teaching moments. Outside those explicitly identified beats the learner is free to play. Implementation must not secretly constrain open practice to reproduce the sample completion trace.

# Appendix A. Private Authoring Deals

Each Round uses a complete standard 52-card deck with four disjoint 13-card hands. Cards are listed for authoring/reproduction, not player-visible opponent disclosure. Round 5 was obtained with an LCG starting at seed 50205 (multiplier 1664525, increment 1013904223, unsigned 32-bit state, output divided by 2^32) through the existing production shuffle/deal; the explicit hands below are the definitive fixture.

Treat each printed hand as an order-insensitive set of 13 cards, not as a prescribed raw deal order. To reproduce the deal, assign each seat's listed cards to its 13 shuffle-output positions: South receives positions 0, 4, …, 48; West 1, 5, …, 49; North 2, 6, …, 50; East 3, 7, …, 51. Choose and record a concrete ordering within those positions, then derive the 51 Fisher–Yates RNG samples for that complete target permutation and call the existing production startRound. The fixture acceptance criterion is equality of each seat's card set, not equality to the table's printed order. This describes deal reachability without a new snapshot API or internal state mutation; it does not prescribe a unique RNG sequence. Round 5 additionally has the independently specified seed recipe above. The shipping setup interface remains an M6-T01 design/review decision; this authoring probe does not approve a new public API.

## Round 1

| Seat | 13 cards |
|---|---|
| south | 3♣ 6♣ 6♦ 7♣ 7♠ 8♣ 8♠ 8♥ J♣ Q♠ K♦ A♣ 2♦ |
| west | 4♣ 5♣ 6♠ 9♣ 9♠ 9♥ 2♣ 3♠ 4♠ 5♦ 7♦ 10♣ 10♦ |
| north | 5♠ 3♥ 4♥ 6♥ 8♦ 10♠ J♠ J♦ Q♥ K♣ K♥ A♥ 2♠ |
| east | 5♥ 3♦ 4♦ 7♥ 9♦ 10♥ J♥ Q♣ Q♦ K♠ A♠ A♦ 2♥ |

## Round 2

| Seat | 13 cards |
|---|---|
| south | 3♣ 4♠ 5♥ 6♦ 7♣ 8♦ 9♦ J♦ Q♦ A♦ K♠ 2♠ 2♥ |
| west | 4♣ 5♠ 6♥ 7♦ 8♣ 9♣ 9♠ 9♥ 4♥ 4♦ 3♠ 5♦ 7♠ |
| north | 10♣ 10♠ 10♥ 10♦ 3♦ 3♥ 6♣ 7♥ 8♥ J♥ Q♥ K♦ A♥ |
| east | J♣ Q♣ K♣ A♣ 2♣ 5♣ 6♠ 8♠ J♠ Q♠ K♥ A♠ 2♦ |

## Round 3

| Seat | 13 cards |
|---|---|
| south | 3♣ 3♠ 3♥ 6♣ 6♦ 8♣ 8♠ 8♥ 8♦ 5♣ J♠ Q♥ 2♦ |
| west | 4♣ 4♠ 4♥ 7♣ 7♦ 3♦ 5♦ 7♠ 10♠ J♣ Q♣ K♣ K♦ |
| north | 9♣ 9♠ 9♥ 9♦ 4♦ 5♠ 6♠ 7♥ 10♥ J♥ Q♠ K♠ A♣ |
| east | 5♥ 6♥ 10♣ 10♦ J♦ Q♦ K♥ A♠ A♥ A♦ 2♣ 2♠ 2♥ |

## Round 4

| Seat | 13 cards |
|---|---|
| south | 4♦ 5♦ 6♦ 7♦ 8♦ 5♠ 10♠ A♥ 2♦ 3♦ 6♠ 9♥ K♠ |
| west | 3♣ 4♣ 5♣ 6♣ 7♣ 8♣ 8♠ 8♥ 9♣ 9♠ J♣ Q♣ 2♣ |
| north | 3♠ 3♥ 4♥ 6♥ 7♥ 10♣ 10♦ J♥ Q♠ Q♦ K♥ A♣ A♦ |
| east | 4♠ 5♥ 7♠ 9♦ 10♥ J♠ J♦ Q♥ K♣ K♦ A♠ 2♠ 2♥ |

## Round 5

| Seat | 13 cards |
|---|---|
| south | 3♣ 7♣ K♠ 6♠ A♣ 7♦ J♣ J♦ Q♥ K♣ 10♥ 4♣ 2♥ |
| west | 4♦ 9♥ K♦ 8♥ 8♦ 8♠ Q♦ 6♣ 9♦ 4♠ 2♣ 9♠ 10♠ |
| north | 3♠ 10♦ A♥ 2♦ A♠ 4♥ 5♥ 5♦ A♦ J♥ J♠ 8♣ 3♦ |
| east | 10♣ 5♣ 7♥ 6♥ 5♠ 3♥ K♥ 7♠ 2♠ Q♠ 9♣ 6♦ Q♣ |

# Appendix B. Engine-Checked Guided Reference Traces

Every listed Pass is a genuine Turn. Text/tool checkpoints may pause between actions but do not change state. Default R1 choice is J♣; default R3 kicker is 5♣; default R4 finisher response is A♥. Substitute the explicitly allowed branches in the narrative, not arbitrary untested actions within a constrained beat. Full play after each handoff is intentionally not scripted to one outcome.

## Round 1 reference prefix

| Action | Seat | Move | Engine classification |
|---|---|---|---|
| 1 | south | 3♣ | single |
| 2 | west | 5♣ | single |
| 3 | north | 5♠ | single |
| 4 | east | 5♥ | single |
| 5 | south | 6♣ | single |
| 6 | west | 6♠ | single |
| 7 | north | Pass | — |
| 8 | east | Pass | — |
| 9 | south | 6♦ | single |
| 10 | west | Pass | — |
| 11 | north | Pass | — |
| 12 | east | Pass | — |
| 13 | south | 7♣ 7♠ | pair |
| 14 | west | Pass | — |
| 15 | north | Pass | — |
| 16 | east | Pass | — |
| 17 | south | 8♣ 8♠ 8♥ | triple |
| 18 | west | 9♣ 9♠ 9♥ | triple |
| 19 | north | Pass | — |
| 20 | east | Pass | — |
| 21 | south | Pass | — |
| 22 | west | 2♣ | single |
| 23 | north | Pass | — |
| 24 | east | Pass | — |
| 25 | south | Pass | — |
| 26 | west | 4♣ | single |
| 27 | north | Pass | — |
| 28 | east | Pass | — |
| 29 | south | J♣ | single |

## Round 2 reference prefix

| Action | Seat | Move | Engine classification |
|---|---|---|---|
| 1 | south | 3♣ 4♠ 5♥ 6♦ 7♣ | straight |
| 2 | west | 4♣ 5♠ 6♥ 7♦ 8♣ | straight |
| 3 | north | Pass | — |
| 4 | east | Pass | — |
| 5 | south | 8♦ 9♦ J♦ Q♦ A♦ | flush |
| 6 | west | 9♣ 9♠ 9♥ 4♥ 4♦ | fullHouse |
| 7 | north | 10♣ 10♠ 10♥ 10♦ 3♦ | fourOfAKind |
| 8 | east | J♣ Q♣ K♣ A♣ 2♣ | straightFlush |
| 9 | south | Pass | — |
| 10 | west | Pass | — |
| 11 | north | Pass | — |

## Round 3 reference prefix

| Action | Seat | Move | Engine classification |
|---|---|---|---|
| 1 | south | 3♣ 3♠ 3♥ 6♣ 6♦ | fullHouse |
| 2 | west | 4♣ 4♠ 4♥ 7♣ 7♦ | fullHouse |
| 3 | north | Pass | — |
| 4 | east | Pass | — |
| 5 | south | 8♣ 8♠ 8♥ 8♦ 5♣ | fourOfAKind |
| 6 | west | Pass | — |
| 7 | north | 9♣ 9♠ 9♥ 9♦ 4♦ | fourOfAKind |
| 8 | east | Pass | — |
| 9 | south | Pass | — |
| 10 | west | Pass | — |

## Round 4 reference prefix

| Action | Seat | Move | Engine classification |
|---|---|---|---|
| 1 | west | 3♣ 4♣ 5♣ 6♣ 7♣ | straightFlush |
| 2 | north | Pass | — |
| 3 | east | Pass | — |
| 4 | south | Pass | — |
| 5 | west | 8♣ 8♠ 8♥ | triple |
| 6 | north | Pass | — |
| 7 | east | Pass | — |
| 8 | south | Pass | — |
| 9 | west | 9♣ 9♠ | pair |
| 10 | north | Pass | — |
| 11 | east | Pass | — |
| 12 | south | Pass | — |
| 13 | west | J♣ | single |
| 14 | north | Pass | — |
| 15 | east | Pass | — |
| 16 | south | K♠ | single |
| 17 | west | 2♣ | single |
| 18 | north | Pass | — |
| 19 | east | Pass | — |
| 20 | south | Pass | — |
| 21 | west | Q♣ | single |
| 22 | north | Pass | — |
| 23 | east | Pass | — |
| 24 | south | A♥ | single |
| 25 | north | Pass | — |
| 26 | east | Pass | — |
| 27 | south | 4♦ 5♦ 6♦ 7♦ 8♦ | straightFlush |
| 28 | north | Pass | — |
| 29 | east | Pass | — |

# Appendix C. Validation Evidence and Limits

The counts below record the author's external probe run. The document reviewer did not re-execute that probe and therefore marked those counts NOT VERIFIED in their review; they independently corroborated deal validity, Round 5 seed reproduction, and manual trace consistency. M6-T01 must add a repository-contained fixture test and reproducible command so future verification does not require access to external probe scripts.

- Checked against repository HEAD abee43b on September 29, 2026 using Node v24.20.0 and the existing installed TypeScript loader approach, without modifying production source or tests.
- All five full deals validated through production startRound; Engine state and Move invariants were checked after every accepted transition.
- 13 prefix variants checked: all five R1 return Singles, all four R3 kickers, and all four R4 routes (A♥; 2♦; Pass then A♥; Pass then 2♦).
- One continuous five-Round Session completed using the reference prefixes, real Baseline choices for bots after the authored handoffs, and an Engine-legal deterministic human driver used only for verification. Open-practice tails took 40, 25, 36, 39, 57 Moves respectively; these are evidence, not duration or player requirements.
- 583 accepted Moves across the prefix variants and complete Session passed invariant checks. Five opening-Pass attempts were rejected with unchanged state and no accepted events.
- This is fixture/reachability evidence. It does not verify the future tutorial controller/UI, full interaction branch space, focus/pause behavior, or human comprehension. M6/M7 must implement and test those boundaries. Human acceptance is MANUAL VERIFICATION PENDING.
- No tutorial application code, new public API, altered game rule, or committed Git state was created by authoring this script.

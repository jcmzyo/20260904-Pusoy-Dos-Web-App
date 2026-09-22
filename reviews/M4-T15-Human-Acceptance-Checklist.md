# M4-T15 — Phase 1 Human Acceptance Checklist

**Task:** M4-T15 — Phase 1 End-to-End Acceptance and Regression Gate
**Purpose:** Automated suites (Vitest/RTL, Playwright, M1-M3 regressions, typecheck, production build) have already been run and are all passing (see the accompanying Completion Report). This checklist covers the parts that require a real person: subjective usability, comprehension, and anything that "feels wrong" even when every automated assertion passes. Per project rules, Codex writes this checklist but must not self-certify any result on it — only a human's own pass/fail/notes count.

**How to run it:** From the repository root, run `npm run dev` (or `npm run build && npm run preview`) and open the app in a real desktop browser window at a comfortable size (e.g. 1440x900 or your normal windowed browser size). Play through naturally; don't rush to make items pass.

Fill in **Result** as `PASS`, `FAIL`, or `N/A`, and add **Notes** for anything even mildly surprising, confusing, or ugly — not just outright breakage.

---

## Part A — Scripted functional checks

| # | Check | Result | Notes |
|---|---|---|---|
| A1 | Start Game from Home and complete a real, full five-Round Session against the production Baseline bots (not a fixture/test harness) | | |
| A2 | At each of your Turns, you can tell whose Turn it is and what hand-to-beat (if any) is currently on the table | | |
| A3 | On a constrained/narrower window size, every overlapped card in your hand is still individually selectable — select every one of the 13 at least once over the course of the session | | |
| A4 | Drag-reorder both a selected and an unselected card in your hand; the arrangement changes and your selection is unaffected | | |
| A5 | Use **Sort Rank** — hand re-sorts by rank as expected | | |
| A6 | Use **Sort Suit** — hand re-sorts by suit as expected | | |
| A7 | Attempt an illegal Play (e.g. a combination that doesn't beat the current hand, or an invalid combination) — it is rejected/blocked with a clear reason, not silently ignored | | |
| A8 | Make at least one legal Play that actually beats the current hand-to-beat | | |
| A9 | Make at least one **strategic Pass** (you had a legal response available but chose not to play it) | | |
| A10 | Make at least one **no-valid-Pass** situation (you were forced to lead/open because nothing legal was available to respond with, or it was your opening/free lead) | | |
| A11 | Open the **Discard Pile** overlay mid-session — it shows previously played cards and closes cleanly | | |
| A12 | Open the **Event Log** overlay mid-session — it shows a sensible history of actions and closes cleanly | | |
| A13 | Watch a few bot Turns — pacing feels intentional (not instant/jarring, not sluggishly slow) and it's clear the bot acted | | |
| A14 | Click **Leave Game**, then **Stay** — session continues untouched | | |
| A15 | Click **Leave Game**, then confirm **Yes/Leave Game** — returns to Home | | |
| A16 | Resize the browser window across a couple of supported sizes mid-session — layout re-fits without breaking, no reload needed | | |
| A17 | Reach a Round where a bot finishes 4th and its hand is revealed — the reveal is visible and (if a skip control is offered) skip works | | |
| A18 | After each Round Result, confirm the standings/points reorder makes sense (winners/lower scores move as expected) | | |
| A19 | Click **Next Round** after Rounds 1-4 — the next Round actually starts (table un-dims, new deal happens) | | |
| A20 | After Round 5's Result, confirm the automatic transition to **Session Summary** happens (no extra "Next Round" click needed) | | |
| A21 | In Session Summary, open its **Event Log** button/popup — it works and closes cleanly | | |
| A22 | In Session Summary, confirm your own seat is visually highlighted/identifiable among the standings | | |
| A23 | Click **Play Again** from Session Summary — a fresh session starts correctly | | |
| A24 | Return to Home instead (from Session Summary or mid-session Leave) — Home behaves correctly | | |

## Part B — Task-based usability check

Recruit someone (ideally who has **not** read the how-to-play guide or watched you play) and give them only this instruction, verbatim:

> **"Start a game and play through at least one Round."**

Do not tell them which buttons to press, what a "Turn" or "hand-to-beat" means, or how selection/sorting works. Just watch and record what happens.

| Prompt | Response |
|---|---|
| Were they able to start the game without help? | |
| Did they understand whose turn it was and what they needed to beat? | |
| Did they figure out how to select and play cards without prompting? | |
| Did they get through at least one full Round? | |
| List every point of confusion or hesitation observed (even minor), separately from any functional defect found above: | |

## Part C — Overall verdict

- [x] No unresolved **blocking** defect was found in Parts A or B.
- [x] Any non-blocking issue found is listed below with enough detail to file as a follow-up.

**Result (reported by the project owner):** Every item in Part A was inspected and nothing broke. Part B was run with a friend who had no prior knowledge of the game; they understood the surface-level mechanics from the bare prompt alone.

**Issues found (blocking or not):**

| Issue | Blocking? (Y/N) | Description / repro |
|---|---|---|
| No in-game tutorial/onboarding | N (Phase 2 candidate) | Naive tester in Part B understood only the surface level from the bare prompt; a guided tutorial would help new players get further faster. Explicitly out of Phase 1 scope — recorded for Phase 2 planning, not implemented here. |

**Tester name / date:** Project owner + one friend (Part B) — reported 2026-09-22

**Overall result (PASS / PASS WITH NOTED ISSUES / FAIL):** PASS WITH NOTED ISSUES (non-blocking, Phase 2 planning item only)

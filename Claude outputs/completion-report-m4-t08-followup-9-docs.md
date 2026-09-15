# Completion Report — M4-T08 Follow-Up Polish, Round 9 (documentation)

### Task

`M4-T08 follow-up, round 9 — write the consolidated ui-ux.md amendment (v1.3 → v1.4)`

### Status

`COMPLETE`

### Implemented

Per your approval, wrote the previously-proposed, now-consolidated amendment into the canonical `ui-ux.md` as a single version step, **v1.3 → v1.4** (not one increment per follow-up round, per your explicit instruction). The document now reflects every design decision already implemented in code across this entire round of M4-T06/T07/T08 follow-up polish, plus round 8's Straight/Straight Flush display-order fix, folded in as part of the same amendment since it's a genuine UI/UX behavior decision from the same review cycle.

Sections changed (all under the existing `## 5. Game Table Layout` and later numbering — no section renumbering was needed):

- **§5.1 Center table** — added: a Straight/Straight Flush displays its cards in its own ascending house-rule sequence (e.g. `A-2-3-4-5`), not the hand's own Sort-by-Rank order; every other combination type is unaffected.
- **§5.2 Bottom human area** — replaced the old plain left/center/right bullet list with the actual implemented three-container layout: equal-length Event Log/Leave Game, a width-reserved (non-shrinking) middle container, and Play/Pass stacked with inline feedback text and a fixed button size. Also documents that Event Log/Leave Game are currently inert placeholders.
- **§5.3 Bot seat layout** — added the West/East rotated-card-at-full-size detail.
- **§5.4 Per-seat Play/Pass trail** (new) — the whole per-seat compact-badge Play/Pass trail behavior, including the beaten-dims, Pass-replaces-Play, hidden-while-deciding, and the Round-completion trail-preservation exception.
- **§5.5 In-table finish and turn glow** (new) — the gold/silver/bronze/white glow convention, and a note that it's a paint-only effect that never resizes the panel.
- **§5.6 Card face detail** (new) — corner index vs. center pip, by context.
- **§5.7 Table and panel dimension stability** (new) — the table/panel fixed-worst-case-size behavior and the always-reserved-slot/centered-content behavior.
- **§7 Play, Pass, and Validation Feedback** — appended the Play/Pass color-highlight, inline-feedback-text, and fixed-button-size behavior.
- **§8 Bot Turns and Pacing** — updated the presentation-delay default from the original 0.6–1.0s range to the tuned 0.8s default, and added the "deciding" indicator behavior.

Item 5 from an earlier round (fit the whole game on screen without scrolling, across every viewport) remains a separate, still-unresolved scope question against M4-T14 and was **not** included in this amendment, as previously flagged.

### Tests Added / Updated

N/A — documentation-only change; no source files were touched in this round.

### Verification

- Read the live `ui-ux.md` (v1.3) from the project before editing, so the amendment was applied against its actual current text rather than an assumed structure.
- Wrote the complete replacement document back to the project as `ui-ux.md`; the project confirms the write replaced the existing doc.
- No code verification applicable (docs-only); the underlying implementation this document now describes was already verified in rounds 5–8 (typecheck/test/build/Playwright all green, most recently 849/849 Vitest tests and 26/29 Playwright passing with only the pre-existing unrelated favicon failure).

### Files Changed

- `ui-ux.md` (project document) — v1.3 → v1.4.

No source files in the repository were changed this round.

### Issues / Conflicts

None. The scope conflict noted in an earlier round (full no-scroll/resize-adaptive hardening vs. M4-T14) remains open and undocumented by design, pending your decision.

### Pre-existing Changes

None observed.

### Definition of Done

- Amendment applied as a single v1.3 → v1.4 step, not one bump per round — **PASS**.
- Every implemented design decision from this follow-up round is reflected in the doc — **PASS**.
- No confirmed rule, scope, or contract silently changed — **PASS** (this is UI/UX presentation documentation only; no Engine/domain/orchestrator behavior was touched or redefined).
- Doc written only after your explicit approval — **PASS**.

### Scope Check

Documentation-only; no code changes; no unrelated edits to other canonical docs.

### Suggested Next Step

This closes out the current round of M4-T08 follow-up polish and its documentation. The next logical milestone task (per `m4-playable-ui-task-breakdown.md`) would be whichever of M4-T09 onward you want to pick up next — including resolving the earlier flagged M4-T14 scope question — but I have not started or assumed any of that.

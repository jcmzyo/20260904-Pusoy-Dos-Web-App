# Completion Report — M4-T08 Follow-Up Polish, Round 6

Small follow-up to round 5's table-dimension-stability fix.

### Task

`M4-T08 follow-up, round 6 — seat panel height/centering`

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE`

### Implemented

Round 5 fixed the seat panel's own height at a generous, top-aligned 168px so it would never grow/shrink as a seat's status badge or Play trail came and went — which fixed the table's resizing, but left an idle seat (no badge, no trail) looking too tall, with all the leftover space dumped visibly at the bottom.

Fixed by:
- The status badge and the spinner/Play-trail row are now **always** rendered as fixed-height "slots" (24px and 60px respectively) — empty when there's nothing to show, rather than being removed from the layout outright. This is what actually stops the surrounding rows from shifting position when a badge or trail appears/disappears; it also means the panel's own content height is now genuinely constant rather than merely bounded by an overflow cap.
- The panel is `justify-content: center` rather than top-aligned, so if there's still a sliver of leftover space, it's distributed evenly instead of collecting below.
- The panel's own fixed height came down from 168px to 152px, since the slot system no longer needs the previous safety margin for a "row disappearing" case — this is the "adjust the height slightly" part; width was left untouched per your note that it's already right.

### Tests Added / Updated

None new. This is a pure layout refinement of what round 5 already covered (its Vitest coverage doesn't assert pixel heights, and the browser-level `table-stability.e2e.ts` regression from round 5 already re-passed against this change, confirmed below).

### Verification

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **843 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after) — **25 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from every prior report** (the favicon 404 in `app.e2e.ts`). The round-5 table-stability regression and the West/East-containment regression across all six supported viewports both still pass with the panel's new, shorter height.

### Files Changed

- `src/ui/primitives/PlayerPanel.tsx` — status badge and spinner/trail wrapped in always-rendered fixed-height slots.
- `src/ui/primitives/PlayerPanel.module.css` — `justify-content: center`; new `.statusSlot`/`.trailSlot`; panel height 168px → 152px.

Both files were committed to your actual repository, guarded against overwriting a concurrent edit (wrote cleanly, no conflicts).

### Issues / Conflicts

- **Documentation versioning, per your instruction:** the `ui-ux-proposed-amendment.md` I'm sending alongside this report has been consolidated into a single `v1.3 → v1.4` amendment — the intermediate v1.5/v1.6 numbering in earlier drafts was just my own in-progress tracking across rounds, not a plan to actually apply that many version bumps. Once you're done checking the UI and give the go-ahead, this is the one write I'll make to the canonical `ui-ux.md`, taking it from v1.3 to v1.4.
- Item 5 from the prior round (fit the whole game on screen without scrolling, across every viewport, with resize adaptation) is still an open scope question and is not part of this amendment.
- Pre-existing, unrelated: the favicon-404 Playwright failure, unchanged from every prior report.

### Pre-existing Changes

None observed beyond this task's own edits and the prior rounds already committed to your repository.

### Definition of Done

- Panel content vertically centered rather than top-heavy — **PASS**.
- Status/trail treated as reserved (invisible-when-empty) slots rather than removed/reflowing — **PASS**.
- Panel height trimmed while still fitting every state without clipping — **PASS** (verified via the existing Playwright regression suite; no case observed where content exceeds the new 152px).

### Scope Check

Presentation-layer only; no Engine/Orchestrator changes; no new dependencies; no unrelated refactors.

### Suggested Next Step

Waiting on you to check the UI once more. Once you confirm it's done, say so and I'll write the consolidated amendment into `ui-ux.md` as v1.4 — or let me know of anything else to adjust first.

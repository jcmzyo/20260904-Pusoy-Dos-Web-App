# Completion Report — M4-T08 Follow-Up Polish, Round 4

Fourth follow-up round.

### Task

`M4-T08 follow-up, round 4 — held-hand card face, three-container bottom bar with Event Log/Leave Game placeholders, Play/Pass text proportions`

### Status

`CODE + TESTS COMPLETE / TEST EXECUTION COMPLETE`

### Implemented

**1. The player's own held cards show corners + a center suit pip again.** `PlayingCard` now takes an opt-in `showCenterPip` prop; only `HumanHand` passes it. The center table's "hand to beat" and each seat's per-seat Play/Pass trail (`CardIndex`) are untouched — they stay corner-only, which is what fixed their own readability problem last round. This isn't a revert of round 3: it's the same fix, scoped down to only the context that actually needed it.

**2. Bottom bar rebuilt as three aligned horizontal containers.**
- **Left:** Event Log and Leave Game, stacked vertically, centered in the container.
- **Middle:** the human hand on top, Sort by Rank / Sort by Suit side by side underneath, both centered; this container sizes itself to its own content (cards + Sort buttons) rather than a fixed height, so card size and the headroom a selected/raised card needs stay the priority.
- **Right:** Play above Pass (unchanged from round 3).

All three containers sit in one flex row and read as one evenly-aligned band. One note on "height based on the center": with Play/Pass's bigger text this round (item 3), the right container's own natural height is now slightly taller than the middle container's — I aligned all three via `align-items: stretch` (each stretches to the row's shared height, and centers its own content within it) rather than artificially capping the right container down to the middle's exact height, since doing that would have meant shrinking Play/Pass back down. The visual result is still one coherant, evenly-aligned row; flagging this as a judgment call rather than a literal pixel-for-pixel match to your spec.

**3. Event Log and Leave Game are now real (but inert) buttons, not just reserved space.** I checked the actual task breakdown again given your explicit request this round: `ui-ux.md` itself (§4, §5.2) has always specified this left-side layout as part of the approved UI/UX design, and the task breakdown's M4-T10/T11 own the buttons' *behavior* (the Event Log overlay, the Leave Game confirmation) — not the fact that a button sits there. Given that, and the existing precedent of the center table's own Discard Pile button (rendered since M4-T06 with no click behavior at all), I added Event Log and Leave Game the same way: they render, they're styled, clicking them currently does nothing. Their actual overlay/confirmation logic remains M4-T10/T11 scope and is not built here. I used "Leave Game" (the canonical `ui-ux.md` term) rather than "Quit Game" for the button label, since they're clearly the same feature and the doc's own existing term.

**4. Play/Pass text made bigger and re-proportioned.** The main "Play"/"Pass" label is now visually dominant (font-size 20px → 28px) against a smaller second line (12px → 11px) — roughly the 3-to-1 emphasis you described. The button's own fixed box (round 3) grew slightly (88px → 96px min-height) to give the larger label comfortable room without feeling cramped; it's still a fixed size regardless of whether the second line is present.

### Tests Added / Updated

- `tests/unit/ui/Card.test.tsx`: new test confirming `showCenterPip` actually adds a third suit glyph (the pip) on top of the two existing corner glyphs, and that the default (no prop) still renders only the two corners.
- `tests/unit/ui/HumanHand.test.tsx`: new test confirming the player's own held cards render with the pip.
- `tests/unit/ui/SessionTable.test.tsx`: extended the existing Discard Pile test to also assert Event Log and Leave Game are present as buttons.
- `tests/unit/ui/App.test.tsx`: updated the exact button-list assertion to include the two new buttons in their actual DOM order (`Discard Pile, Event Log, Leave Game, Sort Rank, Sort Suit, Play, Pass`).

### Verification

- `npm run typecheck` — **passed**, no errors.
- `npm test` (Vitest) — **842 tests passed, 71 test files, 0 failed.**
- `npm run build` (Vite) — **succeeded.**
- `npm run test:browser` (Playwright, sandbox-only executable-path override applied for verification and reverted immediately after — confirmed clean, not part of the committed diff) — **24 passed, 2 skipped (pre-existing M4-T11, out of scope), 1 pre-existing failure unchanged from all four prior reports** (the favicon 404 in `app.e2e.ts`). No new failures or flakes this round.

### Files Changed

- `src/ui/primitives/Card.tsx` / `Card.module.css` — `showCenterPip` opt-in prop and `.pip` style.
- `src/ui/primitives/HumanHand.tsx` — passes `showCenterPip` for the player's own cards.
- `src/ui/primitives/HumanHand.module.css` — `.handArea` is now the bottom bar's own middle flex container (was `display: contents` feeding a grid that no longer exists).
- `src/ui/App.tsx` — adds the Event Log/Leave Game placeholder buttons in a new left container.
- `src/ui/App.module.css` — `.bottomBar` rebuilt as a three-container flex row; new `.bottomLeft`/`.sideButton` styles.
- `src/ui/primitives/PlayPassControls.module.css` — bigger main label / smaller sub-label proportions; dropped the now-dead `grid-area` reference.
- `tests/unit/ui/Card.test.tsx`, `tests/unit/ui/HumanHand.test.tsx`, `tests/unit/ui/SessionTable.test.tsx`, `tests/unit/ui/App.test.tsx` — new/updated tests above.

All 11 files were committed to your actual repository, each guarded against overwriting a concurrent edit (all wrote cleanly, no conflicts).

### Issues / Conflicts

- The pending `ui-ux.md` amendment (still not written to the canonical doc) has been updated again — the three-container bottom bar with real Event Log/Leave Game placeholders, the new corner-index-vs-center-pip convention (a new §5.6, since this distinction was never actually written into the canonical doc despite being implemented since round 3), and the Play/Pass text-proportion note. Still awaiting your approval.
- Judgment call, flagged above: the three bottom-bar containers are aligned via shared stretch + inner centering rather than the right container being literally capped to the middle's own height, since the middle is no longer reliably the tallest of the three once Play/Pass's text grew.
- Pre-existing, unrelated: the favicon-404 Playwright failure, unchanged from all four prior reports.

### Pre-existing Changes

None observed beyond this task's own edits and the prior three rounds already committed to your repository.

### Definition of Done

Tracked against this round's three items:

1. Held-hand cards show corners + center pip; hand-to-beat and per-seat trail stay corner-only — **PASS**.
2. Three aligned horizontal containers (left: Event Log/Leave Game stacked+centered; middle: cards + Sort stacked, sized to its own content; right: Play above Pass) — **PASS**, with the height-alignment judgment call noted above.
3. Play/Pass main label significantly larger relative to the sub-label (~3/4 vs ~1/4) — **PASS**.

### Scope Check

No Engine/Orchestrator contract changes; no new dependencies; no unrelated refactors. Event Log/Leave Game remain inert placeholders — no overlay, no confirmation flow, no state — consistent with the existing Discard Pile precedent; their actual functionality stays M4-T10/T11 scope. All other changes are presentation-layer only.

### Suggested Next Step

Review/approve the (now four-round) consolidated `ui-ux-proposed-amendment.md`, then decide whether to proceed to M4-T09 (bot pacing/stale-input scope), M4-T10 (Discard Pile/Event Log overlay behavior), or M4-T11/T12 — none implemented here.

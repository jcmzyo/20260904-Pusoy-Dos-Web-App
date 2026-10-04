# Pusoy Dos — Offline Web Game

Web-based implementation of Pusoy Dos (Filipino "Big Two"). See `requirements.md`,
`domain-model.md`, and `engine.md` for the authoritative product/rules/architecture
documentation. This README covers only local setup for the current milestone.

## Prerequisites

- Node.js `>=24` (see `engines` in `package.json`)
- npm (bundled with Node.js)

## Setup

```bash
npm install
```

## Type-checking

`tsc` is used purely for type-checking (`noEmit: true` in `tsconfig.json`); the
app itself is bundled by Vite (see "Running the app" below):

```bash
npm run typecheck
```

Expected result: completes with no output/errors.

## Running the app

```bash
npm run dev       # local development server
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

New to the game? See [HOW_TO_PLAY.md](HOW_TO_PLAY.md).

## Project structure (current)

```
src/
  domain/        # Shared, implementation-independent Pusoy Dos vocabulary (domain-model.md)
  engine/        # Authoritative rules engine (engine.md)
  orchestrator/  # Game-flow coordination and player controllers (orchestrator.md)
  ai/            # Baseline bot decision logic (ai.md)
  application/   # Session startup and the UI-safe presentation adapter
  simulation/    # Headless seeded simulation, replay, and trace tooling (testing-simulation.md)
  ui/            # React presentation (ui-ux.md)
tests/           # Vitest/React Testing Library suites and Playwright browser tests
```

Architectural boundary: `/domain` must not import from `/engine` (or any other
subsystem). This is currently documented via comments in each package's
`index.ts` only; it is not yet mechanically enforced by tooling (e.g. an ESLint
boundaries plugin or dependency-cruiser). That enforcement is deferred to a
later foundational task — see task breakdown notes.

## Seeded gameplay trace

Run a complete production Basic Session without editing tests:

```bash
npm run simulate:trace -- --seed 1713
npm run simulate:trace -- --seed 1713 --output session-1713.log
npm run simulate:trace -- --seed 1713 --include-private-hands --output private-1713.log
```

The seed is required and must be a decimal integer from 0 to 4294967295. The four Baseline seats are south, west, north, east. Logs show Round/action numbers, Play/Pass and cards/combination type, remaining counts, finish placements, Trick resets, Round scores, and Session results. Action numbers run across the Session, starting at 1 (0 before the first turn).

`--output` saves the same console text as UTF-8 and refuses to overwrite existing files. Its parent directory must exist. `--include-private-hands` enables developer-only remaining hands and full failure diagnostics, which must not be shared as normal player output or fed into AI inputs. Default failure output keeps public event context and seed/location/type/code without printing private snapshots or arbitrary exception text. Use `--help` for usage. Exit codes: 0 success/help, 1 simulation/file failure, 2 invalid arguments.

The command loads the existing production TypeScript source using the installed compiler and Node module hooks; it needs no additional dependencies or generated build files. The reusable formatter has no console/file or UI dependency. See `md files/m3-simulation-reliability-task-breakdown.md` v1.2 and `md files/testing-simulation.md` v1.8.

## Responsive viewport matrix (M5-T07)

The implemented M5 presentation supports portrait phones/tablets and retains the M4 landscape layouts. The frozen matrix below comes from `md files/ui-ux.md` §§14/19.6 and `md files/testing-simulation.md`. Dimensions are available layout-viewport CSS pixels (`innerWidth`/`innerHeight`), including browser-toolbar height changes; a square counts as portrait. Implementation and automated evidence do not replace the pending human acceptance below.

| Name | Width x Height | Category |
|---|---|---|
| large-desktop | 1920 x 1080 | supported landscape |
| laptop | 1440 x 900 | supported landscape |
| windowed-desktop | 1280 x 800 | supported landscape (non-fullscreen window) |
| tablet-landscape | 1024 x 768 | supported landscape |
| large-phone-landscape | 844 x 390 | supported landscape (minimum supported) |
| small-phone-landscape | 667 x 375 | unsupported landscape (below minimum since M4-T14; formerly the minimum) |
| portrait-phone-minimum | 360 x 560 | supported portrait phone (minimum; coarse + fine) |
| portrait-phone-360 | 360 x 640 | supported portrait phone (coarse) |
| portrait-phone-375 | 375 x 667 | supported portrait phone (coarse) |
| portrait-phone-ios-toolbar | 390 x 664 | supported portrait phone (toolbar-height emulation; coarse) |
| portrait-phone-390 | 390 x 844 | supported portrait phone (coarse + fine) |
| portrait-phone-412 | 412 x 915 | supported portrait phone (coarse) |
| portrait-phone-class-max | 599 x 960 | supported portrait phone (class boundary; coarse) |
| portrait-tablet-minimum | 600 x 960 | supported portrait tablet (class boundary; coarse) |
| portrait-tablet-768 | 768 x 1024 | supported portrait tablet (coarse + fine) |
| portrait-tablet-820 | 820 x 1180 | supported portrait tablet (coarse) |
| portrait-tablet-1024 | 1024 x 1366 | supported portrait tablet (coarse) |
| portrait-square | 700 x 700 | supported portrait tablet (fine) |
| portrait-below-min-width | 359 x 560 | unsupported portrait (coarse + fine) |
| portrait-below-min-height | 360 x 559 | unsupported portrait (coarse) |
| portrait-small-phone | 320 x 568 | unsupported portrait (coarse) |
| portrait-phone-se-toolbar | 375 x 553 | unsupported portrait (SE-class toolbar-height emulation; coarse) |
| landscape-below-min-width | 843 x 390 | unsupported landscape (coarse + fine) |
| landscape-below-min-height | 844 x 389 | unsupported landscape (coarse + fine) |
| undersized-landscape | 560 x 320 | unsupported landscape (below minimum) |

Minimum supported landscape dimensions remain **844 x 390** (raised from 667 x 375 in `M4-T14`); portrait requires **360 x 560**. Portrait widths below 600px use the phone composition; wider portrait uses the tablet composition. Supported portrait never asks the player to rotate. An undersized fine-pointer window gets resize guidance. An undersized coarse-pointer device gets rotate guidance only if swapping its dimensions would be supported; otherwise it gets “This screen is too small to play”. The 375 x 553 SE-class toolbar state is excluded in both orientations. Supported landscape rows use fine-pointer automation; the two retained small/undersized landscape rows exercise both pointer types.

Frozen landscape sizing constraints:

- minimum core body/control text size: **14px**
- minimum critical control/touch target size: **44 x 44px**
- minimum exposed card width for reliable overlapped-hand tap targeting: **28px**

The 14px and 44px constants hold literally on *rendered* sizes wherever the play area renders at scale 1 or larger: viewports of at least **896 x 656** (the play area's design size in `src/ui/primitives/playAreaScale.ts`; `FULL_SCALE_LANDSCAPE_*` in `layoutThresholds.ts`). Anywhere from there up to a 1440 x 900 window the play area is laid out at natural size (scale 1) in the whole window, with the extra room spread between the seats rather than zooming everything in; only a window larger than that scales up. Between 896 x 656 and the 844 x 390 minimum (the phone tier) the play area is scaled down to fit, so those two constants are exempt there; the 28px exposed-card constant applies at every supported size. `tests/browser/responsive-hardening.e2e.ts` asserts both tiers.

Portrait has no text/target exemption: text is at least **14px**, controls **44 x 44px**, cards retain **5:7**, and each overlapped held card exposes at least **24px**. All 13 cards share a baseline; selected cards rise at least **16px**. Cards remain between 56px and the approved touch/fine-pointer caps. Critical gameplay controls fit without page scrolling; portrait result bodies may scroll while headings/actions remain visible. M5 does not opt into `viewport-fit=cover`; browser-managed notch/home-indicator exclusion remains in effect. Emulated safe-inset checks are not real iOS evidence.

Keyboard support includes a single hand Tab stop, arrows/Home/End to choose a card, Space/Enter to select, and Shift plus arrows/Home/End to rearrange. Selection survives sorting/reordering. Dialogs contain and return focus; disabled Play/Pass remain focusable and cannot submit. Summary actions retain Event Log → Home → Play Again order; Arrow, Page Up/Down, and Home/End keys scroll overflowing Summary results without activating actions. Live reduced-motion preferences remove selection/dimming motion, replace the deciding spinner with text, and show settled Round results while preserving explicit Next Round for Rounds 1–4 and automatic Round 5 Summary.

The executable matrix is `tests/browser/viewportMatrix.ts`; production sizing constants live in `src/ui/primitives/layoutThresholds.ts`. Run the browser harness (requires `npx playwright install chromium` once, then):

```bash
npm run test:browser
```

### M5-T07 verification evidence and acceptance

Automated environment: October 4, 2026, Node 24.20.0, Playwright 1.63.0, Chromium 153.0.8010.12, task branch based on `3c88435`. The focused suites are `m5-regression.e2e.ts` and `summary-layout.e2e.ts`, alongside the retained portrait table/hand/dialog/result, orientation, viewport, and landscape suites. They check score centering, long Summary content, keyboard/wheel scrolling, toolbar-height interruptions, emulated insets, cancelled drag, contrast, sizing, focus, and reduced motion using deterministic fixtures where applicable.

Automated results before the static-dots follow-up: `npm test` passed 1,134 tests in 88 files; `npm run typecheck` and `npm run build` passed. `npm run test:browser -- m5-regression.e2e.ts summary-layout.e2e.ts` passed 37 checks. The full `npm run test:browser` run scheduled 337 checks and its saved Playwright result reported `passed` with no failed tests. After the follow-up, `npm test` passed 1,135 tests in 88 files, typecheck/build passed again, and `npm run test:browser -- m5-regression.e2e.ts --grep "thinking uses static dots"` passed both portrait and landscape checks. The full browser sweep was not repeated for this label-only follow-up. The M3 acceptance batch is reserved for the T08 milestone gate; T07 changed no Engine/runner/setup reliability code. No lint script exists.

**Human report — October 4, 2026:** the user verified that this T07 working build works on desktop Chrome in portrait and landscape, mobile Chrome, Safari, and a portrait tablet. The user has no access to other devices and vouched for the remaining coverage. Record those unavailable targets as NOT VERIFIED, not as executed passes. Exact browser versions, viewport dimensions, mobile OS, Safari platform, and individual checklist results were not supplied. Chromium mobile emulation is not real-device testing; Chromium results are only engine-level evidence for Edge. Full assigned evidence remains incomplete.

**User-approved reduced-motion refinement — October 4, 2026:** the bot thinking indicator now shows static `...`, replacing the earlier visible `deciding` text. It does not cycle dots or add animation; its accessible name still identifies which player is deciding. This supersedes the literal reduced-motion label from the M5-T06 contract without changing bot pacing or gameplay.

**M5-T07 COMPLETE — user acceptance, October 4, 2026:** after the report above, the user explicitly accepted the outstanding coverage gaps and requested that the requirements pass. The remaining manual-evidence requirements are waived for T07 only. The NOT VERIFIED entries below remain an accurate record of tests not performed, rather than blockers to this accepted task. M5-T08 and the milestone acceptance gates remain unchanged.

| Human target | Required evidence | T07 status |
|---|---|---|
| Desktop Chrome | Portrait window and landscape smoke; keyboard-only Round | Reported working in both orientations; individual checklist details not supplied |
| Desktop Edge | Start/play a Round, dialogs, keyboard | NOT VERIFIED — unavailable/unreported |
| Desktop Firefox | Start/play a Round, dialogs, keyboard, reduced motion | NOT VERIFIED — unavailable/unreported |
| macOS Safari | Gameplay/dialog/input smoke | Safari reported working; platform unspecified, so macOS-specific coverage NOT VERIFIED |
| Real Android Chrome phone | Portrait play, rotation, toolbar changes, every-card touch selection and drag; full five-Round Session for T08 | Mobile Chrome reported working; OS/device and five-Round evidence unspecified |
| Real iPhone Safari | Portrait Session smoke, rotation, toolbars, selection and drag | Safari reported working; platform unspecified, so iPhone-specific coverage NOT VERIFIED |
| Real portrait tablet | Input/layout sweep; full five-Round Session for T08 | Reported working; device/browser and five-Round evidence unspecified |

For each available target, check that every card can be selected/rearranged, selection stays raised after sorting, controls and feedback are understandable, dialogs scroll with visible actions, keyboard focus remains visible/contained, rotation preserves play, and reduced-motion results continue deliberately. Record tester/date, build, browser version, device, available viewport, input, actions, expected/observed results, and pass/fail. Unavailable targets remain NOT VERIFIED.

## Status

The repository contains the M1 Basic Engine, M2 Orchestrator/Baseline AI, M3 deterministic simulation and developer trace tooling, and the M4 playable UI (Home, a five-Round Basic Session against three Baseline bots, and the Session Summary). Phase 1 is the completed baseline. M5 portrait gameplay, keyboard/focus, and reduced-motion presentation are implemented; T07 is accepted with the recorded manual-evidence waiver. M5-T08 milestone acceptance and M6–M8 tutorial/reference and later acceptance work remain pending.

## Phase 2 planning

- [Expansion plan](md%20files/phase-2-expansion-plan.md)
- [Canonical requirements](md%20files/requirements.md) — §1.6 roadmap and §3.6 scope/acceptance
- [Tutorial contract](md%20files/tutorial.md)
- [M5 — Portrait & Mobile](md%20files/m5-portrait-mobile-task-breakdown.md)
- [M6 — Tutorial Framework](md%20files/m6-tutorial-framework-task-breakdown.md)
- [M7 — Tutorial & Rules](md%20files/m7-tutorial-rules-task-breakdown.md)
- [M8 — Phase 2 Acceptance](md%20files/m8-phase2-acceptance-task-breakdown.md)

The viewport matrix above records delivered M5 behavior under the M5-T01 frozen contract, with the evidence limitations listed explicitly. Existing landscape-phone sizing exemptions remain; portrait does not inherit them. Keyboard/focus and reduced motion are mandatory Phase 2 requirements. HOW_TO_PLAY.md continues to describe the current app until M7 synchronizes its instructions with delivered Tutorial/Rules navigation.

Planned M7 main-menu flow: **Play → Tutorial / Basic Game choice window**, plus a separate **How to Play** entry opening the comprehensive guide. Tutorial provides guided scripted gameplay; Basic Game retains normal five-Round play. These entry points are documentation commitments, not implemented by this update.

The [five-Round tutorial script](md%20files/tutorial-script.md) contains the authored lesson sequence, exact teaching deals, allowed alternatives, and Engine-checked reference traces. It is content planning, not an implemented tutorial.

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

## Responsive viewport matrix (M4-T04)

M4 gameplay is landscape-first (see `md files/ui-ux.md` §14 and `md files/requirements.md` §3.1). The following viewport matrix is frozen for automated Playwright checks and reused by later M4 responsive-hardening tasks (T05-T14). Dimensions are CSS pixels.

| Name | Width x Height | Category |
|---|---|---|
| large-desktop | 1920 x 1080 | supported landscape |
| laptop | 1440 x 900 | supported landscape |
| windowed-desktop | 1280 x 800 | supported landscape (non-fullscreen window) |
| tablet-landscape | 1024 x 768 | supported landscape |
| large-phone-landscape | 844 x 390 | supported landscape (minimum supported) |
| small-phone-landscape | 667 x 375 | unsupported landscape (below minimum since M4-T14; formerly the minimum) |
| portrait-unsupported | 390 x 844 | unsupported orientation |
| undersized-landscape | 560 x 320 | unsupported landscape (below minimum) |

Minimum supported landscape dimensions: **844 x 390** (raised from 667 x 375 in `M4-T14`). A landscape viewport smaller than this shows resize/unsupported guidance; a portrait viewport on a touch device shows rotate guidance (`M4-T11`).

Frozen minimum readable/targetable sizing constraints for later hardening tasks (T05-T14):

- minimum core body/control text size: **14px**
- minimum critical control/touch target size: **44 x 44px**
- minimum exposed card width for reliable overlapped-hand tap targeting: **28px**

The 14px and 44px constants hold literally on *rendered* sizes wherever the play area renders at scale 1 or larger: viewports of at least **896 x 656** (the play area's design size in `src/ui/primitives/playAreaScale.ts`; `FULL_SCALE_LANDSCAPE_*` in `layoutThresholds.ts`). Anywhere from there up to a 1440 x 900 window the play area is laid out at natural size (scale 1) in the whole window, with the extra room spread between the seats rather than zooming everything in; only a window larger than that scales up. Between 896 x 656 and the 844 x 390 minimum (the phone tier) the play area is scaled down to fit, so those two constants are exempt there; the 28px exposed-card constant applies at every supported size. `tests/browser/responsive-hardening.e2e.ts` asserts both tiers.

The canonical matrix/constants live in `tests/browser/viewportMatrix.ts` and are consumed by `tests/browser/viewport-matrix.e2e.ts`. Run the browser harness (requires `npx playwright install chromium` once, then):

```bash
npm run test:browser
```

## Status

The repository contains the M1 Basic Engine, M2 Orchestrator/Baseline AI, M3 deterministic simulation and developer trace tooling, and the M4 playable UI (Home, a five-Round Basic Session against three Baseline bots, and the Session Summary). Phase 1 is the completed baseline. Phase 2 M5–M8 is approved for planning/implementation; this documentation update does not implement portrait gameplay or tutorials.

## Phase 2 planning

- [Expansion plan](md%20files/phase-2-expansion-plan.md)
- [Canonical requirements](md%20files/requirements.md) — §1.6 roadmap and §3.6 scope/acceptance
- [Tutorial contract](md%20files/tutorial.md)
- [M5 — Portrait & Mobile](md%20files/m5-portrait-mobile-task-breakdown.md)
- [M6 — Tutorial Framework](md%20files/m6-tutorial-framework-task-breakdown.md)
- [M7 — Tutorial & Rules](md%20files/m7-tutorial-rules-task-breakdown.md)
- [M8 — Phase 2 Acceptance](md%20files/m8-phase2-acceptance-task-breakdown.md)

The viewport matrix above describes implemented Phase 1 behavior. M5-T01 has frozen the portrait matrix and sizing (`md files/testing-simulation.md`, "Frozen M5 acceptance matrix"), and M5-T07 updates this table once supported portrait is delivered. Until then, the `portrait-unsupported` row and the portrait rotate-guidance sentence above are superseded: since M5-T02, 390 x 844 is classified as supported phone portrait, whose playable layout arrives in M5-T03. Existing landscape-phone sizing exemptions remain; portrait does not inherit them. Keyboard/focus and reduced motion are mandatory Phase 2 requirements. HOW_TO_PLAY.md continues to describe the current app until M7 synchronizes its instructions with delivered Tutorial/Rules navigation.

Planned M7 main-menu flow: **Play → Tutorial / Basic Game choice window**, plus a separate **How to Play** entry opening the comprehensive guide. Tutorial provides guided scripted gameplay; Basic Game retains normal five-Round play. These entry points are documentation commitments, not implemented by this update.

The [five-Round tutorial script](md%20files/tutorial-script.md) contains the authored lesson sequence, exact teaching deals, allowed alternatives, and Engine-checked reference traces. It is content planning, not an implemented tutorial.

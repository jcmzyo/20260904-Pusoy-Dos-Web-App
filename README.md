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

The project currently has no bundler/build step configured. `tsc` is used purely
for type-checking (`noEmit: true` in `tsconfig.json`):

```bash
npm run typecheck
```

Expected result: completes with no output/errors.

## Project structure (current)

```
src/
  domain/   # Shared, implementation-independent Pusoy Dos vocabulary (domain-model.md)
  engine/   # Authoritative rules engine (engine.md)
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

## Status

The repository contains the M1 Basic Engine, M2 Orchestrator/Baseline AI, and M3 deterministic simulation and developer trace tooling. M4 playable UI remains separate work.

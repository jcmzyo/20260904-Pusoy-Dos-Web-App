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

## Status

This repository currently contains only the M1 (Basic Engine Core) project
scaffold. No AI, orchestrator, or UI are implemented yet.

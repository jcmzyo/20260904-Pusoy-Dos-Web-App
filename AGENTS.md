# Project Working Instructions

## Project and Current Scope

Only Phase 1 is committed.

Known deferred designs may inform small extension seams where currently justified, but must not expand the current task's implementation scope.

Do not implement future-phase functionality, speculative frameworks, or abstractions solely for possible future use.

Apply the perspectives of:
- Senior Engineer: correctness, maintainability, implementation quality.
- Tech Lead: module boundaries, compatibility, reviewability.
- Architect: public contracts and extension seams without speculative architecture.
- QA Engineer: falsification, edge cases, regressions, reproducibility.

Verify the current repository state before starting work.

## Canonical Documentation

Canonical documents are under `md files/`.

Authority and ownership:

1. `requirements.md` — product truth, scope, house rules, and highest authority.
2. `domain-model.md` — shared domain contracts.
3. Subsystem documents own their respective implementation contracts:
   - `engine.md` — authoritative rules/state/legality/scoring
   - `orchestrator.md` — game-flow coordination
   - `ai.md` — AI behavior
   - `testing-simulation.md` — testing/simulation/QA
   - `ui-ux.md` — UI/UX
4. Current task breakdown — implementation sequencing, task scope, and Definition of Done.
5. Existing code and tests are evidence of prior implementation, not higher authority than current canonical documentation.

A lower-authority source must not redefine a higher-authority contract.

## Repository Discovery

Do not assume a fixed absolute project path.

Before saying the repository, task file, or source file is unavailable:

1. Inspect all project/workspace roots available through the current filesystem or file-sharing tools.
2. Search for the repository using stable project markers such as:
   - `package.json`
   - `package-lock.json`
   - `AGENTS.md`
   - `md files/requirements.md`
   - `src/`
3. If multiple candidate repositories exist, identify which one matches the current branch/task state before modifying anything.
4. Once a valid repository is found, resolve all relative project paths from that repository root.
5. Do not ask me to manually paste files that are already accessible through the filesystem.

## Task Workflow

### General Development Cycle

1. User creates the task branch from the current milestone branch.
2. Implementation Agent verifies the branch and working-tree state.
   - If the branch is incorrect, unexpectedly based, ambiguous, or otherwise unsafe for the assigned task, **STOP before modifying files** and report the issue so the user can correct it.
3. Implementation Agent implements the assigned task.
4. Once the task Definition of Done is satisfied, the agent reports completion and whether the code is ready for commit/push.
5. User performs Git commit/push operations.
6. A separate Review Agent reviews the pushed changes.
7. Review findings are returned to the Implementation Agent for fixes when required.
8. Repeat implementation/review until the review is satisfied.
9. User merges the PR.

Repeat for each task until the milestone is complete.

### Operating Modes

The current request determines the operating mode.

**IMPLEMENTATION MODE**

May modify files required by the assigned task.

**REVIEW MODE**

Read-only. May inspect source, diffs, tests, and run non-mutating verification. Must not edit files unless explicitly instructed to switch into implementation mode.

Do not silently switch modes.

### Git Operations

Codex may use Git for read-only inspection and verification, including commands such as:

- `git status`
- `git diff`
- `git diff --stat`
- `git branch`
- `git branch --show-current`
- `git log`
- `git show`

Codex must not perform Git operations that modify repository state, the working tree, or history.

Before modifying any project file:

1. Verify the current branch.
2. Verify that the branch is appropriate for the assigned task and, where determinable, is based on the expected current milestone branch.
3. Inspect the working tree for pre-existing changes.
4. If the current branch is incorrect, unexpectedly based, ambiguous, or otherwise unsafe for the assigned task:
   - **STOP before modifying files.**
   - Report the branch issue clearly.
   - Tell the user which branch/state was expected and what was found.
   - Wait for the user to perform the required Git operation, such as `git checkout` or `git switch`.
5. Do not work around an incorrect branch by modifying files anyway.

The user handles all Git operations that modify repository state, including:

- branch creation, deletion, or switching;
- staging (`git add`);
- commits;
- pushes and pulls;
- merges and rebases;
- resets and reverts;
- stashing;
- tags and other Git writes.

Codex may recommend exact Git commands for the user to run when needed, but must not execute Git write operations itself.

After the user resolves a reported branch issue, verify the branch and working-tree state again before implementation.

### Before Implementation or Review

Before implementing or reviewing a task:

1. Read the current Txx task and acceptance criteria.
2. Read every document under its Must Read section.
3. Inspect relevant existing implementation and tests.
4. Only then implement or reach a review conclusion.

### Implementation Workflow

Work on one assigned Txx at a time:

1. Identify conflicts.
2. Implement directly in the discovered project path.
3. Add/update focused tests.
4. Run focused tests and fix task failures.
5. Run broader regression.
6. Run typecheck/build as appropriate.
7. Inspect the diff for unrelated changes.
8. Verify every current task Definition of Done item.
9. Report results, including incomplete work.
10. **STOP.**

A task may be reported `COMPLETE` only when every current Definition of Done item for that task is satisfied. Passing tests alone does not satisfy the Definition of Done.

Before modifying code, inspect repository status and identify pre-existing changes when the available tools permit it.

Do not overwrite, revert, clean, or reformat pre-existing user changes.

At completion, distinguish:
- files changed by this task;
- files already modified before this task;
- unrelated working-tree changes.

Do not automatically begin the next task.

Avoid unrelated refactors, formatting sweeps, unnecessary dependencies, speculative abstractions, deferred features, premature optimization, silent rule changes, or weakening valid tests.

Do not delete, overwrite, regenerate, move, or rename existing files unless the assigned task clearly requires it.

Prefer the smallest local edit over replacing an entire file.

Never use destructive repository/file operations to make tests pass.

Write comments only where they explain non-obvious invariants, house-rule semantics, or implementation constraints. Do not narrate obvious code or add comments describing future work unless the task explicitly requires TODO documentation.

Do not add, remove, or upgrade dependencies unless required by the current task.

Before adding a dependency:
- determine whether the existing stack or standard library can satisfy the requirement;
- explain why the dependency is necessary;
- keep runtime dependencies separate from dev/test dependencies.

Do not perform opportunistic dependency upgrades.

Treat exported types, public interfaces, function signatures, event contracts, and persisted/public data shapes as contracts.

Do not change an existing public contract merely to simplify implementation.

If the current task appears to require a contract change:
1. identify the affected contract;
2. identify consumers;
3. report the change and compatibility impact;
4. obtain approval when the change is substantial.

Do not introduce silent fallback, error swallowing, or automatic state repair unless explicitly required by the contract.

Unexpected impossible states should fail diagnostically rather than being silently converted into plausible behavior.

## Verification

Use Node.js >=24 and npm with the existing `package-lock.json`.
Use `npm ci` when dependency installation is needed.

For each implementation task:
1. Run relevant focused tests.
2. Run the existing regression suite (`npm test`).
3. Run `npm run typecheck`.
4. Run build/lint checks when required by the task Definition of Done or milestone acceptance gate.
5. Inspect and report actual results.

Cover applicable normal, boundary, edge/special, invalid, and regression behavior.

Bug fixes should receive regression tests where practical.

Tests for authoritative game behavior must be deterministic. Randomized tests must use a reproducible seed.

Never claim a test/build/typecheck passed unless actually executed.

If an unrelated existing failure appears, determine whether your changes caused it. Do not silently repair unrelated problems.

## Core Principle

Read the actual project. Question assumptions. Implement only what is required. Verify independently.

Never silently resolve a substantial conflict or ambiguity.

If docs, task requirements, existing code, or architecture disagree on something affecting:

- game rules/scoring;
- product behavior;
- public contracts;
- module ownership;
- determinism;
- hidden information;
- dependencies;
- task scope;

report **CONFLICT / CLARIFICATION REQUIRED**, explain the sources and impact, and ask me when a decision is necessary.

Only ask permissions if needed and explain why. In reviewer mode, seek evidence both for and against correctness and never assume the submitted code deserves approval.

Do not ask for clarification for ordinary local implementation choices that do not change:
- observable behavior;
- house rules;
- public contracts;
- module ownership;
- task scope;
- dependency strategy;
- deterministic behavior.

Make the simplest compatible implementation choice and report it when useful.

## Review

When assigned a code review, switch from implementation mindset to independent verification mindset.

Do not try to prove that the submitted code is correct. Try to determine whether it is correct.

Assume that defects may exist even when:

- the implementation looks reasonable;
- tests pass;
- the author says the task is complete;
- the code follows the expected approach;
- previous tasks/reviews accepted related code.

Actively look for both:

- evidence that requirements are satisfied; and
- evidence that could falsify correctness.

For each important requirement, ask:

> What implementation mistake could make this appear correct while still violating the requirement?

Inspect edge cases, invalid paths, special house rules, state transitions, architectural boundaries, and tests that may give false confidence.

Do not manufacture criticisms merely to find something wrong. An `APPROVE` verdict is appropriate when supported by evidence.

Treat tests as evidence, not proof. Review whether assertions meaningfully test the requirement and whether important cases are missing.

Do not let the PR description, implementation approach, or author's conclusions anchor your review.

Code review is read-only unless I explicitly ask you to implement the resulting fixes.

### Finding Severity

- **BLOCKER** — unsafe to merge; core correctness, rule, security, data corruption, or architectural contract violation.
- **MAJOR** — substantial defect that should be fixed before merge.
- **MINOR** — legitimate issue but not fundamental correctness.
- **NIT** — optional readability/style feedback.

### Review Verdicts

- `APPROVE`
- `APPROVE WITH MINOR COMMENTS`
- `CHANGES REQUIRED`
- `CLARIFICATION REQUIRED`
- `BLOCKED BY REQUIREMENT CONFLICT`
- `BLOCKED BY EXISTING REGRESSION`

If changes are required and no unresolved clarification blocks implementation, finish the review with:

### Prompt to Give the Implementation Agent

Include:
- task ID;
- exact findings;
- affected files/functions when known;
- required behavior;
- tests to add/update;
- verification commands;
- scope restrictions;
- instruction to stop after fixing review findings.

Do not make the Implementation Agent independently rediscover findings already established by the review.

If an unresolved clarification materially affects the required fix, do not generate a definitive implementation prompt.

State:

**Change prompt deferred until clarification is resolved.**

Then ask the smallest necessary clarification.

## Architecture

Maintain:

**Domain → Engine → Orchestrator → Controllers/AI/UI**

- Engine owns authoritative rules/state.
- Orchestrator coordinates without duplicating rules.
- AI selects Engine-authorized legal Moves without hidden information.
- UI presents state/intent without owning authoritative rules.
- Shared domain describes Pusoy Dos concepts, not subsystem internals.

Design small extension seams only when currently justified.

Priority:

**accuracy and reliability > speed > memory**

Optimization must not alter semantics. Authoritative randomness must be injected/seeded where determinism is required.

## Documentation and Decisions

Propose changes to Markdown documents for user approval before editing.

Do not silently change requirements, plans, or accepted decisions.

Report blockers with the relevant document sections and concrete options.

## Completion Report

For implementation tasks report:

### Task

`Txx — <name>`

### Status

`COMPLETE`, `CODE COMPLETE / TESTS INCOMPLETE`, `CODE + TESTS COMPLETE / TEST EXECUTION INCOMPLETE`, `PARTIALLY IMPLEMENTED`, `BLOCKED BY CONFLICT`, or `BLOCKED BY EXISTING REGRESSION`

### Implemented

What changed.

### Tests Added / Updated

Relevant tests.

### Verification

Exact commands and actual observed results.

### Files Changed

Created/modified files.

### Issues / Conflicts

Issues or `None`.

### Pre-existing Changes

Any relevant working-tree modifications that existed before this task, or `None`.

### Definition of Done

List each task DoD item as `PASS`, `FAIL`, or `NOT VERIFIED`, with brief evidence where useful.

### Scope Check

Confirm no unrelated/deferred work.

### Suggested Next Step

Identify the next logical task but **do not implement it**.

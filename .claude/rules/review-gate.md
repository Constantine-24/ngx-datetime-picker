# Review Gate

The review gate is **`/pr-review-toolkit:review-pr`** (requires the `pr-review-toolkit` plugin). It drives the specialist agents (`code-reviewer`, `silent-failure-hunter`, `pr-test-analyzer`, `comment-analyzer`, `type-design-analyzer`, `code-simplifier`) but knows nothing about this project. This file is the project delta to apply on top of it. Codex and other tools without the plugin run the same agents' roles manually, with the same deltas.

<important if="you are running a code review, dispatching any review or simplifier subagent, or about to mark a task complete">

- **Give every agent this project's rules**: `CLAUDE.md`, `CLAUDE.local.md` (if present), `.claude/rules/*.md`, and every subdirectory `CLAUDE.md` relevant to the diff. Without them the findings are generic noise.
- **Include the Required checks below verbatim** in the `code-reviewer` prompt, on the first pass and on the verify pass.
- **Suggestions are never auto-applied.** Only Critical and Important findings are mandatory fixes.
- **Run per chunk** — after each completed slice, not once at the end.
- **Verify after simplifying** by re-running `code-reviewer` plus each agent that raised a Critical or Important finding. Only `silent-failure-hunter` reliably catches a simplifier collapsing an error path into an optimistic one.
- **Hard cap: 2 simplify passes per chunk.** Past that, stop and raise it — repeated findings mean a design problem.
- **Reviewers may run on pre-v22 Angular knowledge.** Before acting on a flagged idiom, check it against the shipped sibling code and context7. Known false positives: "add `allowSignalWrites`" (removed in v19), "add `standalone: true`" or "add `OnPush`" (both are defaults now).
- After any agent wave, assert `git status` is clean of unexpected changes before trusting a gate result or committing.
  </important>

## Required checks

These are blocking, specific to this project, and can't be deferred to a follow-up PR.

- **Public API discipline.** No unintended change to anything exported from a `public-api.ts`, or to any selector, input, output, model, error key or `exportAs`. Intended changes have TSDoc, a CHANGELOG `[Unreleased]` entry, README updates, and — if breaking — a `!` commit and a major-version plan.
- **Entry-point isolation.** The core entry imports nothing from `temporal/` or `temporal-polyfill`. The secondary entry imports the core only by its package specifier.
- **No dead code.** No unused exports, members, imports, unreachable branches, or commented-out blocks.
- **No leaks.** Every subscription ends via `takeUntilDestroyed()` or a finite operator. Every overlay, `addEventListener`, timer, `ResizeObserver` and `requestAnimationFrame` has matching teardown.
- **No `any`** (including `$any()` in templates), no `enum`, no decorator-based inputs/outputs/host bindings.
- **Accessibility.** New or changed interactive UI keeps the contract in `accessibility.md` (roles, names, keyboard support, focus management, contrast) and has a keyboard-path spec.
- **Forms parity.** A new or changed input directive is covered for Reactive Forms, `ngModel` and Signal Forms.
- **Deterministic tests.** No spec depends on the wall clock, the machine's time zone or locale unless it pins them.
- **SSR safety.** No unguarded `window` / `document` / `navigator` access.
- **Pinned Material internals** (see `projects/ngx-datetime-picker/CLAUDE.md`) are only used where already documented, and stay covered by integration specs.

## Conflict precedence

Highest applicable rule wins:

```
1. CLAUDE.md / CLAUDE.local.md / .claude/rules/*.md / subdirectory CLAUDE.md
2. Plan adherence (no scope creep)
3. Agent finding severity
```

# CLAUDE.md

**ngx-datetime-picker** — an open-source Angular 22 date / time / datetime / range picker library, published to npm as `@constantine-24/ngx-datetime-picker`. It is built on `@angular/cdk` + `@angular/material` primitives and ships a TC39 **Temporal** adapter as the flagship default. This workspace holds the library (`projects/ngx-datetime-picker/`) and the demo app (`src/`) that is deployed to GitHub Pages.

You are an expert in TypeScript, Angular and accessible, publishable component libraries. Everything in `projects/` is public API that other people install: favour backwards compatibility, documentation and test coverage over cleverness.

Use the MCP tools where they know more than training data: **context7** for Angular / Material / CDK / Temporal / Vitest / ESLint / GitHub Actions APIs (the installed versions are newer than most training data), and **chrome-devtools** for live UI and accessibility verification of the demo. Raw Read/Edit/Grep and Bash remain the right tools for plain-text search and shell work.

Per-developer overrides go in `CLAUDE.local.md` (gitignored, auto-loaded alongside this file).

## Rule modules

Project-wide rules live under `.claude/rules/` and are loaded via `@`-import below. They are the single source of truth; `AGENTS.md`, `.cursor/rules/` and `.codex/` only point here.

@.claude/rules/architecture.md
@.claude/rules/commands.md
@.claude/rules/code-style.md
@.claude/rules/angular-components.md
@.claude/rules/styling.md
@.claude/rules/accessibility.md
@.claude/rules/workflow.md
@.claude/rules/review-gate.md
@.claude/rules/release.md

## Area-specific rules (lazy-loaded)

These auto-load only when working in the relevant directory:

- `projects/ngx-datetime-picker/CLAUDE.md` — library internals: seams, adapters, pinned Material internals, known gotchas
- `src/CLAUDE.md` — demo app: public-API-only imports, GitHub Pages deployment, a11y verification

The original design record is `docs/ngx-datetime-picker-design.md`; release notes live in `docs/releases/`.

## Slash commands

- `/pr-review-toolkit:review-pr` — the review gate. Run it per chunk and before marking any task complete, with `.claude/rules/review-gate.md` applied on top.
- `/release <version>` — prepare a release branch: version bump, CHANGELOG, release notes, verification. See `.claude/commands/release.md`.

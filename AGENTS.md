# AGENTS.md

**ngx-datetime-picker** — Angular 22 date / time / datetime / range picker library, published to npm as `@constantine-24/ngx-datetime-picker`, plus a demo app deployed to GitHub Pages.

This file exists for cross-tool compatibility (Codex, Cursor, Aider, Copilot, …). The authoritative guidance for AI agents is **[CLAUDE.md](./CLAUDE.md)** and the rule modules under **[`.claude/rules/`](./.claude/rules/)**. Read them as the source of truth; this file only points at them and must not restate them.

## Project map

- `projects/ngx-datetime-picker/` — the publishable library (core entry `src/`, Temporal secondary entry `temporal/`)
- `src/` — the demo app (consumes only the public API)
- `docs/` — design record and release notes
- `.github/` — CI, GitHub Pages deploy, npm release workflows; issue/PR templates

## Rule modules (project-wide — read all of them)

- [.claude/rules/architecture.md](./.claude/rules/architecture.md) — workspace, entry points, public-API discipline
- [.claude/rules/commands.md](./.claude/rules/commands.md) — build / test / lint / verification gates
- [.claude/rules/code-style.md](./.claude/rules/code-style.md)
- [.claude/rules/angular-components.md](./.claude/rules/angular-components.md) — Angular v22 rules + library conventions
- [.claude/rules/styling.md](./.claude/rules/styling.md)
- [.claude/rules/accessibility.md](./.claude/rules/accessibility.md)
- [.claude/rules/workflow.md](./.claude/rules/workflow.md) — branches, Conventional Commits, TDD, CHANGELOG
- [.claude/rules/review-gate.md](./.claude/rules/review-gate.md) — review process + Required checks
- [.claude/rules/release.md](./.claude/rules/release.md) — semver and the tag-driven npm release

## Area-specific rules (read when working in that directory)

- [projects/ngx-datetime-picker/CLAUDE.md](./projects/ngx-datetime-picker/CLAUDE.md) — library internals, pinned Material internals, gotchas
- [src/CLAUDE.md](./src/CLAUDE.md) — demo app

## Commands & skills

- Release preparation: [.claude/commands/release.md](./.claude/commands/release.md) (Claude Code `/release`) — mirrored as the Codex skill [.agents/skills/release/SKILL.md](./.agents/skills/release/SKILL.md).
- Review: [.claude/rules/review-gate.md](./.claude/rules/review-gate.md) — apply its Required checks with whichever review runner your tool has.

## Enforcement

Rules that are enforced deterministically rather than as prose:

- **ESLint** (`npm run lint`, angular-eslint) and **Prettier** (`npm run format:check`) — both run in CI.
- **Hooks** — `.claude/settings.json` → `.claude/hooks/*`; Codex mirrors them in `.codex/hooks.json` pointing at the same scripts:
  - PreToolUse (Bash): block direct ESLint / Vitest calls — use `ng lint` / `ng test`.
  - PostToolUse (Edit/Write): `prettier --write` the edited file.
- **CI** (`.github/workflows/ci.yml`) — lint, format, type-check, tests, library build, `npm pack` dry run.

## MCP

[`.codex/config.toml`](./.codex/config.toml) registers `context7` (library docs) and `chrome-devtools` (live UI / a11y verification). Claude Code users get the same through their own MCP configuration.

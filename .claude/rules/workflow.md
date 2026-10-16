# Workflow & Version Control

- Use plan mode (or the superpowers brainstorming → writing-plans flow) for multi-file features and API changes, and get the plan approved before implementing. For anything smaller, proceed: make routine judgment calls, state your assumptions in the summary, and stop only when different readings would lead to materially different work.
- Internal plans and specs go to `docs/superpowers/` — it is gitignored on purpose, so don't commit planning artefacts.
- Break large changes into reviewable chunks, and run the review gate (`.claude/rules/review-gate.md`) per chunk.
- Bug fixes: (1) reproduce with a failing test; (2) find the cause; (3) make the smallest safe fix; (4) keep the test; (5) summarise the fix and how you verified it. Cap at 3 investigation passes — if still uncertain, propose a concrete fix with assumptions and a validation plan.

<important if="you are implementing a feature, bug fix, or refactor">

- TDD by default: write a failing spec that captures the behaviour, confirm it fails for the right reason, then make it pass. Use scoped runs during the loop (see `commands.md`).
- Pure refactors: confirm the affected behaviour is covered and green before and after.
- Keep changes to what the task asks. A pre-existing bug or unrelated issue found mid-task is a follow-up in the summary, not a drive-by fix — unless the requested behaviour can't work without it.
- User-visible changes (new input, behaviour change, fix) get a CHANGELOG entry under `## [Unreleased]` in `projects/ngx-datetime-picker/CHANGELOG.md`, in Keep a Changelog sections (Added / Changed / Deprecated / Removed / Fixed / Security).
- Public API or behaviour changes also update `projects/ngx-datetime-picker/README.md` (the npm page) and, if they're showcase-worthy, the demo.
- Prefer targeted edits over whole-file rewrites.
  </important>

<important if="you are creating a branch, commit, or pull request">

- Never commit directly to `main`. Branch names: `feat/…`, `fix/…`, `docs/…`, `chore/…`, `refactor/…`, `test/…`.
- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): summary`, imperative, ≤ 72 chars, with a body explaining _why_. Scopes in use: `picker`, `toggle`, `input`, `range-input`, `time-panel`, `time-input`, `datetime`, `temporal`, `demo`, `lint`, `ci`, `release`, `docs`. Mark breaking changes with `!` and a `BREAKING CHANGE:` footer.
- Bulk-formatting commits are added to `.git-blame-ignore-revs`.
- PRs target `main`. The PR description uses `.github/PULL_REQUEST_TEMPLATE.md`: summary, linked issue, screenshots for UI changes, the gates you ran, CHANGELOG/README updates, breaking-change notes.
- Push and open PRs only when the user asks. Never publish to npm or push tags yourself — releases go through `.claude/rules/release.md`.
  </important>

<important if="you are modifying exported TypeScript interfaces, types, or shared contracts">

- Search for every usage (library, specs, demo, README snippets) and update them in the same change.
  </important>

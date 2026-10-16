---
description: Prepare a library release branch (version bump, CHANGELOG, release notes, verification)
argument-hint: <major|minor|patch|X.Y.Z>
---

# /release $ARGUMENTS

Prepare a release of `@constantine-24/ngx-datetime-picker` following `.claude/rules/release.md`. **Do not publish, tag or push** — the maintainer does that after review.

1. **Preconditions.** `git status --porcelain` is empty and the current branch is an up-to-date `main`. Otherwise stop and report.
2. **Resolve the version.** Read the current `version` from `projects/ngx-datetime-picker/package.json`. If `$ARGUMENTS` is `major` / `minor` / `patch`, compute the next version; if it's an explicit `X.Y.Z`, check that it's greater than the current one. Read `## [Unreleased]` in `projects/ngx-datetime-picker/CHANGELOG.md`:
   - if it's empty, stop — there is nothing to release;
   - if it lists a breaking change (Removed, or a Changed entry that breaks compatibility) but the bump isn't major, stop and ask.
3. **Branch.** `git checkout -b release/vX.Y.Z`.
4. **Bump** `version` in `projects/ngx-datetime-picker/package.json` (only that file).
5. **CHANGELOG.** Move the `[Unreleased]` entries into `## [X.Y.Z] - <today, YYYY-MM-DD>`, leave an empty `## [Unreleased]` with `_Nothing yet._`, and update the compare links at the bottom (`[Unreleased]: …/compare/vX.Y.Z...HEAD`, `[X.Y.Z]: …/compare/v<prev>...vX.Y.Z`).
6. **Release notes.** Write `docs/releases/vX.Y.Z.md`, modelled on the previous file in `docs/releases/`: a one-paragraph summary, highlights, upgrade notes / breaking changes, and a link to the CHANGELOG section.
7. **Verify** with every gate in `.claude/rules/commands.md`: `npm run lint`, `npm run test:ci`, the `tsc` type-check, `npm run build:lib`, `npm run build`, `npm run format:check`, then `(cd dist/ngx-datetime-picker && npm pack --dry-run)`. Report the tarball file list and size.
8. **Commit** with `chore(release): vX.Y.Z`.
9. **Hand-off.** Print the next steps for the maintainer:
   - open a PR `release/vX.Y.Z` → `main` and merge it;
   - `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`;
   - watch the `Release` workflow, which publishes to npm and creates the GitHub Release.

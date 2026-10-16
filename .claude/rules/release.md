# Release

The library is published to npm as **`@constantine-24/ngx-datetime-picker`** by the `release.yml` GitHub Actions workflow when a `v*` tag is pushed. Only the library's version moves; the root `package.json` is the private workspace and stays at `0.0.0`.

<important if="you are preparing, versioning, or publishing a release">

- **Semver.** Breaking change to public API/behaviour → major; new backwards-compatible feature → minor; fix → patch. Angular major upgrades of the peer-dependency range are a major release of this library.
- **Never run `npm publish` or push a tag yourself.** Prepare the release on a branch (use `/release <version>`), and the maintainer merges, tags and pushes.
- Release prep, in one `chore(release): vX.Y.Z` commit on a `release/vX.Y.Z` branch:
  1. Bump `version` in `projects/ngx-datetime-picker/package.json`.
  2. In `projects/ngx-datetime-picker/CHANGELOG.md`, move `[Unreleased]` into `## [X.Y.Z] - YYYY-MM-DD`, leave a fresh empty `[Unreleased]`, and update the compare links at the bottom.
  3. Write `docs/releases/vX.Y.Z.md` (highlights, upgrade notes, breaking changes). The workflow uses it as the GitHub Release body.
  4. `projects/ngx-datetime-picker/LICENSE` is a copy of the root `LICENSE` (ng-packagr can only ship files from inside the project). Keep them identical.
  5. Run every gate in `commands.md`, plus `npm run build:lib && (cd dist/ngx-datetime-picker && npm pack --dry-run)`. Confirm the tarball has `package.json`, `README.md`, `CHANGELOG.md`, `LICENSE`, `fesm2022/` for both entry points and the `.d.ts` files.
- After merge, the maintainer runs `git tag vX.Y.Z && git push origin vX.Y.Z` on `main`. The workflow checks that the tag matches the package version, re-runs the gates, publishes with npm provenance, and creates the GitHub Release.
- Peer-dependency ranges (`@angular/*`, `temporal-polyfill`) change only deliberately, with a CHANGELOG note.
  </important>

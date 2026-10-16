# Commands & Environment

Node: use the version CI uses (`.github/workflows/ci.yml`). Package manager: npm (`packageManager` in `package.json`).

| Script                 | Runs                                         | Use                                            |
| ---------------------- | -------------------------------------------- | ---------------------------------------------- |
| `npm start`            | `ng serve` (demo on `http://localhost:4200`) | Live UI verification                           |
| `npm run build:lib`    | `ng build ngx-datetime-picker`               | ng-packagr build → `dist/ngx-datetime-picker/` |
| `npm run build`        | `ng build` (demo, production)                | Demo bundle                                    |
| `npm run test:ci`      | `ng test --watch=false` (both projects)      | Full suite, single run                         |
| `npm run lint`         | `ng lint` (both projects)                    | ESLint via angular-eslint                      |
| `npm run format:check` | `prettier --check .`                         | Formatting gate (CI runs it)                   |

<important if="you are writing, running, or debugging unit tests">

- Tests run on **Vitest** through the Angular CLI (`@angular/build:unit-test`), in jsdom, zoneless. **Always go through `ng test`** — never `vitest` / `npx vitest` directly (a hook blocks it): the CLI builds the TestBed environment, path aliases and both entry points.
- Scope during the TDD loop. `--include` is relative to the project's `sourceRoot` (`projects/ngx-datetime-picker/src`) and accepts a directory, a spec file, or a glob:
  - `npx ng test ngx-datetime-picker --include lib/toggle --watch=false`
  - `npx ng test ngx-datetime-picker --include "lib/picker/**/*.spec.ts" --watch=false`
  - Temporal adapter specs: `--include "../temporal/src/**/*.spec.ts"`
  - Narrow by test name with `--filter "<regex>"`.
- Pass `--watch=false` explicitly when running non-interactively; otherwise the CLI may start in watch mode.
- Read the `Tests` summary line, not a tailed fragment: `NO_COLOR=1 npx ng test … 2>&1 | grep -E "FAIL|Tests "`.
- Tests that depend on "today" must pin the clock: `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)` (only `Date` — real timers keep `fixture.whenStable()` working). See the top of `ngx-dt-picker.spec.ts`. A spec that clicks calendar cells by index without a pinned date is a time-bomb.
- jsdom compiles no component styles, so style assertions in specs are vacuous. Verify rendered styles in a browser (chrome-devtools MCP) instead.
  </important>

<important if="you have finished a code change and need to verify it">

Run these gates, scoped to what you touched during iteration and in full before a PR:

1. `npm run lint` — 0 errors and 0 warnings. Never call `eslint` directly (a hook blocks it) and never add `eslint-disable` without a written justification on the same line.
2. Scoped `npx ng test … --include … --watch=false`, then `npm run test:ci` before the PR.
3. **Type check.** `ng test` does not type-check. Run `npx tsc -p projects/ngx-datetime-picker/tsconfig.spec.json --noEmit` (specs + sources) — the baseline is **0** errors.
4. **Templates.** `tsc` does not check Angular templates. If you touched a template or a component's inputs, run `npm run build:lib` (and `npm run build` if the demo changed) — that is the only gate that runs the template type-checker.
5. `npm run format:check` (the PostToolUse hook formats edited files, but files written by shell commands are not covered).

For changes that affect what ships (entry points, `package.json`, `ng-package.json`, README, assets), also run `npm run build:lib && (cd dist/ngx-datetime-picker && npm pack --dry-run)` and read the file list.
</important>

<important if="you need to start the dev server or verify UI in a browser">

- Check for a running server first: `curl -s -o /dev/null -w '%{http_code}' http://localhost:4200/`. Reuse it — it HMR-watches this checkout.
- The picker overlay opens one animation frame after the click; a11y snapshots taken immediately read it as closed. Use `evaluate_script` with `requestAnimationFrame`, or the snapshot-mode Lighthouse audit, to inspect an open overlay.
- Lighthouse accessibility (axe-powered) must score **100**. Navigation mode reloads the page and closes overlays; use snapshot mode for the open popup.
  </important>

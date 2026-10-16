# Backlog

Deferred work, newest first. Each item says why it was deferred and what "done" means. Pick an item up on its own branch (`.claude/rules/workflow.md`) and delete it from here in the same PR.

## Dependency updates

Dependabot opened these on 2026-10-16 (PRs #1–#3). It closed them automatically when `main` was force-pushed after the history rewrite. None were merged. Dependabot won't re-propose the exact versions it closed, but it will open new PRs for newer releases.

### Angular 22.0 → 22.2 (was PR #1)

- **What:** `@angular/{cdk,common,compiler,core,forms,material,platform-browser,cli,compiler-cli}` 22.0.2/22.0.3 → 22.2.2, and `ng-packagr` 22.0.0 → 22.2.4. Move `@angular/build` and `angular-eslint` in the same change so the toolchain stays in lockstep.
- **Risk:** the picker depends on two **pinned Material internals** — `MatCalendar (_userSelection)` and `[headerComponent]` (see `projects/ngx-datetime-picker/CLAUDE.md`). A Material minor can change them silently.
- **Done when:** all gates in `.claude/rules/commands.md` pass, especially the range and dual-calendar integration specs; the demo's Lighthouse accessibility score stays at 100; and the overlay, range selection and dual calendars are checked by hand in the demo. The library's peer range (`^22.0.0`) doesn't change, so no release is needed beyond the next regular one.

### Dev tooling group (was PR #2)

- **`typescript-eslint` 8.71.0 → 8.71.2:** a patch. Take it with any other change.
- **`prettier` 3.8 → 3.9:** a minor, which may change formatting. Run `npm run format` in a separate `style:` commit and add that commit to `.git-blame-ignore-revs`.
- **`jsdom` 28 → 30:** a major in the unit-test environment. Run the full suite. Watch focus, overlay and `matchMedia` behaviour (the demo's theme toggle already guards `matchMedia`).
- **`typescript` 6.0 → 7.0 — blocked.** Angular 22.2's `@angular/compiler-cli`, `ng-packagr` and `typescript-eslint` all declare `typescript >=6.0 <6.1`. Wait for an Angular release that supports TS 7. Until then, consider adding a Dependabot `ignore` rule for TypeScript majors so the update doesn't keep coming back.

### `temporal-polyfill` 0.3.2 → 1.0.x (was PR #3)

- **What:** Dependabot proposed 1.0.5; `latest` is now 1.0.6. The 1.0 line is actively maintained (1.0.1 shipped in June 2026). The `1.0.0` published in 2021 is an old outlier, so this is a real major upgrade of the same `fullcalendar/temporal-polyfill` project.
- **Why it's not a plain bump:** `temporal-polyfill` is a **peer dependency of the published library** (`^0.3.0`), and the `/temporal` adapters import it. Changing the peer range is a public-contract change (`.claude/rules/release.md`).
- **Plan:**
  1. Read the 0.3 → 1.0 changelog.
  2. Run the adapter and picker specs against 1.0.x.
  3. If both lines work, widen the peer to `^0.3.0 || ^1.0.0` in a **minor** release, with a CHANGELOG note.
  4. If 1.0 breaks 0.3 compatibility, move to `^1.0.0` in a **major** release.
- **Related:** the follow-up to use native `Temporal` when the browser provides it, which would make the polyfill truly optional.

## Library follow-ups

Found during the 2026-10-16 publish prep. Each one changes library behaviour or typing, so each gets a CHANGELOG entry.

### Use native `Temporal` when the browser provides it

- **What:** the `/temporal` adapters import `Temporal` from `temporal-polyfill` unconditionally (`grep -n "temporal-polyfill" projects/ngx-datetime-picker/temporal/src/*.ts`). So the polyfill is always bundled, and it's required, even in browsers that ship `Temporal` natively.
- **Open questions:** do native and polyfill `Temporal` objects interoperate inside the adapters (`instanceof`, `compare`, `from`)? How do we avoid a static import of the polyfill — an injectable `Temporal` implementation in the `provideTemporal*Adapter()` options, or a separate entry point?
- **Done when:** the polyfill is genuinely optional where native `Temporal` exists. The adapter specs run against both implementations. The README, release notes and `peerDependenciesMeta` say exactly what's needed. This is a minor release if it's additive. Related to the `temporal-polyfill` 1.x item above.

### Typed `dateFilter` / `timeFilter` predicates don't compile with a shared `#picker` ref

- **What:** the filters are typed `(date: D) => boolean` (`ngx-dt-picker.ts`, `dateFilter` / `timeFilter` inputs). A predicate typed `(date: Temporal.PlainDate)` pins the picker to `NgxDtPicker<PlainDate>`. That ref no longer fits `<ngx-dt-toggle [for]>`, which takes `NgxDtPicker` (that is, `<unknown>`). In `datetime` mode, `D` gets inferred from whichever filter is bound. Consumers have to write `(date: unknown) => (date as Temporal.PlainDate)…`, as the demo and README snippets do today.
- **Ideas:** let the toggle accept a narrow structural interface (it only needs open/close state, disabled and the panel id), so any `NgxDtPicker<D>` fits. Type the filters by the part they actually receive (the date part for `dateFilter`, the time part for `timeFilter`) rather than by `D`.
- **Done when:** a consumer can write `weekdaysOnly = (date: Temporal.PlainDate) => date.dayOfWeek <= 5` with a shared `#picker` ref, and it compiles under `strictTemplates`. The `unknown` workaround and its comments are gone from the demo, the playground's snippet generator and the README. Any typing change must widen, never narrow, what compiles today (`.claude/rules/architecture.md`).

### Variant-aware default accessible name for the panel

- **What:** `ariaLabel` defaults to `'Choose a date'` for every variant (`ngx-dt-picker.ts`, `ariaLabel` input). So a time or datetime-range overlay is announced as "Choose a date".
- **Done when:** if the consumer doesn't set `ariaLabel`, the default follows `type`: "Choose a time", "Choose a date and time", "Choose a date range" and "Choose a date and time range". An explicit `ariaLabel` still wins. There's a spec per variant, and a CHANGELOG `Fixed` entry (the accessible name changes, so mention it in the release notes).

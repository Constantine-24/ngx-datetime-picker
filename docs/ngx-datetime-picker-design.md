# Plan: `ngx-datetime-picker` — configurable Angular date/time/range picker

> Design/brainstorm output. Date: 2026-06-20. **Revised 2026-06-20 after review:** locked the timezone and actions/presets scope; added the forms/validation contract, Temporal-parsing & timezone notes, picker outputs, action footer, SSR/zoneless and a11y details; corrected the range hover-preview API.

## Context

The user wants a **configurable Angular date & time picker library** that presents five variants from one cohesive API: **date**, **date-range**, **datetime**, **datetime-range**, and **time**. It must be built on `@angular/cdk`, **reuse `@angular/material` primitives** (the accessible calendar grid + the `DateAdapter` date abstraction) rather than reinventing them, and support a **modern date API** (TC39 Temporal).

The repo is currently a clean **Angular 22** single-app workspace (TypeScript 6, RxJS 7.8, **Vitest**, Prettier; no ESLint). Neither `@angular/cdk` nor `@angular/material` is installed, and there is no date/time code — a green field. Project conventions (`.claude/CLAUDE.md`) require standalone components, signals, `input()`/`output()`, native control flow, **Signal Forms preferred**, host bindings via the `host` object, and **WCAG AA / AXE compliance**.

### Decisions locked during brainstorming
- **Reuse strategy:** Reuse Material's `MatCalendar` + `DateAdapter` (+ `MatFormFieldControl`); build our own input/overlay/time/datetime/range shell on CDK.
- **Date model:** Adapter-agnostic (`DateAdapter<D>`); ship a **TC39 Temporal adapter as the flagship default**; native `Date` works out of the box; Luxon/date-fns supported via Material's existing adapters.
- **Packaging:** Publishable **ng-packagr library** at `projects/ngx-datetime-picker`; current app becomes the **demo/dev harness**.
- **Public API:** **Material-style directive composition** (input directive + picker + toggle wired by template ref); **two-input** container for ranges.
- **Forms:** Support **both** `ControlValueAccessor` (Reactive/`ngModel`/template) **and** Signal Forms.
- **Range UX:** **Dual calendar + two inputs** by default (configurable to single month).
- **Time UX:** **Stepper inputs** by default (custom); optional "list" mode can reuse `MatTimepicker`.
- **Display:** **Overlay popup (default) + inline** mode.
- **Naming:** prefix **`ngx-dt`**, package **`ngx-datetime-picker`**.
- **Timezone model:** **wall-clock / zone-naive v1** (Temporal `PlainDate`/`PlainDateTime`/`PlainTime`), matching Material's zone-naive `DateAdapter`. Instant/zone conversion is the consumer's documented responsibility. The generic `DateAdapter<D>` is the seam: a `ZonedDateTime` adapter can ship later as its own entry point with no breaking change. (Avoids DST gap/overlap complexity in the time stepper.)
- **Actions & presets:** ship a built-in **action footer** (Apply/Cancel — required for datetime confirm — plus Clear and Today/Now) **and a content-projection seam** (mirrors `<mat-datepicker-actions>`) for custom footers / preset ranges. A built-in preset *list* (`[presets]`) is **deferred to post-v1**.

## Architecture

```
                          ┌─────────────────────────────┐
  <mat-form-field>        │  <ngx-dt-picker type="...">  │  ← overlay or inline
    [ngxDtInput] ─────────┤  orchestrates value + panels │
    <ngx-dt-toggle>       │  type ∈ date|datetime|time|  │
                          │       date-range|datetime-range
                          └──────┬───────────────┬───────┘
                                 │               │
                      ┌──────────▼──────┐  ┌─────▼─────────────┐
                      │ NgxDtCalendar   │  │ NgxDtTimePanel    │
                      │ (1–2 MatCalendar│  │ (custom steppers; │
                      │  + range model) │  │  optional MatTime │
                      └──────────┬──────┘  │  listbox mode)    │
                                 │         └───────────────────┘
                          DateAdapter<D> (Temporal default / native / Luxon / date-fns)
```

**Data flow:** input directive parses text → `DateAdapter` → value signal on the picker → feeds `MatCalendar.selected` (single `D` or `DateRange<D>`) and/or the time panel → user selection flows back through a range strategy / selection model → picker writes value → CVA / Signal Form + formatted input text. Datetime combines calendar (date part) + time panel (time part) into one `D` via adapter helpers.

## Workspace & packaging

- Add deps: `@angular/cdk@22`, `@angular/material@22` (peer deps of the lib). Optional deps: `temporal-polyfill` (only the temporal entry point), `luxon`, `date-fns`.
- `ng generate library ngx-datetime-picker` → `projects/ngx-datetime-picker`. Register the project in **`angular.json`**; keep root app as demo.
- **Secondary entry points** for tree-shaking: core stays adapter-agnostic; `ngx-datetime-picker/temporal` ships the Temporal adapter + `provideTemporalAdapter()` (pulls `temporal-polyfill`). Native `Date` needs no extra entry point (uses Material's `provideNativeDateAdapter()`).
- Configure **Vitest** for the library project (mirror the app's `@angular/build:unit-test` setup).

## Public API (selectors, `ngx-dt` prefix)

- `[ngxDtInput]` — single-value input directive; parse/format via `DateAdapter`; implements `ControlValueAccessor` **and** `MatFormFieldControl<D>`; registers with the picker.
- `<ngx-dt-date-range-input>` with `[ngxDtStartDate]` / `[ngxDtEndDate]` — two-input range container (mirrors `MatDateRangeInput`); group-level `MatFormFieldControl`.
- `<ngx-dt-picker type="date|datetime|time|date-range|datetime-range" [inline]>` — overlay/inline panel host.
- `<ngx-dt-toggle [for]="picker">` — trigger button with correct ARIA + focus management.
- Config tokens: `NGX_DT_DEFAULT_OPTIONS` (defaults), `NGX_DT_FORMATS` (parse/display, layered on `MAT_DATE_FORMATS`).
- Common inputs surfaced on picker/inputs: `min`, `max`, `dateFilter`, `startView`, `startAt`, `disabled`, `touchUi`, time options (`showSeconds`, `hourCycle` 12/24, `minuteStep`), range options (`monthsToDisplay` 1–2).
- **Outputs:** `openedChange`/`opened`/`closed`, `valueChange` (parsed `D` / `DateRange<D>`), and calendar passthroughs `monthSelected`/`yearSelected`/`viewChanged` (so consumers can build custom headers or restrict navigation).
- **Forms integration — three *distinct* contracts on the input/range-input directives** (a deliberate choice, not free):
  - `ControlValueAccessor` — Reactive Forms / `ngModel`.
  - **Signal Forms** — does **not** use CVA; implement the `FormValueControl<D>` interface (`value = model<D>()` plus `errors`/`disabled`/`touched` signals), bound via `[control]`. Separate surface from CVA.
  - `MatFormFieldControl<D>` — `<mat-form-field>` label/hint/error projection. All three coexist (mirrors how Material splits them across `MatInput` + the datepicker input).
- **Validation:** input registers `NG_VALIDATORS` for `min`/`max`/`dateFilter` and a **parse** error; range adds start/end-invalid and **order** (`end ≥ start`); datetime-range adds same-day `end-time > start-time`. Unparseable text → value `null` + parse error (Material convention). Equivalent rules exposed as a Signal Forms schema validator.
- **Action footer:** built-in Apply/Cancel (Apply required for datetime confirm), Clear, Today/Now; plus a projected-content slot for custom footers / preset ranges.

## Reuse (existing APIs — do NOT reinvent)

`MatCalendar`, `DateRange<D>`, `MatRangeDateSelectionModel`, `MAT_DATE_RANGE_SELECTION_STRATEGY`, `DefaultMatCalendarRangeStrategy`, `DateAdapter<D>`, `MAT_DATE_FORMATS`, `MAT_DATE_LOCALE`, `provideNativeDateAdapter()`, `MatFormFieldControl`, and CDK: `Overlay`/`CdkConnectedOverlay`/`FlexibleConnectedPositionStrategy`, `A11yModule` (`cdkTrapFocus`, `LiveAnnouncer`, `ActiveDescendantKeyManager`/`FocusKeyManager`), `Portal`/`CdkPortal`, `Directionality` (RTL). **Optional:** `MatTimepicker` for the alternate listbox time mode.

## Phased implementation (each phase TDD with Vitest + a11y check)

- **Phase 0 — Workspace:** install cdk+material, generate library, wire `angular.json`, add `mat.theme()` to the demo's global styles, scaffold secondary entry points, Vitest config. Establish a **zoneless + SSR** baseline (lib ships no zone.js; no eager `now()`).
- **Phase 1 — Foundations:** `DateAdapter` wiring + tokens + `NGX_DT_DEFAULT_OPTIONS`; **Temporal adapter** (`Temporal.PlainDate` for date, `PlainDateTime` for datetime, `PlainTime` helpers for time) implementing all abstract `DateAdapter` methods + `provideTemporalAdapter()`. **Parsing is the hard part** — Temporal has no locale/format parser, so define the strategy here (ISO via `Temporal.*.from()` + an `Intl.DateTimeFormat().formatToParts()` reverse-map or a documented input mask); display via `Intl.DateTimeFormat`. CDK overlay service (positioning, focus trap, backdrop/Esc, RTL); base `<ngx-dt-picker>` shell.
- **Phase 2 — Date picker (`type=date`):** `[ngxDtInput]` (CVA + `MatFormFieldControl` + Signal Forms `FormValueControl`) + single `MatCalendar` + `<ngx-dt-toggle>`; overlay + inline. Register `min`/`max`/`dateFilter`/parse **validators**; define parse-failure value semantics (`null` + error).
- **Phase 3 — Date range (`type=date-range`):** dual `MatCalendar` (synced months) + `NgxDtRangeSelectionStrategy` (provided via `MAT_DATE_RANGE_SELECTION_STRATEGY`) + `MatRangeDateSelectionModel`; `<ngx-dt-date-range-input>` two-input container; **hover preview via the strategy's `createPreview()`** (drives the calendar's internal preview range). NOTE: `comparisonStart`/`comparisonEnd` are a *separate* read-only comparison-range feature — out of scope v1. Add `end ≥ start` validation.
- **Phase 4 — Time picker (`type=time`):** custom `NgxDtTimePanel` stepper UI (hours/minutes/optional seconds, 12/24h, minute step, keyboard ↑/↓ + type-to-set, `LiveAnnouncer`); locale-aware `hourCycle` default; time value handling.
- **Phase 5 — Datetime + datetime-range:** compose calendar + time panel; combined `D` (and `DateRange<D>`) value; **action footer (Apply/Cancel/Clear/Now) + projected-content seam**; time carried across date changes. **min/max must constrain the time panel on boundary dates** (e.g. `min = today 14:00` disables earlier times today); datetime-range same-day `end-time > start-time`.
- **Phase 6 — Polish:** full AXE/keyboard/focus-trap/screen-reader pass; RTL; `prefers-reduced-motion` for overlay animation; **≥24px target size** (WCAG 2.5.8) on stepper buttons; SSR/zoneless smoke test; expose `--mat-sys-*`-driven theming for custom parts (time stepper, range inputs, toggle); optional `MatTimepicker` list mode; demo page per variant; README (incl. value-prop vs `MatDatepicker`+`MatTimepicker`, timezone/conversion guidance) + API docs.

## Critical files

- **New library:** `projects/ngx-datetime-picker/src/lib/**` (picker, input, range-input, toggle, calendar-panel, time-panel, overlay service, range strategy, tokens) and `projects/ngx-datetime-picker/{temporal}/` entry points; `public-api.ts`, `ng-package.json`.
- **Workspace:** `angular.json` (register library + its Vitest target), root `package.json` (deps), `tsconfig.json` (path mappings for entry points).
- **Demo:** `src/styles.scss` (`mat.theme()`), `src/app/app.routes.ts` + one lazy demo page per variant, `src/app/app.html`.

## Risks / to validate during implementation

- **Temporal has no format-based parser** (highest implementation risk) → `Temporal.*.from()` only accepts ISO-8601; `Intl.DateTimeFormat` formats but cannot parse. The adapter's `parse(value, format)` needs a custom strategy (`formatToParts` reverse-map or a documented input mask). Prototype and test this early in Phase 1.
- **Timezone scope is wall-clock only (v1)** → `PlainDateTime` is zone-naive; DST gaps/overlaps are not modeled. Document conversion responsibility; keep `DateAdapter<D>` generic as the seam for a future `ZonedDateTime` adapter.
- **datetime min/max ↔ time-panel coupling** is subtle: boundary-date times must be constrained, and same-day datetime-ranges need `end-time > start-time`. Cover with dedicated Phase 5 tests.
- **Three form contracts on one directive** (CVA + Signal Forms `FormValueControl` + `MatFormFieldControl`) → verify they coexist without value-sync races; test each independently.
- **Standalone `MatCalendar` range mode** partially relies on the internal `_userSelection` output → encapsulate behind our strategy/selection model, **pin Material version**, cover with integration tests; fallback is driving selection purely via the strategy + `MatRangeDateSelectionModel.selectionChanged`.
- **Temporal needs a polyfill** (Safari/mobile lack native support mid-2026) → ship `temporal-polyfill` (~20 KB gz) only in the temporal entry point; document. Re-measure pinned polyfill size.
- **Material M3 theming required** for `MatCalendar` to render → demo includes `mat.theme()`; document for consumers; custom parts consume `--mat-sys-*` tokens so they auto-match the host theme.
- **`MatTimepicker` is a listbox, not a stepper** → stepper is custom; Material's component is reuse-only for the optional list mode.
- **Native `Date` adapter has no format-based parsing** (uses `Date.parse`) → inherits Material's limitation; document, and recommend Temporal/Luxon/date-fns where strict parsing matters.

## Verification

- **Unit:** Vitest per component/adapter (`npm test`); adapter conformance tests against the abstract `DateAdapter` methods (incl. round-trip parse↔format for the Temporal adapter); range-strategy + selection-model integration tests; validator tests (min/max/filter/parse/range-order/same-day-time).
- **Accessibility:** AXE (axe-core in jsdom and/or chrome-devtools-mcp a11y skill on the demo); verify keyboard nav, focus trap, `aria-live` announcements, color contrast (WCAG AA), reduced-motion, and ≥24px target sizes.
- **Forms:** demo exercises Reactive Forms, `ngModel`, **and Signal Forms** for each variant; assert validation errors surface in all three.
- **SSR / zoneless:** build/serve the demo with SSR and without zone.js; confirm no eager `now()`/`document` access and that overlays hydrate cleanly.
- **Library build:** `ng build ngx-datetime-picker` (ng-packagr) succeeds; confirm secondary entry points resolve and unused adapters/polyfill tree-shake out.
- **Manual/visual:** `npm start`, one demo page per variant; screenshot via chrome-devtools MCP to confirm overlay positioning, dual-calendar range highlight, and stepper time panel.

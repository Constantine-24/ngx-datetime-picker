# Changelog

All notable changes to **ngx-datetime-picker** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

_Nothing yet._

## [1.0.0] - 2026-10-16

First public release: a configurable Angular date & time picker built on
`@angular/cdk` and `@angular/material` primitives, adapter-agnostic with a TC39
**Temporal** adapter as the flagship default.

### Added

#### Pickers

- **Five variants** from one `<ngx-dt-picker [type]>` component: `date`,
  `date-range`, `time`, `datetime`, and `datetime-range`.
- **Overlay (default) and inline** display modes. The overlay is a CDK
  `cdkConnectedOverlay` with flexible positioning, optional backdrop, and
  Escape-to-close; the inline panel renders always-visible.
- **`<ngx-dt-toggle [for]>`** — a trigger button with correct ARIA and focus
  management, usable as a `matSuffix` inside `mat-form-field`.
- Two-way **`value`** (`D | null`) and **`range`** (`DateRange<D> | null`)
  models, plus **`opened`** / **`closed`** / **`openedChange`** outputs.
- Configurable inputs: `min`, `max`, `startAt`, `startView`, `disabled`,
  `hasBackdrop`, `restoreFocus`, and `ariaLabel`.
- **`NGX_DT_DEFAULT_OPTIONS`** injection token (with the `NgxDtDefaultOptions`
  type) for app-wide overlay defaults.

#### Date adapters

- **Adapter-agnostic core** built on Material's `DateAdapter<D>` and
  `MatCalendar` — works with any `DateAdapter` (including Material's native
  `Date`, Luxon, and date-fns adapters).
- **Flagship Temporal adapter** in the `@constantine-24/ngx-datetime-picker/temporal` secondary
  entry point: `TemporalDateAdapter` (`Temporal.PlainDate`), `TemporalTimeAdapter`
  (`Temporal.PlainTime`), and `TemporalDateTimeAdapter` (`Temporal.PlainDateTime`),
  with `provideTemporalDateAdapter()`, `provideTemporalTimeAdapter()`,
  `provideTemporalDateTimeAdapter()`, and `NGX_DT_TEMPORAL_DATE_FORMATS`.
- `temporal-polyfill` is an **optional** peer dependency, isolated to the
  secondary entry point so it tree-shakes away for consumers who do not use it.

#### Forms integration

- Every input directive is **both a `ControlValueAccessor` and a validator**,
  compatible with **Reactive Forms**, **`ngModel`**, and **Signal Forms**
  (`[formField]`).
- Single-value inputs: `[ngxDtInput]`, `[ngxDtTimeInput]`, `[ngxDtDateTimeInput]`.
- Range wrappers: `<ngx-dt-date-range-input>` (with `ngxDtStartDate` /
  `ngxDtEndDate`) and `<ngx-dt-datetime-range-input>` (with `ngxDtStartDateTime` /
  `ngxDtEndDateTime`).
- Validation error keys — single inputs: `ngxDtParse`, `ngxDtMin`, `ngxDtMax`,
  `ngxDtFilter`; range inputs add `ngxDtRangeStart`, `ngxDtRangeEnd`, and
  `ngxDtRangeOrder`.

#### Time

- **Custom stepper time panel** (`NgxDtTimePanel`): hours, minutes, and optional
  seconds; 12-/24-hour display via `hourCycle` (locale-derived when unset);
  `minuteStep`; and `showSeconds`.
- Full **spinbutton keyboard support** — Arrow Up/Down, Home, End, Page Up/Page
  Down, and type-to-set — with value announcements via CDK `LiveAnnouncer`.

#### Ranges & datetime

- **Dual synced calendars** (`monthsToDisplay="2"`) for the range variants,
  driven by Material's range selection strategy and selection model.
- **Datetime composition** — the calendar supplies the date part and the time
  panel the time part, combined into a single value, with **Now** / **Clear**
  actions and `min`/`max` clamping that respects same-day boundaries.
- **Datetime ranges** with independent start/end time panels and same-day
  start ≤ end clamping.
- **`dateFilter`** / **`timeFilter`** predicates to disable individual dates and
  time steps; honored by both the panels and input validation.
- **Draft mode** (`draftMode`) — buffers edits in the overlay until **Apply**;
  **Cancel**, Escape, or a backdrop click discards them.

#### Accessibility, theming & i18n

- Overlay rendered with `role="dialog"` and `aria-modal="true"`, CDK focus trap,
  Escape-to-close, and focus restoration to the trigger (`restoreFocus`).
- **WCAG AA** color contrast; passes AXE checks.
- **Theming via `--mat-sys-*` tokens** that auto-match the host `mat.theme()`.
  The picker panel paints its own Material 3 surface (background, elevation,
  rounded corners) because it uses `MatCalendar` bare.
- **`prefers-reduced-motion`** is honored (transitions/animations disabled).
- **RTL** support via CDK `Directionality`.

#### Packaging

- Two entry points (`@constantine-24/ngx-datetime-picker` core and `@constantine-24/ngx-datetime-picker/temporal`),
  `sideEffects: false`, shipped with TSDoc and a full README.

### Compatibility

- **Angular**, **`@angular/cdk`**, and **`@angular/material`** `^22.0.0` (peer
  dependencies).
- **`temporal-polyfill`** `^0.3.0` — optional; only needed where native
  `Temporal` is unavailable.

### Known limitations

- **Dual-calendar keyboard navigation** (`monthsToDisplay="2"`): each
  `MatCalendar` keeps its own internal month state, so arrow-key navigation past
  a month edge moves only that calendar, independently of the shared prev/next
  header. Use the header buttons to move both months together. This is a
  structural constraint of the underlying `MatCalendar`.

[Unreleased]: https://github.com/Constantine-24/ngx-datetime-picker/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/Constantine-24/ngx-datetime-picker/releases/tag/v1.0.0

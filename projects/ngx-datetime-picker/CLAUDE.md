# Library internals — `projects/ngx-datetime-picker`

Read this before changing the picker, the inputs or the adapters. The public contract is `src/public-api.ts` + `temporal/src/public-api.ts`; the consumer docs are `README.md` (this is the npm page — ng-packagr copies it into `dist/`).

## Seams

- **One picker, five variants.** `NgxDtPicker<D>` switches on `type` (`date` | `date-range` | `time` | `datetime` | `datetime-range`). Variant-specific computeds gate on `isTime()` / `isDateTime()` / `calendarRangeMode()` and fall through to the plain-date path, so a change for one variant must not alter another — add a spec for each variant you touch.
- **Input seams.** Single-value inputs register with the picker through `NgxDtPickerInput<D>` (`registerInput`), and range containers through `NgxDtPickerRangeInput<D>`. The picker reads the input's value for `[selected]` and writes back via `setValueFromPicker` / `setRangeFromPicker`. The overlay anchor precedence is: explicit origin → registered single input → registered range input → previous origin.
- **Parallel siblings, on purpose.** `NgxDtInput` / `NgxDtTimeInput` / `NgxDtDateTimeInput` don't share a base class, and neither do `NgxDtDateRangeInput` / `NgxDtDateTimeRangeInput`. They differ in adapter, compare method, error keys and selector. Reviewers flag the duplication; it's accepted. Revisit only if a fourth variant appears.
- **Adapters.** Dates use Material's `DateAdapter<PlainDate>`. Times use the library's own calendar-free `NgxDtTimeAdapter<T>` (a `DateAdapter<PlainTime>` would have to fake ~20 calendar methods). Datetimes use the `NgxDtDateTimeAdapter<DT, D, T>` bridge (`getDate` / `getTime` / `combine`, plus concrete `withDate` / `withTime` / `clampDateTime` / `compareTime`). `provideTemporalDateTimeAdapter()` is a superset of the date and time providers.
- **Single-generic type bridge.** In datetime modes `D` = `PlainDateTime`, while the calendar runs the `PlainDate` adapter and the panel the `PlainTime` adapter. Bridge with documented `as unknown as D` casts only at those template seams.
- **Optional DI.** `DateAdapter`, the datetime bridge and `Directionality` are injected `{ optional: true }`. The range selection strategy is resolved lazily through `injector.get(MAT_DATE_RANGE_SELECTION_STRATEGY)` — resolving it eagerly would instantiate `DefaultMatCalendarRangeStrategy` (which needs `DateAdapter`) and break time-only apps.

## Pinned Material internals (verified on Material 22.0.x and 22.2.3)

These are deliberate dependencies on non-public Material API, each covered by integration specs so a Material upgrade fails loudly. Check them first on every Angular Material bump:

- `MatCalendar` `(_userSelection)` — the raw clicked date for range mode. The picker applies `MAT_DATE_RANGE_SELECTION_STRATEGY.selectionFinished()` itself; the calendar never writes its own `selected`, so the strategy runs exactly once.
- `MatCalendar` `[headerComponent]` with the empty `NgxDtEmptyCalendarHeader` — dual calendars (`monthsToDisplay=2`) hide each calendar's header and share one picker-owned header. The two `<mat-calendar>`s are recreated through `@for (…; track m.key)` on month change, because `activeDate` can't be driven from outside after init.
- `MatCalendar` inputs are classic getter/setter `@Input`s (not signal inputs). `selected` takes `DateRange<D> | D | null`.

## Behaviour contracts worth knowing

- **Datetime is immediate-commit** and never auto-closes. The footer has Now / Clear / Done. With `draftMode`, the footer shows Cancel / Apply instead of Done; edits buffer in `_draftValue` / `_draftRange` until Apply, and closing by any route (Escape, backdrop, Cancel) discards them. Draft mode is overlay-only.
- **Same-day range order** is enforced twice. The time panels cross-clamp (start ceiling = end time, end floor = start time, on a shared day), and the `ngxDtRangeOrder` validator is the backstop for typed input.
- **Min/max on datetimes.** `clampDateTime` in the handlers is the value backstop. The panel's `[min]` / `[max]` (via `boundaryTime`, set only on the bound's own day) is UX. Because the backstop masks the panel bound in value-level tests, test the computed itself (`timePanelMin` / `timePanelMax`) through a typed view of the protected member.
- **Hour cycle.** `resolveHourCycle(explicit, locale)` in `util/` drives both the panel and the inputs' formatting. An explicit `hourCycle` wins; otherwise it follows the locale (en-US → 12h, en-GB → 24h). Specs that assert 24h output must pin `[hourCycle]="24"`, because the test locale is en-US.
- **`withTime(null)`** anchors a time stepped before any date to today. This is intentional parity between single and range datetimes, so keep it.

## Testing notes

- Specs are zoneless. `fixture.whenStable()` after interactions; the overlay renders one animation frame after open.
- Pin "today" in any spec that clicks calendar cells by index (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`).
- `*.forms.spec.ts` = Reactive / ngModel / Signal Forms parity. `*.validators.spec.ts` = error keys.
- When a CVA re-validates, `updateValueAndValidity()` re-emits `valueChanges`. Assert emission de-duplication on the directive's own output, not on the form control's `valueChanges`.

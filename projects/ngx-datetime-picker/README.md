# ngx-datetime-picker

A configurable Angular date & time picker library built on `@angular/cdk`, reusing
`@angular/material` primitives (`MatCalendar`, `DateAdapter`). Adapter-agnostic, with a
TC39 **Temporal** adapter as the flagship default.

> **Status:** Foundation only. This first release ships the workspace and a fully tested
> `DateAdapter<Temporal.PlainDate>`. The picker components (date, date-range, datetime,
> datetime-range, time) land in subsequent releases.

## Entry points

| Import | Contents |
| --- | --- |
| `ngx-datetime-picker` | Adapter-agnostic core (components — coming soon) |
| `ngx-datetime-picker/temporal` | `TemporalDateAdapter`, `provideTemporalDateAdapter()`, `NGX_DT_TEMPORAL_DATE_FORMATS` |

The Temporal adapter lives in a secondary entry point so the `temporal-polyfill` runtime
tree-shakes away for consumers who don't use it.

## Installation

```bash
npm install ngx-datetime-picker @angular/material @angular/cdk temporal-polyfill
```

`temporal-polyfill` is an **optional** peer dependency — only required where native
`Temporal` is unavailable (e.g. Safari, mid-2026).

## Usage

Provide the Temporal adapter app-wide; it satisfies Material's `DateAdapter` and
`MAT_DATE_FORMATS`, so any Material datepicker primitive (e.g. `MatCalendar`) works with
zone-naive `Temporal.PlainDate` values:

```ts
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';

export const appConfig: ApplicationConfig = {
  providers: [
    provideTemporalDateAdapter(),
    // ...
  ],
};
```

```ts
import { MatCalendar } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';

@Component({
  selector: 'app-example',
  imports: [MatCalendar],
  template: `<mat-calendar [selected]="selected()" (selectedChange)="selected.set($event)" />`,
})
export class Example {
  protected readonly selected = signal<Temporal.PlainDate | null>(null);
}
```

`provideTemporalDateAdapter(formats?)` accepts an optional `MatDateFormats` override;
the default is `NGX_DT_TEMPORAL_DATE_FORMATS`.

## The adapter

`TemporalDateAdapter` implements Material's abstract `DateAdapter<Temporal.PlainDate>`:

- **Locale-aware** month/weekday/date names and first-day-of-week via `Intl`.
- **Parsing** — ISO-8601 fast path plus an `Intl`-derived locale-numeric fallback
  (Temporal has no format-based parser); unparseable input yields an invalid-date
  sentinel so forms surface a parse error rather than silently nulling.
- **Zone-naive** by design (`PlainDate`); timezone-aware types are a future addition.

## Building & testing

This is an Angular CLI workspace using the Vitest unit-test builder.

```bash
ng build ngx-datetime-picker                 # ng-packagr build (both entry points)
ng test ngx-datetime-picker --watch=false    # Vitest
```

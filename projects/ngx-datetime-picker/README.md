# ngx-datetime-picker

[![npm](https://img.shields.io/npm/v/@constantine-24/ngx-datetime-picker?color=0b57d0)](https://www.npmjs.com/package/@constantine-24/ngx-datetime-picker)
[![CI](https://github.com/Constantine-24/ngx-datetime-picker/actions/workflows/ci.yml/badge.svg)](https://github.com/Constantine-24/ngx-datetime-picker/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@constantine-24/ngx-datetime-picker)](https://github.com/Constantine-24/ngx-datetime-picker/blob/main/LICENSE)

Date, date range, time, datetime and datetime range pickers for **Angular 22**, built on `@angular/cdk` and `@angular/material` primitives. Adapter-agnostic core with a TC39 **Temporal** adapter as the flagship default. Accessible (WCAG 2.2 AA), RTL-ready, and compatible with Reactive Forms, `ngModel` and Signal Forms.

**[Live demo & playground →](https://constantine-24.github.io/ngx-datetime-picker/)**

![ngx-datetime-picker demo](https://raw.githubusercontent.com/Constantine-24/ngx-datetime-picker/main/docs/images/demo.png)

---

## Entry points

| Import                                         | Contents                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@constantine-24/ngx-datetime-picker`          | Components (`NgxDtPicker`, `NgxDtToggle`, `NgxDtInput`, `NgxDtDateRangeInput`, `NgxDtStartDate`, `NgxDtEndDate`, `NgxDtTimePanel`, `NgxDtTimeInput`, `NgxDtDateTimeInput`, `NgxDtDateTimeRangeInput`, `NgxDtStartDateTime`, `NgxDtEndDateTime`), abstract adapters (`NgxDtTimeAdapter`, `NgxDtDateTimeAdapter`), token `NGX_DT_DEFAULT_OPTIONS` + `NgxDtDefaultOptions` type, types (`NgxDtPickerType`, `NgxDtOrigin`, `NgxDtPickerInput`, `NgxDtPickerRangeInput`), and a re-export of `DateRange` from `@angular/material/datepicker`. |
| `@constantine-24/ngx-datetime-picker/temporal` | `provideTemporalDateAdapter()`, `provideTemporalTimeAdapter()`, `provideTemporalDateTimeAdapter()`, the concrete adapter classes, and `NGX_DT_TEMPORAL_DATE_FORMATS`.                                                                                                                                                                                                                                                                                                                                                                    |

The Temporal adapter lives in a secondary entry point, so apps that bring their own adapter never pull in `temporal-polyfill`.

---

## Installation

```bash
npm install @constantine-24/ngx-datetime-picker @angular/material @angular/cdk temporal-polyfill
```

`temporal-polyfill` is required by the `/temporal` entry point — the Temporal adapters import it. It is marked as an optional peer dependency only so that apps using the core with their own adapter don't have to install it.

The host app also needs an Angular Material M3 theme (`mat.theme()`, see [Theming](#theming)); `ng add @angular/material` sets one up.

---

## Providers

Choose the provider that matches your variant. Import from `@constantine-24/ngx-datetime-picker/temporal`.

| Variant(s)                   | Provider                           |
| ---------------------------- | ---------------------------------- |
| `date`, `date-range`         | `provideTemporalDateAdapter()`     |
| `time`                       | `provideTemporalTimeAdapter()`     |
| `datetime`, `datetime-range` | `provideTemporalDateTimeAdapter()` |

`provideTemporalDateTimeAdapter()` is a **superset** that composes the date adapter, the time adapter, and the bridge between them. Use it for both datetime variants.

Each provider accepts an optional `MatDateFormats` override; the defaults are `NGX_DT_TEMPORAL_DATE_FORMATS`.

```ts
// app.config.ts
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';

export const appConfig: ApplicationConfig = {
  providers: [
    provideTemporalDateAdapter(),
    // ...
  ],
};
```

---

## Usage

All examples use `provideTemporalDateAdapter()` (or the appropriate variant provider) in the app config.

### Date — inline

```ts
import { NgxDtPicker } from '@constantine-24/ngx-datetime-picker';
```

```html
<ngx-dt-picker [inline]="true" [(value)]="selectedDate" />
```

### Date — popup with toggle in a `mat-form-field`

```html
<mat-form-field>
  <mat-label>Pick a date</mat-label>
  <input matInput [ngxDtInput]="picker" [formControl]="dateCtrl" />
  <ngx-dt-toggle matSuffix [for]="picker" />
</mat-form-field>
<ngx-dt-picker #picker="ngxDtPicker" />
```

### Date range

```html
<ngx-dt-date-range-input
  [rangePicker]="rangePicker"
  [formControl]="rangeCtrl"
  ariaLabel="Trip dates"
>
  <input ngxDtStartDate placeholder="Start" aria-label="Start date" />
  <span aria-hidden="true">–</span>
  <input ngxDtEndDate placeholder="End" aria-label="End date" />
</ngx-dt-date-range-input>
<ngx-dt-toggle [for]="rangePicker" ariaLabel="Open range calendar" />
<ngx-dt-picker #rangePicker type="date-range" />
```

Provide `provideTemporalDateAdapter()` for this variant. The `rangeCtrl` value type is `DateRange<Temporal.PlainDate>` (re-exported as `DateRange` from `@constantine-24/ngx-datetime-picker`).

### Time — popup with toggle

```ts
// app.config.ts — use provideTemporalTimeAdapter() for this variant
import { provideTemporalTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
```

```html
<mat-form-field>
  <mat-label>Pick a time</mat-label>
  <input matInput [ngxDtTimeInput]="timePicker" [formControl]="timeCtrl" />
  <ngx-dt-toggle matSuffix [for]="timePicker" ariaLabel="Open time picker" />
</mat-form-field>
<ngx-dt-picker #timePicker type="time" [hourCycle]="12" />
```

### Datetime — popup with toggle

```ts
// app.config.ts — use provideTemporalDateTimeAdapter() for this variant
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
```

```html
<mat-form-field>
  <mat-label>Pick a date &amp; time</mat-label>
  <input matInput [ngxDtDateTimeInput]="dtPicker" [formControl]="dateTimeCtrl" />
  <ngx-dt-toggle matSuffix [for]="dtPicker" ariaLabel="Open datetime picker" />
</mat-form-field>
<ngx-dt-picker #dtPicker type="datetime" [hourCycle]="12" />
```

### Datetime range

```html
<ngx-dt-datetime-range-input
  [rangePicker]="dtRangePicker"
  [formControl]="dateTimeRangeCtrl"
  ariaLabel="Trip start and end"
>
  <input ngxDtStartDateTime placeholder="Start" aria-label="Start date and time" />
  <span aria-hidden="true">–</span>
  <input ngxDtEndDateTime placeholder="End" aria-label="End date and time" />
</ngx-dt-datetime-range-input>
<ngx-dt-toggle [for]="dtRangePicker" ariaLabel="Open datetime range picker" />
<ngx-dt-picker #dtRangePicker type="datetime-range" [hourCycle]="12" />
```

---

## Picker inputs

`<ngx-dt-picker>` (exportAs: `ngxDtPicker`)

| Input             | Type                                                                 | Default           | Description                                                                                        |
| ----------------- | -------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------- |
| `type`            | `'date' \| 'date-range' \| 'time' \| 'datetime' \| 'datetime-range'` | `'date'`          | Picker variant.                                                                                    |
| `inline`          | `boolean`                                                            | `false`           | Render as an always-visible panel instead of an overlay.                                           |
| `min`             | `D \| null`                                                          | `null`            | Minimum selectable value.                                                                          |
| `max`             | `D \| null`                                                          | `null`            | Maximum selectable value.                                                                          |
| `startAt`         | `D \| null`                                                          | `null`            | Calendar opens at this date/month when no value is set.                                            |
| `startView`       | `'month' \| 'year' \| 'multi-year'`                                  | `'month'`         | Initial calendar view (single-calendar mode only).                                                 |
| `dateFilter`      | `(date: D) => boolean`                                               | `() => true`      | Predicate to disable individual dates. For datetime variants the predicate receives the date part. |
| `timeFilter`      | `(time: D) => boolean`                                               | `() => true`      | Predicate to disable individual time steps in the time panel.                                      |
| `disabled`        | `boolean`                                                            | `false`           | Disable the picker.                                                                                |
| `hourCycle`       | `12 \| 24 \| null`                                                   | `null`            | Force 12- or 24-hour time display; `null` uses the locale default.                                 |
| `minuteStep`      | `number`                                                             | `1`               | Minute increment for the time panel stepper.                                                       |
| `showSeconds`     | `boolean`                                                            | `false`           | Show the seconds field in the time panel.                                                          |
| `monthsToDisplay` | `1 \| 2`                                                             | `1`               | Show two side-by-side calendars in range modes. Ignored for non-range variants.                    |
| `draftMode`       | `boolean`                                                            | `false`           | Buffer changes until the user clicks Apply; Cancel discards them.                                  |
| `hasBackdrop`     | `boolean`                                                            | (from options)    | Whether the overlay has a transparent backdrop.                                                    |
| `restoreFocus`    | `boolean`                                                            | (from options)    | Return focus to the trigger element when the overlay closes.                                       |
| `ariaLabel`       | `string`                                                             | `'Choose a date'` | `aria-label` for the picker panel.                                                                 |

**Two-way models:**

| Model   | Type                   | Description                                   |
| ------- | ---------------------- | --------------------------------------------- |
| `value` | `D \| null`            | Selected date/time for single-value variants. |
| `range` | `DateRange<D> \| null` | Selected range for range variants.            |

**Outputs:**

| Output         | Payload   | Description                             |
| -------------- | --------- | --------------------------------------- |
| `openedChange` | `boolean` | Emits `true` on open, `false` on close. |
| `opened`       | `void`    | Emits when the overlay opens.           |
| `closed`       | `void`    | Emits when the overlay closes.          |

**Toggle inputs** (`<ngx-dt-toggle>`):

| Input       | Type          | Description                                 |
| ----------- | ------------- | ------------------------------------------- |
| `for`       | `NgxDtPicker` | The picker this toggle controls (required). |
| `disabled`  | `boolean`     | Disable the toggle button.                  |
| `ariaLabel` | `string`      | `aria-label` for the toggle button.         |

---

## Forms integration

All input directives act as CVAs and validators, compatible with Reactive Forms, `ngModel`, and Signal Forms (`[formField]`).

### Single-value inputs

| Selector                    | Usage                                                |
| --------------------------- | ---------------------------------------------------- |
| `input[ngxDtInput]`         | Date picker (`[ngxDtInput]="pickerRef"`)             |
| `input[ngxDtTimeInput]`     | Time picker (`[ngxDtTimeInput]="pickerRef"`)         |
| `input[ngxDtDateTimeInput]` | Datetime picker (`[ngxDtDateTimeInput]="pickerRef"`) |

### Range inputs

| Selector                                      | Usage                                                                                          |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `<ngx-dt-date-range-input [rangePicker]>`     | Wrapper for date range; contains `input[ngxDtStartDate]` and `input[ngxDtEndDate]`             |
| `<ngx-dt-datetime-range-input [rangePicker]>` | Wrapper for datetime range; contains `input[ngxDtStartDateTime]` and `input[ngxDtEndDateTime]` |

### Validation error keys

**Single inputs:**

| Key           | Condition                                         |
| ------------- | ------------------------------------------------- |
| `ngxDtParse`  | The text could not be parsed as a valid value.    |
| `ngxDtMin`    | Value is before `min`.                            |
| `ngxDtMax`    | Value is after `max`.                             |
| `ngxDtFilter` | Value is excluded by `dateFilter` / `timeFilter`. |

**Range inputs (set on the wrapper control):**

| Key               | Condition                              |
| ----------------- | -------------------------------------- |
| `ngxDtRangeStart` | Start value is invalid.                |
| `ngxDtRangeEnd`   | End value is invalid.                  |
| `ngxDtMin`        | A range end is before `min`.           |
| `ngxDtMax`        | A range end is after `max`.            |
| `ngxDtFilter`     | A range end is excluded by the filter. |
| `ngxDtRangeOrder` | Start is after end.                    |

---

## Theming

Components consume `--mat-sys-*` design tokens from the Material token system. The host application must include a `mat.theme()` call to emit those tokens:

```scss
// styles.scss
@use '@angular/material' as mat;

html {
  @include mat.theme(
    (
      color: (
        primary: mat.$azure-palette,
        theme-type: light,
      ),
      typography: mat.$brand-typography,
      density: 0,
    )
  );
}
```

`prefers-reduced-motion` is honored: all transitions and animations are disabled when the user has requested reduced motion.

---

## Accessibility

- **Overlay dialog**: rendered with `role="dialog"` and `aria-modal="true"`, focus-trapped via CDK `cdkTrapFocus`, closed by Escape, and focus is returned to the trigger on close (controlled by `restoreFocus`).
- **Time fields**: each segment has `role="spinbutton"` with full keyboard support — Arrow Up/Down, Home, End, Page Up/Page Down, and type-to-set. Value announcements use Angular CDK `LiveAnnouncer`.
- Passes WCAG AA color contrast requirements.

**Known limitation — dual-calendar keyboard navigation:** When `monthsToDisplay="2"` is set, the two `MatCalendar` instances each have their own internal month state. Using keyboard arrow keys to move a date past a month edge will navigate only that calendar independently of the shared prev/next-month header buttons. This is a structural constraint of the underlying `MatCalendar` component.

---

## RTL

Right-to-left layout is supported via CDK `Directionality`. Set `dir="rtl"` on the host document or any ancestor element; the picker panel and calendar will reflect accordingly.

---

## Contributing & license

Issues and pull requests are welcome — see [CONTRIBUTING.md](https://github.com/Constantine-24/ngx-datetime-picker/blob/main/CONTRIBUTING.md). Release history: [CHANGELOG.md](https://github.com/Constantine-24/ngx-datetime-picker/blob/main/projects/ngx-datetime-picker/CHANGELOG.md).

[MIT](https://github.com/Constantine-24/ngx-datetime-picker/blob/main/LICENSE) © Konstantin Penzin

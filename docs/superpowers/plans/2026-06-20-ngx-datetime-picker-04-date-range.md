# Date Range (`type="date-range"`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add date-range selection to `ngx-datetime-picker` — a `type="date-range"` picker driven by Material's range selection strategy, plus a two-input `<ngx-dt-date-range-input>` container that owns a `DateRange<D>` value across Reactive Forms, `ngModel`, and Signal Forms.

**Architecture:** The existing `NgxDtPicker<D>` gains a range mode. In range mode it binds the calendar's `[selected]` to a `DateRange<D>` and listens to the calendar's internal `(_userSelection)` output, folding each clicked date into the range via `MAT_DATE_RANGE_SELECTION_STRATEGY.selectionFinished()` (we provide `DefaultMatCalendarRangeStrategy` via DI; this also gives hover-preview for free). A new `NgxDtDateRangeInput<D>` container component is the `ControlValueAccessor` + `Validator` for one `DateRange<D>`; two lean part directives (`NgxDtStartDate` / `NgxDtEndDate`) handle text I/O for each end and report to the container. The container registers with the picker through a new `NgxDtPickerRangeInput<D>` seam, mirroring Plan 3's `NgxDtPickerInput<D>`.

**Tech Stack:** Angular 22.0.2 (standalone, signals, zoneless), `@angular/material` v22.0.2 (`MatCalendar`, `DateRange`, `MAT_DATE_RANGE_SELECTION_STRATEGY`, `DefaultMatCalendarRangeStrategy`, `MatCalendarUserEvent`), Temporal adapter, Vitest.

---

## Scope & deliberate deferrals

- **Single calendar** in the panel (range engine + hover preview). **Dual synced calendars (`monthsToDisplay=2`) are deferred** — MatCalendar has no public month-navigation output, so syncing needs a custom shared header. Note it; do not build it here.
- **Container is the CVA for one `DateRange<D>`** (one control = one range). **Per-part `ControlValueAccessor`s and group-level `MatFormFieldControl` are deferred** to the polish plan. The demo range field uses a plain styled wrapper (`role="group"` + `aria-label`), not `<mat-form-field>`.
- Validation covered here: per-end parse errors, `min`/`max`/`dateFilter` (from the picker, applied to both ends), and range **order** (`end ≥ start`). Same-day datetime-range time ordering is a Plan 6 concern.

## Verified API facts (from `node_modules`, do not re-derive)

- `DateRange<D>` (`@angular/material/datepicker`): `new DateRange<D>(start: D | null, end: D | null)`; readonly `.start` / `.end`. Exported.
- `MatCalendar<D>.selected` accepts `DateRange<D> | D | null`. `(selectedChange)` emits **a single `D | null`** (no range concept). `(_userSelection)` emits `MatCalendarUserEvent<D | null>` = `{ value: D | null; event: Event }` — the **raw clicked date**, in all modes. Both fire on a click.
- `MAT_DATE_RANGE_SELECTION_STRATEGY` is an `InjectionToken<MatDateRangeSelectionStrategy<any>>`, injected `{ optional: true }` by the month view (walks up the injector). Not provided globally. Provide it at the picker so the month view gets it (hover preview + `isRange` rendering).
- `DefaultMatCalendarRangeStrategy<D>` is `@Injectable` with `deps: [DateAdapter]`. `selectionFinished(date, currentRange, event?)`: if `start == null` → `(date, null)`; else if `end == null && date >= start` → `(start, date)`; else → `(date, null)` (reset). `createPreview(activeDate, currentRange)`: previews `start→activeDate` while `start` set and `end` null.
- `MatCalendarUserEvent` and `MatDateRangeSelectionStrategy` are **type-only** exports of `@angular/material/datepicker`.
- The calendar never writes its own `selected` input — so binding `[selected]` to our signal + handling `(_userSelection)` ourselves applies the strategy exactly once.

## File structure

- **Modify** `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` — add `'date-range'` type, `range` model, `NgxDtPickerRangeInput<D>` seam, strategy provider/injection, `(_userSelection)` handler, unified `calendarSelection`.
- **Modify** `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` — range engine tests + `FakeRangeInput` bridge tests.
- **Create** `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.ts` — container + base + `NgxDtStartDate` / `NgxDtEndDate`.
- **Create** `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.spec.ts` — container I/O + picker bridge.
- **Create** `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.validators.spec.ts` — order/parse/min/max/filter.
- **Create** `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.forms.spec.ts` — Reactive / ngModel / Signal Forms round-trips (imports from the `ngx-datetime-picker` barrel).
- **Modify** `projects/ngx-datetime-picker/src/public-api.ts` — export the new symbols + re-export `DateRange`.
- **Modify** `src/app/app.ts` + `src/app/app.html` + `src/app/app.scss` — date-range demo section.

## Conventions (CLAUDE.md — enforced by review)

Standalone; **no** `standalone: true`, **no** explicit `changeDetection`. Signals; `input()`/`output()`/`model()`/`computed()`. Host bindings in the `host` object (no `@HostBinding`/`@HostListener`). No `ngClass`/`ngStyle`, no `$any`, no `any` (use `unknown`); native control flow. `inject()`. Commit trailer on every commit:

```
Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

Run the library suite with: `npx ng test --project ngx-datetime-picker`. Run everything with `npm test`.

---

## Task 1: Picker range mode + `NgxDtPickerRangeInput<D>` seam

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Modify (test): `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

- [ ] **Step 1: Write the failing tests** — append to `ngx-dt-picker.spec.ts`:

```ts
// --- Plan 4: date-range engine -------------------------------------------

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker #picker [inline]="true" type="date-range" [(range)]="range" />
  `,
})
class InlineRangeHost {
  range = signal<DateRange<Temporal.PlainDate> | null>(null);
}

function rangeCells(fixture: { nativeElement: HTMLElement }): HTMLElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLElement>('.mat-calendar-body-cell'),
  );
}

describe('NgxDtPicker — date-range engine', () => {
  beforeEach(setup);

  it('first click sets the range start with a null end', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    rangeCells(fixture)[4].click(); // 5th of the active month
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range();
    expect(range?.start).toBeInstanceOf(Temporal.PlainDate);
    expect(range?.end).toBeNull();
    expect(range?.start?.day).toBe(5);
  });

  it('a second click on/after the start completes the range', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = rangeCells(fixture);
    cells[4].click(); // start = 5th
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end = 10th
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range()!;
    expect(range.start?.day).toBe(5);
    expect(range.end?.day).toBe(10);
    expect(
      Temporal.PlainDate.compare(range.end!, range.start!),
    ).toBeGreaterThanOrEqual(0);
  });

  it('a click before the current start resets the start', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = rangeCells(fixture);
    cells[9].click(); // start = 10th
    fixture.detectChanges();
    await fixture.whenStable();
    cells[4].click(); // earlier than start → resets
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range()!;
    expect(range.start?.day).toBe(5);
    expect(range.end).toBeNull();
  });
});

/** Minimal fake range input implementing the picker's range contract. */
class FakeRangeInput implements NgxDtPickerRangeInput<Temporal.PlainDate> {
  readonly _range = signal<DateRange<Temporal.PlainDate> | null>(null);
  readonly range = this._range.asReadonly();
  fromPicker: DateRange<Temporal.PlainDate> | undefined;
  readonly origin = document.createElement('div');
  setRangeFromPicker(range: DateRange<Temporal.PlainDate>): void {
    this.fromPicker = range;
    this._range.set(range);
  }
  getOverlayOrigin(): HTMLElement {
    return this.origin;
  }
}

describe('NgxDtPicker — range value bridge', () => {
  beforeEach(setup);

  it('routes range selection to the registered range input, not [(range)]', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeRangeInput();
    picker.registerRangeInput(input);

    rangeCells(fixture)[4].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.fromPicker?.start).toBeInstanceOf(Temporal.PlainDate);
    expect(fixture.componentInstance.range()).toBeNull();
  });

  it('throws when a second, different range input registers', () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDate>;
    picker.registerRangeInput(new FakeRangeInput());
    expect(() => picker.registerRangeInput(new FakeRangeInput())).toThrow(/single/);
  });
});
```

Add `DateRange` and `NgxDtPickerRangeInput` to the spec's imports:

```ts
import { DateRange } from '@angular/material/datepicker';
import { NgxDtPicker, NgxDtPickerInput, NgxDtPickerRangeInput } from './ngx-dt-picker';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — `type="date-range"` not accepted / `range` input missing / `registerRangeInput` undefined.

- [ ] **Step 3: Implement the picker changes** in `ngx-dt-picker.ts`.

Replace the type alias and add the range seam interface:

```ts
/** Picker variants. `date` and `date-range` are implemented. */
export type NgxDtPickerType = 'date' | 'date-range';
```

Add (next to `NgxDtPickerInput`):

```ts
/**
 * Contract a range input must satisfy to own a picker's range value.
 * Kept here so the picker has no dependency on the range-input component.
 */
export interface NgxDtPickerRangeInput<D> {
  /** Current range value as a signal — read reactively in the calendar binding. */
  readonly range: Signal<DateRange<D> | null>;
  /** Called by the picker when the calendar range selection changes. */
  setRangeFromPicker(range: DateRange<D>): void;
  /** Element the overlay anchors to when opened from the range field. */
  getOverlayOrigin(): NgxDtOrigin;
}
```

Update the Material import:

```ts
import {
  DateRange,
  DefaultMatCalendarRangeStrategy,
  MatCalendar,
  MAT_DATE_RANGE_SELECTION_STRATEGY,
  type MatCalendarUserEvent,
  type MatDateRangeSelectionStrategy,
} from '@angular/material/datepicker';
```

Add the strategy provider to the `@Component` metadata (alongside `host`):

```ts
  host: { class: 'ngx-dt-picker' },
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: DefaultMatCalendarRangeStrategy,
    },
  ],
```

In the template, change the calendar binding and add the `_userSelection` handler:

```html
      <mat-calendar
        [startAt]="effectiveStartAt()"
        [startView]="startView()"
        [selected]="calendarSelection()"
        [minDate]="min()"
        [maxDate]="max()"
        [dateFilter]="dateFilter()"
        (selectedChange)="onSelectedChange($event)"
        (_userSelection)="onUserSelection($event)"
      />
```

In the class body, add the strategy injection + empty-range constant near the other private fields:

```ts
  private readonly rangeStrategy = inject<MatDateRangeSelectionStrategy<D>>(
    MAT_DATE_RANGE_SELECTION_STRATEGY,
  );
  private readonly _emptyRange = new DateRange<D>(null, null);
```

Add the range model + `isRange` near the existing `value` model:

```ts
  /** Two-way range value (used when `type === 'date-range'`). */
  readonly range = model<DateRange<D> | null>(null);

  /** Whether the picker is in range-selection mode. */
  readonly isRange = computed(() => this.type() === 'date-range');
```

Add the range-input registry (next to `_input` / `registerInput`):

```ts
  private readonly _rangeInput = signal<NgxDtPickerRangeInput<D> | null>(null);

  /**
   * Registers the range field that owns this picker's range value. Idempotent
   * for the same input; throws if a different one registers.
   */
  registerRangeInput(input: NgxDtPickerRangeInput<D>): void {
    const existing = this._rangeInput();
    if (existing && existing !== input) {
      throw new Error('NgxDtPicker can only be associated with a single range input.');
    }
    this._rangeInput.set(input);
  }

  /** Range shown by the calendar: the registered range input's value, else the model. */
  protected readonly rangeDisplayValue = computed<DateRange<D> | null>(() => {
    const input = this._rangeInput();
    return input ? input.range() : this.range();
  });
```

Add the unified calendar selection computed and update `effectiveStartAt`:

```ts
  /** What the calendar's `[selected]` binds to — a range or a single date. */
  protected readonly calendarSelection = computed<DateRange<D> | D | null>(() => {
    if (this.isRange()) {
      return this.rangeDisplayValue() ?? this._emptyRange;
    }
    return this.displayValue();
  });

  protected readonly effectiveStartAt = computed(() => {
    const anchor = this.isRange()
      ? (this.rangeDisplayValue()?.start ?? null)
      : this.displayValue();
    return anchor ?? this.startAt() ?? this.adapter.today();
  });
```

(Remove the old `effectiveStartAt` definition — replace it with the one above.)

Guard the single-date handler and add the range handler:

```ts
  protected onSelectedChange(date: D | null): void {
    if (this.isRange()) {
      return; // range selection is handled via (_userSelection)
    }
    const input = this._input();
    if (input) {
      input.setValueFromPicker(date);
    } else {
      this.value.set(date);
    }
    if (!this.inline()) {
      this.close();
    }
  }

  protected onUserSelection(event: MatCalendarUserEvent<D | null>): void {
    if (!this.isRange()) {
      return; // single-date selection is handled via (selectedChange)
    }
    const current = this.rangeDisplayValue() ?? this._emptyRange;
    const next = this.rangeStrategy.selectionFinished(event.value, current, event.event);
    const input = this._rangeInput();
    if (input) {
      input.setRangeFromPicker(next);
    } else {
      this.range.set(next);
    }
    if (!this.inline() && next.start !== null && next.end !== null) {
      this.close();
    }
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS — all prior single-date tests still green; new range tests green.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts \
        projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts
git commit -m "feat(picker): date-range mode + NgxDtPickerRangeInput seam

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Range-input container + start/end part directives (CVA + picker bridge)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.ts`
- Create (test): `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.spec.ts`

- [ ] **Step 1: Write the failing tests** — create `ngx-dt-date-range-input.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtStartDate,
} from './ngx-dt-date-range-input';

@Component({
  imports: [
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-date-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDate #start="ngxDtStartDate" />
      <input ngxDtEndDate #end="ngxDtEndDate" />
    </ngx-dt-date-range-input>
    <ngx-dt-picker #picker [inline]="true" type="date-range" />
  `,
})
class Host {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
}

function inputs(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = fixture.nativeElement.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — text I/O', () => {
  beforeEach(setup);

  it('aggregates typed start + end into a DateRange model value', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = inputs(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDate.from('2026-06-10'));
    expect(value.end).toEqual(Temporal.PlainDate.from('2026-06-20'));
  });

  it('writes a DateRange model down into both inputs (formatted)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDate.from('2026-06-10'),
        Temporal.PlainDate.from('2026-06-20'),
      ),
    );
    fixture.detectChanges();

    const { start, end } = inputs(fixture);
    expect(start.value).toBe('6/10/2026');
    expect(end.value).toBe('6/20/2026');
  });

  it('disables both inputs through the control', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    const { start, end } = inputs(fixture);
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);
  });
});

describe('NgxDtDateRangeInput — picker bridge', () => {
  beforeEach(setup);

  it('reflects a calendar range selection into both inputs and the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = Array.from(
      fixture.nativeElement.querySelectorAll<HTMLElement>('.mat-calendar-body-cell'),
    );
    cells[4].click(); // start
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end
    fixture.detectChanges();
    await fixture.whenStable();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start?.day).toBe(5);
    expect(value.end?.day).toBe(10);
    const { start, end } = inputs(fixture);
    expect(start.value).toMatch(/\d+\/\d+\/\d{4}/);
    expect(end.value).toMatch(/\d+\/\d+\/\d{4}/);
  });

  it('opens the picker on Alt+ArrowDown from the start input', async () => {
    @Component({
      imports: [NgxDtDateRangeInput, NgxDtStartDate, NgxDtEndDate, NgxDtPicker],
      template: `
        <ngx-dt-date-range-input [rangePicker]="picker">
          <input ngxDtStartDate />
          <input ngxDtEndDate />
        </ngx-dt-date-range-input>
        <ngx-dt-picker #picker type="date-range" />
      `,
    })
    class OverlayHost {
      readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
    }
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const start = fixture.nativeElement.querySelector('input')!;
    start.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — `ngx-dt-date-range-input` module does not exist.

- [ ] **Step 3: Implement** — create `ngx-dt-date-range-input.ts`:

```ts
import {
  Component,
  Directive,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  type MatDateFormats,
} from '@angular/material/core';
import { DateRange } from '@angular/material/datepicker';
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerRangeInput,
} from '../picker/ngx-dt-picker';

/** I/O contract a single range end (start/end input) exposes to the container. */
interface NgxDtRangePart<D> {
  /** Writes formatted text (or empty) into the part's input element. */
  formatValue(date: D | null): void;
  /** Toggles the part's disabled state. */
  setDisabled(isDisabled: boolean): void;
  /** Current raw text in the input (for parse-error reporting). */
  rawText(): string;
}

/**
 * Two-input range container. Owns one `DateRange<D>` value as a
 * `ControlValueAccessor` + `Validator`, registers with an `NgxDtPicker` through
 * the `NgxDtPickerRangeInput<D>` seam, and coordinates the two part directives.
 */
@Component({
  selector: 'ngx-dt-date-range-input',
  exportAs: 'ngxDtDateRangeInput',
  template: `<ng-content />`,
  host: {
    class: 'ngx-dt-date-range-input',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtDateRangeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtDateRangeInput),
      multi: true,
    },
  ],
})
export class NgxDtDateRangeInput<D = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerRangeInput<D>
{
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly adapter = inject<DateAdapter<D>>(DateAdapter);

  /** The picker this range field feeds; bind a ref: `[rangePicker]="picker"`. */
  readonly picker = input.required<NgxDtPicker<D>>({ alias: 'rangePicker' });
  readonly ariaLabel = input('Date range');

  /** Emits whenever the committed range changes (typed or chosen). */
  readonly rangeChange = output<DateRange<D>>();

  private readonly _start = signal<D | null>(null);
  private readonly _end = signal<D | null>(null);
  /** Current start/end (read by the parts for reformatting). */
  readonly startValue = this._start.asReadonly();
  readonly endValue = this._end.asReadonly();

  /** Whether the latest text for each end parsed to a valid (or empty) date. */
  _startValid = true;
  _endValid = true;

  private _startPart: NgxDtRangePart<D> | null = null;
  private _endPart: NgxDtRangePart<D> | null = null;
  private _disabledState = false;

  /** Current range value (read by the picker for `[selected]`). */
  readonly range = computed<DateRange<D>>(
    () => new DateRange<D>(this._start(), this._end()),
  );

  private _onChange: (value: DateRange<D>) => void = () => {};
  private _onTouched: () => void = () => {};
  private _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max/dateFilter; re-validate when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.dateFilter();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerRangeInput(this);
  }

  // --- part registration (part -> container) --------------------------------

  _registerStart(part: NgxDtRangePart<D>): void {
    this._startPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._start());
  }
  _registerEnd(part: NgxDtRangePart<D>): void {
    this._endPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._end());
  }

  _setStart(date: D | null, valid: boolean): void {
    this._startValid = valid;
    this._start.set(date);
    this._commit();
  }
  _setEnd(date: D | null, valid: boolean): void {
    this._endValid = valid;
    this._end.set(date);
    this._commit();
  }
  _markTouched(): void {
    this._onTouched();
  }
  openPicker(): void {
    this.picker().open(this.elementRef);
  }

  private _commit(): void {
    const range = this.range();
    this._onChange(range);
    this.rangeChange.emit(range);
    this._onValidatorChange();
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: DateRange<D> | null): void {
    const start = this.adapter.getValidDateOrNull(
      this.adapter.deserialize(value?.start ?? null),
    );
    const end = this.adapter.getValidDateOrNull(
      this.adapter.deserialize(value?.end ?? null),
    );
    this._startValid = true;
    this._endValid = true;
    this._start.set(start);
    this._end.set(end);
    this._startPart?.formatValue(start);
    this._endPart?.formatValue(end);
  }
  registerOnChange(fn: (value: DateRange<D>) => void): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this._disabledState = isDisabled;
    this._startPart?.setDisabled(isDisabled);
    this._endPart?.setDisabled(isDisabled);
  }

  // --- Validator ------------------------------------------------------------

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._startValid) {
      return { ngxDtRangeStart: { text: this._startPart?.rawText() ?? '' } };
    }
    if (!this._endValid) {
      return { ngxDtRangeEnd: { text: this._endPart?.rawText() ?? '' } };
    }
    const value = control.value as DateRange<D> | null;
    const start = value?.start ?? null;
    const end = value?.end ?? null;
    const picker = this.picker();
    const min = picker.min();
    const max = picker.max();
    const filter = picker.dateFilter();
    for (const date of [start, end]) {
      if (date === null) {
        continue;
      }
      if (min && this.adapter.compareDate(min, date) > 0) {
        return { ngxDtMin: { min, actual: date } };
      }
      if (max && this.adapter.compareDate(max, date) < 0) {
        return { ngxDtMax: { max, actual: date } };
      }
      if (!filter(date)) {
        return { ngxDtFilter: true };
      }
    }
    if (start !== null && end !== null && this.adapter.compareDate(end, start) < 0) {
      return { ngxDtRangeOrder: { start, end } };
    }
    return null;
  }
  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerRangeInput (picker -> container) --------------------------

  setRangeFromPicker(range: DateRange<D>): void {
    this._startValid = true;
    this._endValid = true;
    this._start.set(range.start);
    this._end.set(range.end);
    this._startPart?.formatValue(range.start);
    this._endPart?.formatValue(range.end);
    this._onChange(range);
    this.rangeChange.emit(range);
    this._onTouched();
    this._onValidatorChange();
  }
  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }
}

/**
 * Shared parse/format/IO for one end of a range. Subclassed by the start and
 * end directives; each reports its parsed value to, and reads its current value
 * from, the parent container.
 */
@Directive()
export abstract class NgxDtDateRangePartBase<D = unknown>
  implements NgxDtRangePart<D>
{
  protected readonly elementRef =
    inject<ElementRef<HTMLInputElement>>(ElementRef);
  protected readonly adapter = inject<DateAdapter<D>>(DateAdapter);
  protected readonly dateFormats = inject<MatDateFormats>(MAT_DATE_FORMATS);
  protected readonly parent = inject<NgxDtDateRangeInput<D>>(NgxDtDateRangeInput);

  protected readonly _disabled = signal(false);
  _lastValueValid = true;

  /** Reports the parsed value + parse-validity to the container. */
  protected abstract _report(date: D | null, valid: boolean): void;
  /** The value the container currently holds for this end (for reformatting). */
  protected abstract _currentValue(): D | null;
  /** Registers this part with the container. */
  protected abstract _register(): void;

  ngOnInit(): void {
    this._register();
  }

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text, this.dateFormats.parse.dateInput);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    this._report(this.adapter.getValidDateOrNull(parsed), this._lastValueValid);
  }

  protected _onBlur(): void {
    if (this._lastValueValid) {
      this.formatValue(this._currentValue());
    }
    this.parent._markTouched();
  }

  protected _onKeydown(event: KeyboardEvent): void {
    if (event.altKey && event.key === 'ArrowDown' && !this._disabled()) {
      this.parent.openPicker();
      event.preventDefault();
    }
  }

  formatValue(date: D | null): void {
    this.elementRef.nativeElement.value =
      date && this.adapter.isValid(date)
        ? this.adapter.format(date, this.dateFormats.display.dateInput)
        : '';
  }
  setDisabled(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }
  rawText(): string {
    return this.elementRef.nativeElement.value;
  }
}

@Directive({
  selector: 'input[ngxDtStartDate]',
  exportAs: 'ngxDtStartDate',
  host: {
    class: 'ngx-dt-range-start',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtStartDate<D = unknown>
  extends NgxDtDateRangePartBase<D>
  implements OnInit
{
  protected _report(date: D | null, valid: boolean): void {
    this.parent._setStart(date, valid);
  }
  protected _currentValue(): D | null {
    return this.parent.startValue();
  }
  protected _register(): void {
    this.parent._registerStart(this);
  }
}

@Directive({
  selector: 'input[ngxDtEndDate]',
  exportAs: 'ngxDtEndDate',
  host: {
    class: 'ngx-dt-range-end',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtEndDate<D = unknown>
  extends NgxDtDateRangePartBase<D>
  implements OnInit
{
  protected _report(date: D | null, valid: boolean): void {
    this.parent._setEnd(date, valid);
  }
  protected _currentValue(): D | null {
    return this.parent.endValue();
  }
  protected _register(): void {
    this.parent._registerEnd(this);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS — container/part tests green.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/range-input/
git commit -m "feat(range-input): NgxDtDateRangeInput container + start/end parts (CVA + picker bridge)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Range validation (parse / order / min / max / filter)

**Files:**
- Create (test): `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.validators.spec.ts`
- Modify (only if a test reveals a gap): `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.ts`

> The `validate()` method was written in Task 2. This task proves it with dedicated tests. Only touch the implementation if a test fails.

- [ ] **Step 1: Write the failing tests** — create `ngx-dt-date-range-input.validators.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtStartDate,
} from './ngx-dt-date-range-input';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
}

@Component({
  imports: [
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-date-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDate />
      <input ngxDtEndDate />
    </ngx-dt-date-range-input>
    <ngx-dt-picker
      #picker
      [inline]="true"
      type="date-range"
      [min]="min()"
      [max]="max"
      [dateFilter]="filter"
    />
  `,
})
class ValidatedHost {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  readonly min = signal(Temporal.PlainDate.from('2026-06-10'));
  max = Temporal.PlainDate.from('2026-06-20');
  filter = (d: Temporal.PlainDate) => d.day !== 12;
}

function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = fixture.nativeElement.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — validation', () => {
  beforeEach(setup);

  it('reports ngxDtRangeStart for an unparseable start', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });

  it('reports ngxDtRangeEnd for an unparseable end', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeEnd')).toBe(true);
  });

  it('reports ngxDtRangeOrder when end is before start', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-18');
    type(end, '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtMin when an end is below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-01');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax when an end is above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, '2026-06-25');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('reports ngxDtFilter for a filtered-out end', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-12');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtFilter')).toBe(true);
  });

  it('passes for an in-range, ordered range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13');
    type(end, '2026-06-18');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('re-validates when the picker min tightens past the current range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13');
    type(end, '2026-06-18');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();

    fixture.componentInstance.min.set(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS (validate() and the re-validation effect were implemented in Task 2). If any fail, fix `ngx-dt-date-range-input.ts` minimally, then re-run.

- [ ] **Step 3: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.validators.spec.ts \
        projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.ts
git commit -m "test(range-input): parse/order/min/max/filter validation coverage

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Public API exports + forms integration tests

**Files:**
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`
- Create (test): `projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.forms.spec.ts`

- [ ] **Step 1: Update the public API** — append to `public-api.ts`:

```ts
export {
  NgxDtDateRangeInput,
  NgxDtStartDate,
  NgxDtEndDate,
} from './lib/range-input/ngx-dt-date-range-input';
export type { NgxDtPickerRangeInput } from './lib/picker/ngx-dt-picker';
// Re-exported for convenience so consumers can type range values without
// importing from `@angular/material/datepicker` directly.
export { DateRange } from '@angular/material/datepicker';
```

- [ ] **Step 2: Write the failing forms tests** — create `ngx-dt-date-range-input.forms.spec.ts` (imports from the barrel to prove the exports resolve):

```ts
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DateRange,
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtPicker,
  NgxDtStartDate,
} from 'ngx-datetime-picker';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
}
function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = fixture.nativeElement.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — Reactive Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateRangeInput,
      NgxDtStartDate,
      NgxDtEndDate,
      NgxDtPicker,
      ReactiveFormsModule,
    ],
    template: `
      <ngx-dt-date-range-input [rangePicker]="picker" [formControl]="ctrl">
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  }

  it('round-trips model <-> view', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDate.from('2026-06-10'),
        Temporal.PlainDate.from('2026-06-20'),
      ),
    );
    fixture.detectChanges();
    const { start, end } = startEnd(fixture);
    expect(start.value).toBe('6/10/2026');
    expect(end.value).toBe('6/20/2026');

    type(start, '2026-07-01');
    type(end, '2026-07-09');
    fixture.detectChanges();
    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDate.from('2026-07-01'));
    expect(value.end).toEqual(Temporal.PlainDate.from('2026-07-09'));
  });
});

describe('NgxDtDateRangeInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateRangeInput,
      NgxDtStartDate,
      NgxDtEndDate,
      NgxDtPicker,
      FormsModule,
    ],
    template: `
      <ngx-dt-date-range-input [rangePicker]="picker" [(ngModel)]="value">
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class NgModelHost {
    value: DateRange<Temporal.PlainDate> | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value?.start).toEqual(
      Temporal.PlainDate.from('2026-06-10'),
    );
    expect(fixture.componentInstance.value?.end).toEqual(
      Temporal.PlainDate.from('2026-06-20'),
    );
  });
});

describe('NgxDtDateRangeInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateRangeInput,
      NgxDtStartDate,
      NgxDtEndDate,
      NgxDtPicker,
      FormField,
    ],
    template: `
      <ngx-dt-date-range-input [rangePicker]="picker" [formField]="f.range">
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ range: DateRange<Temporal.PlainDate> }>({
      range: new DateRange<Temporal.PlainDate>(null, null),
    });
    readonly f = form(this.model);
  }

  it('binds the range through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // view -> field state
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.range().value().start).toEqual(
      Temporal.PlainDate.from('2026-06-10'),
    );
    expect(fixture.componentInstance.f.range().value().end).toEqual(
      Temporal.PlainDate.from('2026-06-20'),
    );

    // field state -> view
    fixture.componentInstance.f
      .range()
      .value.set(
        new DateRange(
          Temporal.PlainDate.from('2026-07-01'),
          Temporal.PlainDate.from('2026-07-09'),
        ),
      );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(start.value).toBe('7/1/2026');
    expect(end.value).toBe('7/9/2026');
  });
});
```

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS — all three form systems round-trip; barrel exports resolve.

- [ ] **Step 4: Commit**

```bash
git add projects/ngx-datetime-picker/src/public-api.ts \
        projects/ngx-datetime-picker/src/lib/range-input/ngx-dt-date-range-input.forms.spec.ts
git commit -m "feat(range-input): export range symbols + forms integration tests (reactive/ngModel/signal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Demo page + accessibility check

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.scss`

- [ ] **Step 1: Wire the demo component** — in `src/app/app.ts`, extend imports and add a range control.

Update the `ngx-datetime-picker` import line:

```ts
import {
  DateRange,
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtInput,
  NgxDtPicker,
  NgxDtStartDate,
  NgxDtToggle,
} from 'ngx-datetime-picker';
```

Add to the component `imports` array: `NgxDtDateRangeInput`, `NgxDtStartDate`, `NgxDtEndDate`.

Add a field to the `App` class:

```ts
  // Date range (Reactive Forms)
  protected readonly rangeCtrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
```

- [ ] **Step 2: Add the demo section** — in `src/app/app.html`, before the closing `</main>`:

```html
  <section>
    <h2>Date range</h2>
    <div class="ngx-dt-range-field">
      <ngx-dt-date-range-input
        [rangePicker]="rangePick"
        [formControl]="rangeCtrl"
        ariaLabel="Trip dates"
      >
        <input ngxDtStartDate placeholder="Start" aria-label="Start date" />
        <span class="ngx-dt-range-sep" aria-hidden="true">–</span>
        <input ngxDtEndDate placeholder="End" aria-label="End date" />
      </ngx-dt-date-range-input>
      <ngx-dt-toggle [for]="rangePick" ariaLabel="Open range calendar" />
    </div>
    <ngx-dt-picker #rangePick type="date-range" />
    <p>
      Range:
      {{ rangeCtrl.value?.start?.toString() ?? '—' }}
      →
      {{ rangeCtrl.value?.end?.toString() ?? '—' }}
    </p>
  </section>
```

- [ ] **Step 3: Add styling** — in `src/app/app.scss`, append:

```scss
.ngx-dt-range-field {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--mat-sys-outline, #767680);
  border-radius: 4px;

  input {
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    padding: 0.25rem;
    inline-size: 7rem;

    &:focus-visible {
      outline: 2px solid var(--mat-sys-primary, #4f46e5);
      outline-offset: 1px;
    }
  }

  .ngx-dt-range-sep {
    opacity: 0.7;
  }
}
```

- [ ] **Step 4: Verify the build + app tests**

Run: `npx ng test --project date-time-picker`
Expected: PASS (app smoke test green).

Run: `npm run build` (or `npx ng build`)
Expected: builds; a bundle-budget *warning* (Material chrome) is acceptable and pre-existing.

- [ ] **Step 5: Accessibility check (live)**

Start the dev server, then run a Lighthouse accessibility audit (axe-core powered) on `http://localhost:4200` via chrome-devtools MCP (`lighthouse_audit`, navigation mode, desktop). Verify the Accessibility category is **100** and the range group exposes its `aria-label`. (Direct axe CDN injection is blocked by the permission classifier — use Lighthouse, as in Plan 3.) Manually confirm: keyboard tab order through start → end → toggle, Alt+ArrowDown opens the calendar anchored to the field, two clicks select a range with hover preview, focus returns to the field on close.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.html src/app/app.scss
git commit -m "feat(demo): date-range field with two inputs, toggle, and range picker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Final review & finish

- [ ] Dispatch a final whole-branch code review (spec compliance + quality) over all Plan 4 commits.
- [ ] Run the full suite: `npm test` — app + library all green.
- [ ] Use **superpowers:finishing-a-development-branch** to merge to `main` (`--no-ff`), per the established cadence.

## Self-review (author)

- **Spec coverage:** Phase 3 items — dual MatCalendar (**deferred, noted**), `NgxDtRangeSelectionStrategy` via `MAT_DATE_RANGE_SELECTION_STRATEGY` (✅ reuse `DefaultMatCalendarRangeStrategy`), `MatRangeDateSelectionModel` (**not needed** — we own the `DateRange` signal and apply `selectionFinished` directly; lighter than the model, same result), two-input container (✅), hover preview via `createPreview` (✅ free from providing the strategy), `end ≥ start` validation (✅ `ngxDtRangeOrder`).
- **Type consistency:** `NgxDtPickerRangeInput<D>.range: Signal<DateRange<D> | null>` matches the container's `range` computed and the picker's `rangeDisplayValue`. `selectionFinished(date, currentRange, event)` matches the verified `MatDateRangeSelectionStrategy` signature. `MatCalendarUserEvent<D | null> = { value, event }` matches the handler.
- **Placeholder scan:** none — every step has full code.
- **Risk:** binding to the internal `(_userSelection)` output is the documented, accepted approach (pinned Material 22.0.2); covered by Task 1 integration tests so a Material change surfaces immediately.

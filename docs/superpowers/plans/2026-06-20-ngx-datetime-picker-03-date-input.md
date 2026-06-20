# ngx-datetime-picker — Plan 3: Date input `[ngxDtInput]` + forms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a text-field directive `[ngxDtInput]` that parses/formats dates through the `DateAdapter`, two-way-binds its value to `NgxDtPicker`'s calendar, and works as a `ControlValueAccessor` + validator across Reactive Forms, `ngModel`, and Signal Forms.

**Architecture:** `[ngxDtInput]` is the value owner when registered with a picker; the picker delegates its calendar's `[selected]` to the input via a small `NgxDtPickerInput<D>` contract (single source of truth, no bidirectional signal loops). The input is a `ControlValueAccessor` + `Validator` (parse/min/max/filter); the same CVA is consumed by Signal Forms' `[formField]` compat path, so one directive covers all three forms systems. For `<mat-form-field>` integration we **reuse Material's `matInput`** (which already implements `MatFormFieldControl`) rather than reimplementing it — exactly how `MatDatepickerInput` composes with `matInput`.

**Tech Stack:** Angular 22.0.2 (standalone, signals, zoneless), TypeScript 6, `@angular/material/core` (`DateAdapter`, `MAT_DATE_FORMATS`), `@angular/forms` (CVA + `NG_VALIDATORS`), `@angular/forms/signals` (`form`, `FormField`), Vitest.

---

## Architecture decisions locked for this plan

These refine the design spec (`docs/ngx-datetime-picker-design.md`) with facts verified against installed `node_modules` during planning:

1. **Reuse `matInput` for `MatFormFieldControl`, do not reimplement it.** The spec said `[ngxDtInput]` would implement `MatFormFieldControl<D>`. Verified better approach: Material's `MatDatepickerInput` does NOT implement `MatFormFieldControl` — it composes with `matInput` (`<input matInput [matDatepicker]="p">`), and `matInput` provides the form-field chrome (label/focus/empty/errorState). We mirror this: `<input matInput [ngxDtInput]="p">`. This deletes ~100 lines of boilerplate, keeps `[ngxDtInput]` usable with a bare `<input>` (no Material form-field required), and is faithful to the brainstorm's locked "reuse Material primitives, don't reinvent" principle.

2. **Single source of truth = the registered input's value.** `NgxDtPicker` already owns `value = model<D|null>()` (Plan 2) for the standalone/inline/toggle-only case. When an input registers, the picker reads its `[selected]` and `startAt` from `input.value()` and routes calendar selections to `input.setValueFromPicker(date)`. The picker's own `value` model is the value channel ONLY when no input is registered. **`[(value)]` on the picker and `[ngxDtInput]` are alternative value channels — consumers use one or the other, not both.** Initial value with an input is set through the bound form control, not the picker's `value`.

3. **Validators pull constraints from the picker, not from duplicate inputs.** `min`/`max`/`dateFilter` already live on `NgxDtPicker` (Plan 2) and drive the calendar. The input's validator reads them from the registered picker, so a single declaration (`<ngx-dt-picker [min] [max] [dateFilter]>`) both constrains the calendar and validates typed text — no second source of truth. A constructor `effect` re-validates when those picker signals change.

4. **Error keys (Reactive Forms / `ngModel`):** `ngxDtParse` `{ text: string }`, `ngxDtMin` `{ min: D, actual: D }`, `ngxDtMax` `{ max: D, actual: D }`, `ngxDtFilter` `true`. Payload shapes mirror Material's datepicker keys (`matDatepickerParse`/`Min`/`Max`/`Filter`) under our namespace.

5. **Signal Forms scope:** The CVA-compat path of `[formField]` (verified at `@angular/forms/types/_structure-chunk.d.ts` lines 1099–1142: *"A component that provides a `ControlValueAccessor`"*) two-way-binds value and relays touched. So **value binding works automatically** for Signal Forms. Signal Forms validation is schema-based and does NOT consume `NG_VALIDATORS`; parse/min/max validation for Signal Forms is the consumer's `validate()`/`minDate()` schema responsibility. Invalid typed text resolves the model value to `null` (same as Material). This is documented, accepted v1 behavior.

## Verified API facts (ground truth for this plan)

- `DateAdapter<D>` (`@angular/material/types/_date-adapter-chunk.d.ts`): `parse(value, parseFormat): D|null`, `format(date, displayFormat): string`, `isValid(date): boolean`, `compareDate(a, b): number`, `deserialize(value): D|null`, `getValidDateOrNull(obj: unknown): D|null` (line 199), `sameDate(first: D|null, second: D|null): boolean` (line 241), `today(): D`.
- `TemporalDateAdapter.parse` returns `null` for empty input and the **invalid sentinel** (`isValid` → false) for unparseable non-empty text; `getValidDateOrNull` collapses the sentinel to `null`. `parse` ignores the format arg (ISO + locale-numeric strategy).
- `MAT_DATE_FORMATS` is provided by `provideTemporalDateAdapter()`; `dateFormats.parse.dateInput` is `null`, `dateFormats.display.dateInput` is `{ year:'numeric', month:'numeric', day:'numeric' }`.
- `ControlValueAccessor`: `writeValue(obj)`, `registerOnChange(fn)`, `registerOnTouched(fn)`, optional `setDisabledState?(isDisabled)`. `Validator`: `validate(control): ValidationErrors|null`, optional `registerOnValidatorChange?(fn)`. Tokens `NG_VALUE_ACCESSOR`, `NG_VALIDATORS` from `@angular/forms`.
- Signal Forms entry point `@angular/forms/signals` exports `form`, `Field`, `FormField` (`[formField]`, exportAs `formField`, required signal input `field` aliased `formField`), `validate`, `min`, `max`, `minDate`, `maxDate`, `required`, `schema`, `apply`.
- `NgxDtPicker<D>` (Plan 2): `value = model<D|null>()`, inputs `min`/`max`/`dateFilter`/`startAt`/`startView`/`inline`/`disabled`, `open(origin?)`/`close()`/`toggle(origin?)`, `isOpen` readonly signal, type `NgxDtOrigin = ElementRef | HTMLElement`. Template binds `[selected]="value()"`, `[startAt]="effectiveStartAt()"`; handler `onSelectedChange(date)`.

## File structure

- **Modify** `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` — add `NgxDtPickerInput<D>` interface, `_input` signal, `registerInput()`, `displayValue` computed; rebind calendar `[selected]`/`effectiveStartAt`; route `onSelectedChange` and `open()` through the registered input.
- **Modify** `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` — add a "value-bridge" describe block with a fake input.
- **Create** `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.ts` — `NgxDtInput<D>` directive.
- **Create** `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts` — directive unit tests.
- **Create** `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.forms.spec.ts` — Reactive / `ngModel` / Signal Forms integration tests.
- **Modify** `projects/ngx-datetime-picker/src/public-api.ts` — export `NgxDtInput`, `NgxDtPickerInput`.
- **Modify** `src/app/app.ts`, `src/app/app.html` — demo: `mat-form-field` + `matInput` + `[ngxDtInput]` + toggle, across Reactive / `ngModel` / Signal Forms.

---

## Task 1: Picker value-bridge seam

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

- [ ] **Step 1: Write the failing tests** — append to `ngx-dt-picker.spec.ts`:

```ts
// --- Plan 3: value-bridge seam ---------------------------------------------

import { NgxDtPickerInput } from './ngx-dt-picker';

/** Minimal fake input implementing the picker's registration contract. */
class FakeInput implements NgxDtPickerInput<Temporal.PlainDate> {
  readonly _value = signal<Temporal.PlainDate | null>(null);
  readonly value = this._value.asReadonly();
  fromPicker: Temporal.PlainDate | null | undefined;
  readonly origin = document.createElement('input');
  setValueFromPicker(date: Temporal.PlainDate | null): void {
    this.fromPicker = date;
    this._value.set(date);
  }
  getOverlayOrigin(): HTMLElement {
    return this.origin;
  }
}

describe('NgxDtPicker — value bridge', () => {
  beforeEach(setup);

  it('routes calendar selection to the registered input, not [(value)]', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeInput();
    picker.registerInput(input);

    const cell: HTMLElement = fixture.nativeElement.querySelector('.mat-calendar-body-cell');
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.fromPicker).toBeInstanceOf(Temporal.PlainDate);
    // [(value)] on the host stays null because an input owns the value
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('drives the calendar [selected] from the registered input value', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeInput();
    input._value.set(Temporal.PlainDate.from('2026-06-15'));
    picker.registerInput(input);
    fixture.detectChanges();
    await fixture.whenStable();

    const selected = fixture.nativeElement.querySelector('.mat-calendar-body-selected');
    expect(selected).toBeTruthy();
  });

  it('throws when a second, different input registers', () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    picker.registerInput(new FakeInput());
    expect(() => picker.registerInput(new FakeInput())).toThrow(/single/);
  });
});

describe('NgxDtPicker — opens anchored to the input', () => {
  beforeEach(setup);

  it('open() with no origin uses the registered input element', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    const input = new FakeInput();
    document.body.appendChild(input.origin);
    picker.registerInput(input);

    picker.open(); // no explicit origin
    fixture.detectChanges();
    await fixture.whenStable();

    expect(picker.isOpen()).toBe(true);
    expect(overlayPanel()).toBeTruthy();
    input.origin.remove();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20` (the workspace runs lib + app; this is acceptable)
Expected: FAIL — `registerInput` does not exist on `NgxDtPicker`; `NgxDtPickerInput` is not exported.

- [ ] **Step 3: Add the `NgxDtPickerInput<D>` interface** — in `ngx-dt-picker.ts`, just below the `NgxDtOrigin` type:

```ts
/**
 * Contract a text input must satisfy to own a picker's value.
 * Kept here (not imported from the input) so the picker has no dependency on
 * the input directive — the input imports this, not the other way around.
 */
export interface NgxDtPickerInput<D> {
  /** Current model value, as a signal accessor (read inside the calendar binding). */
  readonly value: () => D | null;
  /** Called by the picker when the calendar selection changes. */
  setValueFromPicker(date: D | null): void;
  /** Element the overlay anchors to when the picker is opened from the input. */
  getOverlayOrigin(): NgxDtOrigin;
}
```

- [ ] **Step 4: Add the registration state + `displayValue`** — inside the `NgxDtPicker` class, after the `_origin` signal declarations:

```ts
  private readonly _input = signal<NgxDtPickerInput<D> | null>(null);

  /**
   * Registers the text input that owns this picker's value. Idempotent for the
   * same input; throws if a different input tries to register.
   */
  registerInput(input: NgxDtPickerInput<D>): void {
    const existing = this._input();
    if (existing && existing !== input) {
      throw new Error('NgxDtPicker can only be associated with a single ngxDtInput.');
    }
    this._input.set(input);
  }

  /** Value shown by the calendar: the registered input's value, else the model value. */
  protected readonly displayValue = computed<D | null>(() => {
    const input = this._input();
    return input ? input.value() : this.value();
  });
```

- [ ] **Step 5: Rebind the calendar to `displayValue`** — in the template, change `[selected]="value()"` to `[selected]="displayValue()"`. And change `effectiveStartAt` to read `displayValue()`:

```ts
  protected readonly effectiveStartAt = computed(
    () => this.displayValue() ?? this.startAt() ?? this.adapter.today(),
  );
```

- [ ] **Step 6: Route selection + open through the input** — replace `onSelectedChange` and update `open()`:

```ts
  protected onSelectedChange(date: D | null): void {
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
```

In `open()`, after the `if (origin) { this._origin.set(origin); }` block, add an input fallback so the input can call `open()` with no argument:

```ts
  open(origin?: NgxDtOrigin): void {
    if (this.disabled() || this.inline() || this._open()) {
      return;
    }
    if (origin) {
      this._origin.set(origin);
    } else if (!this._origin()) {
      const input = this._input();
      if (input) {
        this._origin.set(input.getOverlayOrigin());
      }
    }
    if (!this._origin()) {
      return; // overlay requires an anchor element
    }
    this._open.set(true);
    this.openedChange.emit(true);
    this.opened.emit();
  }
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20`
Expected: PASS — all picker tests (Plan 2 + the new value-bridge tests) green.

- [ ] **Step 8: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts
git commit -m "feat(picker): value-bridge seam for registered text input

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `[ngxDtInput]` — value binding & parsing (CVA + picker bridge)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.ts`
- Test: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts`

- [ ] **Step 1: Write the failing tests** — create `ngx-dt-input.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtInput } from './ngx-dt-input';

@Component({
  imports: [NgxDtInput, NgxDtPicker],
  template: `
    <input [ngxDtInput]="picker" #input="ngxDtInput" (dateChange)="changed.set($event)" />
    <ngx-dt-picker #picker [inline]="true" />
  `,
})
class Host {
  readonly changed = signal<Temporal.PlainDate | null | undefined>(undefined);
  readonly input = viewChild.required<NgxDtInput<Temporal.PlainDate>>('input');
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

function inputEl(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}

function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtInput — value binding & parsing', () => {
  beforeEach(setup);

  it('parses typed ISO text into a date and emits dateChange', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();

    expect(fixture.componentInstance.input().value()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );
    expect(fixture.componentInstance.changed()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );
  });

  it('resolves unparseable text to null', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), 'not a date');
    fixture.detectChanges();

    expect(fixture.componentInstance.input().value()).toBeNull();
  });

  it('reformats the text to the display format on blur', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = inputEl(fixture);
    type(el, '2026-06-15');
    el.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    // en-US numeric display: M/D/YYYY
    expect(el.value).toBe('6/15/2026');
  });

  it('shows the calendar selection as formatted text (picker -> input)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.picker().value.set(null); // ensure registered
    const cell: HTMLElement = fixture.nativeElement.querySelector('.mat-calendar-body-cell');
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(inputEl(fixture).value).toMatch(/\d+\/\d+\/\d{4}/);
    expect(fixture.componentInstance.input().value()).toBeInstanceOf(Temporal.PlainDate);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20`
Expected: FAIL — `Cannot find module './ngx-dt-input'`.

- [ ] **Step 3: Create the directive** — `ngx-dt-input.ts`:

```ts
import {
  Directive,
  ElementRef,
  type OnInit,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  type ControlValueAccessor,
  NG_VALUE_ACCESSOR,
  NG_VALIDATORS,
} from '@angular/forms';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  type MatDateFormats,
} from '@angular/material/core';
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerInput,
} from '../picker/ngx-dt-picker';

/**
 * Text-field directive: parses/formats dates via the `DateAdapter`, owns the
 * value as a `ControlValueAccessor`, and bridges it to a registered
 * `NgxDtPicker`'s calendar. Works with a bare `<input>` and (for form-field
 * chrome) alongside Material's `matInput`.
 */
@Directive({
  selector: 'input[ngxDtInput]',
  exportAs: 'ngxDtInput',
  host: {
    class: 'ngx-dt-input',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event.target.value)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NgxDtInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NgxDtInput), multi: true },
  ],
})
export class NgxDtInput<D = unknown>
  implements ControlValueAccessor, OnInit, NgxDtPickerInput<D>
{
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly adapter = inject<DateAdapter<D>>(DateAdapter);
  private readonly dateFormats = inject<MatDateFormats>(MAT_DATE_FORMATS);

  /** The picker this input feeds; bind a template ref: `[ngxDtInput]="picker"`. */
  readonly picker = input.required<NgxDtPicker<D>>({ alias: 'ngxDtInput' });

  /** Emits whenever the committed value changes (typed, parsed, or chosen). */
  readonly dateChange = output<D | null>();

  private readonly _value = signal<D | null>(null);
  /** Current model value (read by the picker for `[selected]`). */
  readonly value = this._value.asReadonly();

  protected readonly _disabled = signal(false);

  /** Whether the latest text input parsed to a valid (or empty) date. */
  protected _lastValueValid = true;

  protected _onChange: (value: D | null) => void = () => {};
  protected _onTouched: () => void = () => {};

  ngOnInit(): void {
    this.picker().registerInput(this);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: D | null): void {
    const date = this.adapter.getValidDateOrNull(this.adapter.deserialize(value));
    this._lastValueValid = true;
    this._value.set(date);
    this._formatToInput(date);
  }

  registerOnChange(fn: (value: D | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  // --- NgxDtPickerInput (picker -> input) -----------------------------------

  setValueFromPicker(date: D | null): void {
    const value = this.adapter.getValidDateOrNull(date);
    this._lastValueValid = true;
    this._formatToInput(value);
    if (!this.adapter.sameDate(value, this._value())) {
      this._value.set(value);
      this._onChange(value);
      this.dateChange.emit(value);
    }
    this._onTouched();
  }

  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  // --- host handlers --------------------------------------------------------

  protected _onInput(text: string): void {
    const parsed = this.adapter.parse(text, this.dateFormats.parse.dateInput);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const date = this.adapter.getValidDateOrNull(parsed);
    if (!this.adapter.sameDate(date, this._value())) {
      this._value.set(date);
      this._onChange(date);
      this.dateChange.emit(date);
    }
  }

  protected _onBlur(): void {
    if (this._lastValueValid) {
      this._formatToInput(this._value());
    }
    this._onTouched();
  }

  protected _onKeydown(_event: KeyboardEvent): void {
    // Keyboard-open is added in Task 3.
  }

  private _formatToInput(date: D | null): void {
    this.elementRef.nativeElement.value =
      date && this.adapter.isValid(date)
        ? this.adapter.format(date, this.dateFormats.display.dateInput)
        : '';
  }
}
```

> Note: `effect` is imported now because Task 3 adds a validation `effect`; leaving the import unused for one task would not compile under `noUnusedLocals`. If the implementer prefers, omit the `effect` import here and add it in Task 3 — either is fine as long as each commit compiles. **Verify the build after this task; if `effect` is reported unused, remove it from the import until Task 3.**

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20`
Expected: PASS — value-binding & parsing tests green. (If `effect` import is flagged unused, remove it per the note, rebuild.)

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.ts projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts
git commit -m "feat(input): ngxDtInput CVA value binding + parse/format bridge

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `[ngxDtInput]` — keyboard open + validators

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.ts`
- Test: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts`

- [ ] **Step 1: Write the failing tests** — append to `ngx-dt-input.spec.ts`. First add the imports at the top of the file:

```ts
import { FormControl, ReactiveFormsModule } from '@angular/forms';
```

Then append:

```ts
describe('NgxDtInput — keyboard open', () => {
  beforeEach(setup);

  it('opens the picker on Alt+ArrowDown anchored to the input', async () => {
    @Component({
      imports: [NgxDtInput, NgxDtPicker],
      template: `
        <input [ngxDtInput]="picker" />
        <ngx-dt-picker #picker />
      `,
    })
    class OverlayInputHost {
      readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
    }

    const fixture = TestBed.createComponent(OverlayInputHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = inputEl(fixture);
    el.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
  });
});

describe('NgxDtInput — validators', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
    template: `
      <input [ngxDtInput]="picker" [formControl]="ctrl" />
      <ngx-dt-picker
        #picker
        [inline]="true"
        [min]="min"
        [max]="max"
        [dateFilter]="filter"
      />
    `,
  })
  class ValidatedHost {
    readonly ctrl = new FormControl<Temporal.PlainDate | null>(null);
    min = Temporal.PlainDate.from('2026-06-10');
    max = Temporal.PlainDate.from('2026-06-20');
    filter = (d: Temporal.PlainDate) => d.day !== 12;
  }

  it('reports ngxDtParse for unparseable text', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtParse')).toBe(true);
  });

  it('reports ngxDtMin below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-01');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-25');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('reports ngxDtFilter for a filtered-out date', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-12');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtFilter')).toBe(true);
  });

  it('passes validation for an in-range, allowed date', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20`
Expected: FAIL — keyboard-open does nothing (`_onKeydown` is a stub); `ctrl.hasError('ngxDtParse')` is false because the directive is not yet a `Validator`.

- [ ] **Step 3: Implement keyboard open** — replace the `_onKeydown` stub:

```ts
  protected _onKeydown(event: KeyboardEvent): void {
    if (event.altKey && event.key === 'ArrowDown' && !this._disabled()) {
      this.picker().open(this.elementRef);
      event.preventDefault();
    }
  }
```

- [ ] **Step 4: Make the directive a `Validator`** — update the class to implement `Validator`, add the validator imports, add `validate`/`registerOnValidatorChange`, and a constructor effect that re-validates when the picker's constraints change.

Update the `@angular/forms` import:

```ts
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
```

Update the class declaration:

```ts
export class NgxDtInput<D = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<D>
{
```

Add the validator-change field next to the other callbacks:

```ts
  protected _onValidatorChange: () => void = () => {};
```

Add a constructor that re-validates on constraint changes (place it above `ngOnInit`):

```ts
  constructor() {
    // The picker holds min/max/dateFilter; re-run validation when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.dateFilter();
      this._onValidatorChange();
    });
  }
```

Add the `Validator` methods (after `setDisabledState`):

```ts
  // --- Validator ------------------------------------------------------------

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._lastValueValid) {
      return { ngxDtParse: { text: this.elementRef.nativeElement.value } };
    }
    const value = this.adapter.getValidDateOrNull(this.adapter.deserialize(control.value));
    if (value === null) {
      return null;
    }
    const picker = this.picker();
    const min = picker.min();
    if (min && this.adapter.compareDate(min, value) > 0) {
      return { ngxDtMin: { min, actual: value } };
    }
    const max = picker.max();
    if (max && this.adapter.compareDate(max, value) < 0) {
      return { ngxDtMax: { max, actual: value } };
    }
    if (!picker.dateFilter()(value)) {
      return { ngxDtFilter: true };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }
```

Finally, call `this._onValidatorChange()` at the end of `_onInput` (so a parse-validity change triggers re-validation even when the resolved value is unchanged) and at the end of `setValueFromPicker`:

In `_onInput`, after the `if (!this.adapter.sameDate(...)) { ... }` block:

```ts
    this._onValidatorChange();
```

In `setValueFromPicker`, after `this._onTouched();`:

```ts
    this._onValidatorChange();
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx ng test --project date-time-picker 2>&1 | tail -20`
Expected: PASS — keyboard-open and all validator tests green.

- [ ] **Step 6: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.ts projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts
git commit -m "feat(input): Alt+ArrowDown open + parse/min/max/filter validators

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Public API exports + forms integration tests

**Files:**
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`
- Test: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.forms.spec.ts`

- [ ] **Step 1: Export the new symbols** — append to `public-api.ts`:

```ts
export { NgxDtInput } from './lib/input/ngx-dt-input';
export type { NgxDtPickerInput } from './lib/picker/ngx-dt-picker';
```

- [ ] **Step 2: Write the integration tests** — create `ngx-dt-input.forms.spec.ts`. These prove the single CVA covers Reactive Forms, `ngModel`, and Signal Forms (the `[formField]` compat path):

```ts
import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Field, form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtInput, NgxDtPicker } from 'ngx-datetime-picker';

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

function el(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('NgxDtInput — Reactive Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
    template: `
      <input [ngxDtInput]="picker" [formControl]="ctrl" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<Temporal.PlainDate | null>(null);
  }

  it('writes model -> text and text -> model', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // model -> view
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    expect(el(fixture).value).toBe('6/15/2026');

    // view -> model
    type(el(fixture), '2026-07-04');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.value).toEqual(Temporal.PlainDate.from('2026-07-04'));
  });

  it('disables the input via the control', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    expect(el(fixture).disabled).toBe(true);
  });
});

describe('NgxDtInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, FormsModule],
    template: `
      <input [ngxDtInput]="picker" [(ngModel)]="value" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class NgModelHost {
    value: Temporal.PlainDate | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    type(el(fixture), '2026-06-15');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value).toEqual(Temporal.PlainDate.from('2026-06-15'));
  });
});

describe('NgxDtInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, FormField],
    template: `
      <input [ngxDtInput]="picker" [formField]="f.date" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ date: Temporal.PlainDate | null }>({ date: null });
    readonly f = form(this.model);
    readonly dateField: Field<Temporal.PlainDate | null> = this.f.date;
  }

  it('binds value through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // view -> field state
    type(el(fixture), '2026-06-15');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.date().value()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );

    // field state -> view
    fixture.componentInstance.f.date().value.set(Temporal.PlainDate.from('2026-07-04'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el(fixture).value).toBe('7/4/2026');
  });
});
```

> **Implementer note:** Signal Forms field-state access (`f.date().value()` / `.value.set(...)`) is verified against `@angular/forms/signals` v22.0.2. If a field-access signature differs at compile time, consult `node_modules/@angular/forms/types/signals.d.ts` and the `signal-forms-api-v22` project memory — do NOT loosen types with `any`. The `FormField` import is the directive needed to make `[formField]` resolve in the template.

- [ ] **Step 3: Run the tests to verify they pass**

Run: `npx ng test --project date-time-picker 2>&1 | tail -25`
Expected: PASS — Reactive, ngModel, and Signal Forms integration green.

- [ ] **Step 4: Verify the library builds (ng-packagr resolves the new entry symbols)**

Run: `npx ng build date-time-picker 2>&1 | tail -15`
Expected: build succeeds; `NgxDtInput` and `NgxDtPickerInput` appear in the emitted `.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/public-api.ts projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.forms.spec.ts
git commit -m "feat(input): export NgxDtInput + forms integration tests (reactive/ngModel/signal)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Demo — mat-form-field input across all three forms systems

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

- [ ] **Step 1: Update the demo component** — replace `src/app/app.ts`:

```ts
import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Field, form, FormField } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterOutlet } from '@angular/router';
import { Temporal } from 'temporal-polyfill';
import { NgxDtInput, NgxDtPicker, NgxDtToggle } from 'ngx-datetime-picker';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ReactiveFormsModule,
    FormsModule,
    FormField,
    MatFormFieldModule,
    MatInputModule,
    NgxDtPicker,
    NgxDtToggle,
    NgxDtInput,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('date-time-picker');
  protected readonly inlineValue = signal<Temporal.PlainDate | null>(null);
  protected readonly popupValue = signal<Temporal.PlainDate | null>(null);

  // Reactive Forms
  protected readonly reactiveCtrl = new FormControl<Temporal.PlainDate | null>(null);

  // ngModel
  protected ngModelValue: Temporal.PlainDate | null = null;

  // Signal Forms
  protected readonly signalModel = signal<{ date: Temporal.PlainDate | null }>({ date: null });
  protected readonly signalForm = form(this.signalModel);
  protected readonly dateField: Field<Temporal.PlainDate | null> = this.signalForm.date;
}
```

- [ ] **Step 2: Update the demo template** — append these sections to `src/app/app.html`, before the closing `</main>` (keep the existing Inline + Popup sections):

```html
  <section>
    <h2>Reactive Forms (mat-form-field)</h2>
    <mat-form-field>
      <mat-label>Pick a date</mat-label>
      <input matInput [ngxDtInput]="rp" [formControl]="reactiveCtrl" />
      <ngx-dt-toggle matSuffix [for]="rp" />
    </mat-form-field>
    <ngx-dt-picker #rp />
    <p>Reactive value: {{ reactiveCtrl.value?.toString() ?? 'none' }}</p>
  </section>

  <section>
    <h2>Template-driven (ngModel)</h2>
    <mat-form-field>
      <mat-label>Pick a date</mat-label>
      <input matInput [ngxDtInput]="mp" [(ngModel)]="ngModelValue" />
      <ngx-dt-toggle matSuffix [for]="mp" />
    </mat-form-field>
    <ngx-dt-picker #mp />
    <p>ngModel value: {{ ngModelValue?.toString() ?? 'none' }}</p>
  </section>

  <section>
    <h2>Signal Forms</h2>
    <mat-form-field>
      <mat-label>Pick a date</mat-label>
      <input matInput [ngxDtInput]="sp" [formField]="signalForm.date" />
      <ngx-dt-toggle matSuffix [for]="sp" />
    </mat-form-field>
    <ngx-dt-picker #sp />
    <p>Signal value: {{ signalForm.date().value()?.toString() ?? 'none' }}</p>
  </section>
```

- [ ] **Step 3: Run the app unit tests + build**

Run: `npx ng test --project date-time-picker 2>&1 | tail -8 && npx ng build 2>&1 | tail -8`
Expected: app tests pass; app build succeeds (a bundle-size budget warning from Material input/form-field is acceptable — note it, do not fail on it).

- [ ] **Step 4: Manual + AXE verification (chrome-devtools MCP)**

Start the dev server in the background, navigate, and verify with the chrome-devtools MCP:
1. `npx ng serve --port 4280` (background).
2. Navigate to `http://localhost:4280/`.
3. Confirm no Angular error overlay.
4. In each mat-form-field: type `2026-06-15`, blur → text reformats to `6/15/2026`, the `<p>` value updates.
5. Open a picker via its `matSuffix` toggle (remember the zoneless quirk: the overlay opens one `requestAnimationFrame` after click — instrument via `evaluate_script` with `requestAnimationFrame` if a snapshot reads "closed"). Pick a day → input text + value update, overlay closes.
6. Run an AXE check (axe-core via `evaluate_script`, or the a11y snapshot) on the page. **MUST pass** (CLAUDE.md). Each input has a `<mat-label>` (accessible name); the toggle has `aria-label`; the dialog has `aria-label="Choose a date"`.
7. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "feat(demo): mat-form-field date input across reactive/ngModel/signal forms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review (planner checklist)

- **Spec coverage:** Plan 3 = design's "Phase 2 — Date picker" input half: `[ngxDtInput]` (CVA + parse/format), `MatFormFieldControl` (via `matInput` reuse — decision #1), Signal Forms binding, validators, toggle/keyboard open. Date-range, time, datetime are later plans. ✔
- **Placeholder scan:** every code step contains complete code; no TBD/TODO. The one conditional (`effect` import in Task 2) has explicit resolution instructions. ✔
- **Type consistency:** `registerInput(input: NgxDtPickerInput<D>)` matches the directive `implements NgxDtPickerInput<D>` with `value: () => D|null` (the `signal.asReadonly()` is callable), `setValueFromPicker(date: D|null)`, `getOverlayOrigin(): NgxDtOrigin`. `displayValue()` feeds `[selected]` (Plan 2 calendar typing unchanged). Error keys `ngxDtParse/Min/Max/Filter` consistent between `validate()` and tests. ✔
- **Reuse:** `matInput` for form-field chrome; `DateAdapter`/`MAT_DATE_FORMATS`; CVA-compat for Signal Forms. No reinvention. ✔

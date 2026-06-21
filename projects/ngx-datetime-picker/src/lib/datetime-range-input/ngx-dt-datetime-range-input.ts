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
import { DateRange } from '@angular/material/datepicker';
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerRangeInput,
} from '../picker/ngx-dt-picker';
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';

/** I/O contract one end (start/end input) exposes to the container. */
interface NgxDtDateTimeRangePart<T> {
  /** Writes formatted text (or empty) into the part's input element. */
  formatValue(value: T | null): void;
  /** Toggles the part's disabled state. */
  setDisabled(isDisabled: boolean): void;
  /** Current raw text in the input (for parse-error reporting). */
  rawText(): string;
}

/**
 * Two-input range container for datetime values. Owns one
 * `DateRange<PlainDateTime>` as a `ControlValueAccessor` + `Validator`, registers
 * with an `NgxDtPicker` (`type="datetime-range"`) through the
 * `NgxDtPickerRangeInput<T>` seam, and coordinates the two part directives.
 * Parallel sibling of `NgxDtDateRangeInput`, but datetime-typed.
 */
@Component({
  selector: 'ngx-dt-datetime-range-input',
  exportAs: 'ngxDtDateTimeRangeInput',
  template: `<ng-content />`,
  host: {
    class: 'ngx-dt-datetime-range-input',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtDateTimeRangeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtDateTimeRangeInput),
      multi: true,
    },
  ],
})
export class NgxDtDateTimeRangeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerRangeInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);

  /** The picker this range field feeds; bind a ref: `[rangePicker]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'rangePicker' });
  readonly ariaLabel = input('Datetime range');

  /** Emits whenever the committed range changes (typed or chosen). */
  readonly rangeChange = output<DateRange<T>>();

  private readonly _start = signal<T | null>(null);
  private readonly _end = signal<T | null>(null);
  /** Current start/end (read by the parts for reformatting). */
  readonly startValue = this._start.asReadonly();
  readonly endValue = this._end.asReadonly();

  /** Whether the latest text for each end parsed to a valid (or empty) value. */
  _startValid = true;
  _endValid = true;

  private _startPart: NgxDtDateTimeRangePart<T> | null = null;
  private _endPart: NgxDtDateTimeRangePart<T> | null = null;
  private _disabledState = false;

  /** Current range value (read by the picker for `[selected]`). */
  readonly range = computed<DateRange<T>>(
    () => new DateRange<T>(this._start(), this._end()),
  );

  private _onChange: (value: DateRange<T>) => void = () => {};
  private _onTouched: () => void = () => {};
  private _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max; re-validate when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerRangeInput(this);
  }

  // --- part registration (part -> container) --------------------------------

  _registerStart(part: NgxDtDateTimeRangePart<T>): void {
    this._startPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._start());
  }
  _registerEnd(part: NgxDtDateTimeRangePart<T>): void {
    this._endPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._end());
  }

  _setStart(value: T | null, valid: boolean): void {
    this._startValid = valid;
    if (!this.adapter.sameDateTime(value, this._start())) {
      this._start.set(value);
      this._emitChange();
    }
    this._onValidatorChange();
  }
  _setEnd(value: T | null, valid: boolean): void {
    this._endValid = valid;
    if (!this.adapter.sameDateTime(value, this._end())) {
      this._end.set(value);
      this._emitChange();
    }
    this._onValidatorChange();
  }
  _markTouched(): void {
    this._onTouched();
  }
  openPicker(): void {
    this.picker().open(this.elementRef);
  }

  private _emitChange(): void {
    const range = this.range();
    this._onChange(range);
    this.rangeChange.emit(range);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: DateRange<T> | null): void {
    const start = this._coerce(value?.start ?? null);
    const end = this._coerce(value?.end ?? null);
    this._startValid = true;
    this._endValid = true;
    this._start.set(start);
    this._end.set(end);
    this._startPart?.formatValue(start);
    this._endPart?.formatValue(end);
  }
  registerOnChange(fn: (value: DateRange<T>) => void): void {
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
    const value = control.value as DateRange<T> | null;
    const start = value?.start ?? null;
    const end = value?.end ?? null;
    const picker = this.picker();
    const min = picker.min();
    const max = picker.max();
    for (const dt of [start, end]) {
      if (dt === null) {
        continue;
      }
      if (min && this.adapter.compareDateTime(min, dt) > 0) {
        return { ngxDtMin: { min, actual: dt } };
      }
      if (max && this.adapter.compareDateTime(max, dt) < 0) {
        return { ngxDtMax: { max, actual: dt } };
      }
    }
    if (
      start !== null &&
      end !== null &&
      this.adapter.compareDateTime(end, start) < 0
    ) {
      return { ngxDtRangeOrder: { start, end } };
    }
    return null;
  }
  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerRangeInput (picker -> container) --------------------------

  setRangeFromPicker(range: DateRange<T>): void {
    this._startValid = true;
    this._endValid = true;
    const prevStart = this._start();
    const prevEnd = this._end();
    this._start.set(range.start);
    this._end.set(range.end);
    this._startPart?.formatValue(range.start);
    this._endPart?.formatValue(range.end);
    if (
      !this.adapter.sameDateTime(range.start, prevStart) ||
      !this.adapter.sameDateTime(range.end, prevEnd)
    ) {
      this._onChange(range);
      this.rangeChange.emit(range);
    }
    this._onTouched();
    this._onValidatorChange();
  }
  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  /** Coerce a control value to a valid datetime or null (already-`T` or text). */
  private _coerce(value: unknown): T | null {
    if (value == null) {
      return null;
    }
    if (this.adapter.isValid(value as T)) {
      return value as T;
    }
    const parsed = this.adapter.parse(value);
    return parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
  }
}

/**
 * Shared parse/format/IO for one end of a datetime range. Subclassed by the
 * start and end directives; each reports its parsed value to, and reads its
 * current value from, the parent container. Parallel sibling of
 * `NgxDtDateRangePartBase`, but uses the datetime adapter (single-arg
 * `parse`/`format`).
 */
@Directive()
export abstract class NgxDtDateTimeRangePartBase<T = unknown>
  implements NgxDtDateTimeRangePart<T>
{
  protected readonly elementRef =
    inject<ElementRef<HTMLInputElement>>(ElementRef);
  protected readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);
  protected readonly parent =
    inject<NgxDtDateTimeRangeInput<T>>(NgxDtDateTimeRangeInput);

  protected readonly _disabled = signal(false);
  _lastValueValid = true;

  /** Reports the parsed value + parse-validity to the container. */
  protected abstract _report(value: T | null, valid: boolean): void;
  /** The value the container currently holds for this end (for reformatting). */
  protected abstract _currentValue(): T | null;
  /** Registers this part with the container. */
  protected abstract _register(): void;

  ngOnInit(): void {
    this._register();
  }

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const value =
      parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    this._report(value, this._lastValueValid);
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

  formatValue(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value) ? this.adapter.format(value) : '';
  }
  setDisabled(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }
  rawText(): string {
    return this.elementRef.nativeElement.value;
  }
}

@Directive({
  selector: 'input[ngxDtStartDateTime]',
  exportAs: 'ngxDtStartDateTime',
  host: {
    class: 'ngx-dt-range-start',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtStartDateTime<T = unknown>
  extends NgxDtDateTimeRangePartBase<T>
  implements OnInit
{
  protected _report(value: T | null, valid: boolean): void {
    this.parent._setStart(value, valid);
  }
  protected _currentValue(): T | null {
    return this.parent.startValue();
  }
  protected _register(): void {
    this.parent._registerStart(this);
  }
}

@Directive({
  selector: 'input[ngxDtEndDateTime]',
  exportAs: 'ngxDtEndDateTime',
  host: {
    class: 'ngx-dt-range-end',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtEndDateTime<T = unknown>
  extends NgxDtDateTimeRangePartBase<T>
  implements OnInit
{
  protected _report(value: T | null, valid: boolean): void {
    this.parent._setEnd(value, valid);
  }
  protected _currentValue(): T | null {
    return this.parent.endValue();
  }
  protected _register(): void {
    this.parent._registerEnd(this);
  }
}

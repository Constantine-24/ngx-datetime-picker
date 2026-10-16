import {
  Directive,
  ElementRef,
  effect,
  type OnInit,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { NgxDtPicker, type NgxDtOrigin, type NgxDtPickerInput } from '../picker/ngx-dt-picker';
import { NgxDtTimeAdapter } from '../time/ngx-dt-time-adapter';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { resolveHourCycle } from '../util/hour-cycle';

/**
 * Text-field directive for time values: parses/formats via `NgxDtTimeAdapter`,
 * owns the value as a `ControlValueAccessor`, and bridges it to a registered
 * `NgxDtPicker` (`type="time"`) through the shared `NgxDtPickerInput` seam.
 */
@Directive({
  selector: 'input[ngxDtTimeInput]',
  exportAs: 'ngxDtTimeInput',
  host: {
    class: 'ngx-dt-time-input',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtTimeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtTimeInput),
      multi: true,
    },
  ],
})
export class NgxDtTimeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly adapter = inject<NgxDtTimeAdapter<T>>(NgxDtTimeAdapter);
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';

  /** The picker this input feeds; bind a template ref: `[ngxDtTimeInput]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'ngxDtTimeInput' });

  /** Emits whenever the committed time changes (typed, parsed, or chosen). */
  readonly timeChange = output<T | null>();

  private readonly _value = signal<T | null>(null);
  /** Current model value (read by the picker for the time panel). */
  readonly value = this._value.asReadonly();

  protected readonly _disabled = signal(false);

  /** Whether the latest text input parsed to a valid (or empty) time. */
  protected _lastValueValid = true;

  protected _onChange: (value: T | null) => void = () => {};
  protected _onTouched: () => void = () => {};
  protected _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max/timeFilter; re-run validation when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.timeFilter();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerInput(this);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: T | null): void {
    const time = this._coerce(value);
    this._lastValueValid = true;
    this._value.set(time);
    this._formatToInput(time);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  // --- Validator ------------------------------------------------------------

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._lastValueValid) {
      return { ngxDtParse: { text: this.elementRef.nativeElement.value } };
    }
    const value = this._coerce(control.value);
    if (value === null) {
      return null;
    }
    const picker = this.picker();
    const min = picker.min();
    if (min && this.adapter.compareTime(min, value) > 0) {
      return { ngxDtMin: { min, actual: value } };
    }
    const max = picker.max();
    if (max && this.adapter.compareTime(max, value) < 0) {
      return { ngxDtMax: { max, actual: value } };
    }
    if (!picker.timeFilter()(value)) {
      return { ngxDtFilter: true };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerInput (picker -> input) -----------------------------------

  setValueFromPicker(time: T | null): void {
    const value = this._coerce(time);
    this._lastValueValid = true;
    this._formatToInput(value);
    if (!this.adapter.sameTime(value, this._value())) {
      this._value.set(value);
      this._onChange(value);
      this.timeChange.emit(value);
    }
    this._onTouched();
    this._onValidatorChange();
  }

  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  // --- host handlers --------------------------------------------------------

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const time = parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    if (!this.adapter.sameTime(time, this._value())) {
      this._value.set(time);
      this._onChange(time);
      this.timeChange.emit(time);
    }
    this._onValidatorChange();
  }

  protected _onBlur(): void {
    if (this._lastValueValid) {
      this._formatToInput(this._value());
    }
    this._onTouched();
  }

  protected _onKeydown(event: KeyboardEvent): void {
    if (event.altKey && event.key === 'ArrowDown' && !this._disabled()) {
      this.picker().open(this.elementRef);
      event.preventDefault();
    }
  }

  /** Coerce a control value to a valid time or null (already-`T` or parseable text). */
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

  private _formatToInput(time: T | null): void {
    this.elementRef.nativeElement.value =
      time && this.adapter.isValid(time) ? this.adapter.format(time, this._displayOptions()) : '';
  }

  /** Display options that honor the picker's effective hour cycle. */
  private _displayOptions(): Intl.DateTimeFormatOptions {
    const cycle = resolveHourCycle(this.picker().hourCycle(), this.locale);
    return { hour: '2-digit', minute: '2-digit', hour12: cycle === 12 };
  }
}

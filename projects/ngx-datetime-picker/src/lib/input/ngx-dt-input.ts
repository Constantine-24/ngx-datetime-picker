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
import { DateAdapter, MAT_DATE_FORMATS, type MatDateFormats } from '@angular/material/core';
import { NgxDtPicker, type NgxDtOrigin, type NgxDtPickerInput } from '../picker/ngx-dt-picker';

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
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NgxDtInput), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NgxDtInput), multi: true },
  ],
})
export class NgxDtInput<D = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<D>
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
  protected _onValidatorChange: () => void = () => {};

  constructor() {
    // Re-validate whenever the picker's constraints change. The required `picker`
    // input is resolved before this effect first runs, so `this.picker()` is safe.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.dateFilter();
      this._onValidatorChange();
    });
  }

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
    this._onValidatorChange();
  }

  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  // --- host handlers --------------------------------------------------------

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text, this.dateFormats.parse.dateInput);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const date = this.adapter.getValidDateOrNull(parsed);
    if (!this.adapter.sameDate(date, this._value())) {
      this._value.set(date);
      this._onChange(date);
      this.dateChange.emit(date);
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

  private _formatToInput(date: D | null): void {
    this.elementRef.nativeElement.value =
      date && this.adapter.isValid(date)
        ? this.adapter.format(date, this.dateFormats.display.dateInput)
        : '';
  }
}

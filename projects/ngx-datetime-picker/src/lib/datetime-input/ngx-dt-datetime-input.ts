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
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerInput,
} from '../picker/ngx-dt-picker';
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';

/**
 * Text-field directive for datetime values: parses/formats via
 * `NgxDtDateTimeAdapter`, owns the value as a `ControlValueAccessor`, and bridges
 * it to a registered `NgxDtPicker` (`type="datetime"`) through the shared
 * `NgxDtPickerInput` seam. Mirrors `NgxDtTimeInput`.
 */
@Directive({
  selector: 'input[ngxDtDateTimeInput]',
  exportAs: 'ngxDtDateTimeInput',
  host: {
    class: 'ngx-dt-datetime-input',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtDateTimeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtDateTimeInput),
      multi: true,
    },
  ],
})
export class NgxDtDateTimeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);

  /** The picker this input feeds; bind a template ref: `[ngxDtDateTimeInput]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'ngxDtDateTimeInput' });

  /** Emits whenever the committed datetime changes (typed, parsed, or chosen). */
  readonly dateTimeChange = output<T | null>();

  private readonly _value = signal<T | null>(null);
  /** Current model value (read by the picker). */
  readonly value = this._value.asReadonly();

  protected readonly _disabled = signal(false);

  /** Whether the latest text input parsed to a valid (or empty) datetime. */
  protected _lastValueValid = true;

  protected _onChange: (value: T | null) => void = () => {};
  protected _onTouched: () => void = () => {};
  protected _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max; re-run validation when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerInput(this);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: T | null): void {
    const v = this._coerce(value);
    this._lastValueValid = true;
    this._value.set(v);
    this._formatToInput(v);
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
    if (min && this.adapter.compareDateTime(min, value) > 0) {
      return { ngxDtMin: { min, actual: value } };
    }
    const max = picker.max();
    if (max && this.adapter.compareDateTime(max, value) < 0) {
      return { ngxDtMax: { max, actual: value } };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerInput (picker -> input) -----------------------------------

  setValueFromPicker(value: T | null): void {
    const v = this._coerce(value);
    this._lastValueValid = true;
    this._formatToInput(v);
    if (!this.adapter.sameDateTime(v, this._value())) {
      this._value.set(v);
      this._onChange(v);
      this.dateTimeChange.emit(v);
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
    const value = parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    if (!this.adapter.sameDateTime(value, this._value())) {
      this._value.set(value);
      this._onChange(value);
      this.dateTimeChange.emit(value);
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

  /** Coerce a control value to a valid datetime or null (already-`T` or parseable text). */
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

  private _formatToInput(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value) ? this.adapter.format(value) : '';
  }
}

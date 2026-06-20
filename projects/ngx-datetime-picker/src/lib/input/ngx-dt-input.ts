import {
  Directive,
  ElementRef,
  type OnInit,
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
    '(input)': '_onInput($any($event.target).value)',
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

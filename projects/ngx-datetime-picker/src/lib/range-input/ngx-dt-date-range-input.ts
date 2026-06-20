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

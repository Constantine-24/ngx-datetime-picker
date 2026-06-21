import { NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule, type ConnectedPosition } from '@angular/cdk/overlay';
import {
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  type Signal,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import {
  DateRange,
  DefaultMatCalendarRangeStrategy,
  MatCalendar,
  MAT_DATE_RANGE_SELECTION_STRATEGY,
  type MatCalendarUserEvent,
  type MatDateRangeSelectionStrategy,
} from '@angular/material/datepicker';
import { NGX_DT_DEFAULT_OPTIONS } from '../tokens';
import { NgxDtTimePanel } from '../time-panel/ngx-dt-time-panel';
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';

/** Picker variants. All five are implemented. */
export type NgxDtPickerType =
  | 'date'
  | 'date-range'
  | 'time'
  | 'datetime'
  | 'datetime-range';

/** Element the overlay anchors to. */
export type NgxDtOrigin = ElementRef | HTMLElement;

/**
 * Contract a text input must satisfy to own a picker's value.
 * Kept here (not imported from the input) so the picker has no dependency on
 * the input directive — the input imports this, not the other way around.
 */
export interface NgxDtPickerInput<D> {
  /** Current model value as a signal — read reactively inside the calendar binding. */
  readonly value: Signal<D | null>;
  /** Called by the picker when the calendar selection changes. */
  setValueFromPicker(date: D | null): void;
  /** Element the overlay anchors to when the picker is opened from the input. */
  getOverlayOrigin(): NgxDtOrigin;
}

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

const PICKER_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

@Component({
  selector: 'ngx-dt-picker',
  exportAs: 'ngxDtPicker',
  imports: [NgTemplateOutlet, OverlayModule, A11yModule, MatCalendar, NgxDtTimePanel],
  template: `
    @if (inline()) {
      <div class="ngx-dt-panel" role="group" [attr.aria-label]="ariaLabel()">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
    } @else if (origin(); as originEl) {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="originEl"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayHasBackdrop]="hasBackdrop()"
        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
        (backdropClick)="close()"
        (overlayKeydown)="onOverlayKeydown($event)"
        (detach)="close()"
      >
        <div
          class="ngx-dt-panel"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="ariaLabel()"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
        >
          <ng-container [ngTemplateOutlet]="panel" />
        </div>
      </ng-template>
    }

    <ng-template #panel>
      @if (isTime()) {
        <ngx-dt-time-panel
          [value]="timePanelValue()"
          (valueChange)="onTimeChange($event)"
          [min]="timePanelMin()"
          [max]="timePanelMax()"
          [hourCycle]="hourCycle()"
          [minuteStep]="minuteStep()"
          [showSeconds]="showSeconds()"
          [disabled]="disabled()"
          [ariaLabel]="ariaLabel()"
        />
      } @else {
        <div class="ngx-dt-body" [class.ngx-dt-body-datetime]="isDateTime()">
          <mat-calendar
            [startAt]="effectiveStartAt()"
            [startView]="startView()"
            [selected]="calendarSelection()"
            [minDate]="calendarMin()"
            [maxDate]="calendarMax()"
            [dateFilter]="dateFilter()"
            (selectedChange)="onSelectedChange($event)"
            (_userSelection)="onUserSelection($event)"
          />
          @if (isDateTime()) {
            <ngx-dt-time-panel
              [value]="timePanelValue()"
              (valueChange)="onTimeChange($event)"
              [min]="timePanelMin()"
              [max]="timePanelMax()"
              [hourCycle]="hourCycle()"
              [minuteStep]="minuteStep()"
              [showSeconds]="showSeconds()"
              [disabled]="disabled()"
              ariaLabel="Choose a time"
            />
            <div class="ngx-dt-actions" role="group" aria-label="Datetime actions">
              <button
                type="button"
                class="ngx-dt-action"
                data-testid="dt-now"
                [disabled]="disabled()"
                (click)="onNowClick()"
              >
                Now
              </button>
              <button
                type="button"
                class="ngx-dt-action"
                data-testid="dt-clear"
                [disabled]="disabled()"
                (click)="onClearClick()"
              >
                Clear
              </button>
              @if (!inline()) {
                <button
                  type="button"
                  class="ngx-dt-action ngx-dt-action-primary"
                  data-testid="dt-done"
                  (click)="onDoneClick()"
                >
                  Done
                </button>
              }
            </div>
          }
        </div>
      }
    </ng-template>
  `,
  styles: [
    `
      .ngx-dt-body-datetime {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
      .ngx-dt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px;
      }
      .ngx-dt-action {
        min-height: 32px;
        min-width: 48px;
        padding: 4px 12px;
        border: 1px solid var(--mat-sys-outline, currentColor);
        border-radius: 4px;
        background: transparent;
        color: var(--mat-sys-on-surface, inherit);
        font: inherit;
        cursor: pointer;
      }
      .ngx-dt-action:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-action:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-action[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-action-primary {
        background: var(--mat-sys-primary, Highlight);
        color: var(--mat-sys-on-primary, HighlightText);
        border-color: transparent;
      }
    `,
  ],
  host: { class: 'ngx-dt-picker' },
  providers: [
    {
      provide: MAT_DATE_RANGE_SELECTION_STRATEGY,
      useClass: DefaultMatCalendarRangeStrategy,
    },
  ],
})
export class NgxDtPicker<D = unknown> {
  private readonly adapter = inject<DateAdapter<D>>(DateAdapter, { optional: true });
  private readonly dtAdapter = inject<NgxDtDateTimeAdapter<D>>(NgxDtDateTimeAdapter, {
    optional: true,
  });
  private readonly injector = inject(Injector);
  private readonly options = inject(NGX_DT_DEFAULT_OPTIONS);
  private readonly _emptyRange = new DateRange<D>(null, null);

  readonly type = input<NgxDtPickerType>('date');
  readonly inline = input(false);
  readonly startAt = input<D | null>(null);
  readonly startView = input<'month' | 'year' | 'multi-year'>('month');
  readonly min = input<D | null>(null);
  readonly max = input<D | null>(null);
  readonly dateFilter = input<(date: D) => boolean>(() => true);
  readonly disabled = input(false);
  readonly hasBackdrop = input(this.options.hasBackdrop);
  readonly restoreFocus = input(this.options.restoreFocus);
  readonly ariaLabel = input('Choose a date');

  /** Two-way selected value. `model()` provides the `valueChange` output. */
  readonly value = model<D | null>(null);

  /** Two-way range value (used when `type === 'date-range'`). */
  readonly range = model<DateRange<D> | null>(null);

  /** Whether the picker is in range-selection mode. */
  readonly isRange = computed(() => this.type() === 'date-range');

  readonly hourCycle = input<12 | 24 | null>(null);
  readonly minuteStep = input(1);
  readonly showSeconds = input(false);

  readonly isTime = computed(() => this.type() === 'time');
  readonly isDateTime = computed(() => this.type() === 'datetime');
  readonly isDateTimeRange = computed(() => this.type() === 'datetime-range');

  /** The calendar runs in range-selection mode for both range variants. */
  readonly calendarRangeMode = computed(
    () => this.isRange() || this.isDateTimeRange(),
  );

  /** Either datetime variant decomposes the value into date + time parts. */
  readonly isAnyDateTime = computed(
    () => this.isDateTime() || this.isDateTimeRange(),
  );

  readonly openedChange = output<boolean>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  protected readonly positions = PICKER_POSITIONS;

  private readonly _open = signal(false);
  /** Whether the overlay is currently open. */
  readonly isOpen = this._open.asReadonly();

  private readonly _origin = signal<NgxDtOrigin | null>(null);
  protected readonly origin = this._origin.asReadonly();

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

  /**
   * The date part of a datetime value, cast to `D` for the loosely-typed
   * MatCalendar bindings. (In datetime mode the calendar is backed by the
   * PlainDate DateAdapter, so a date part is what it actually consumes.)
   */
  private datePart(value: D | null): D | null {
    const dt = this.dtAdapter;
    return dt && value != null && dt.isValid(value)
      ? (dt.getDate(value) as unknown as D)
      : null;
  }

  /** What the calendar's `[selected]` binds to — a range, a date, or a date part. */
  protected readonly calendarSelection = computed<DateRange<D> | D | null>(() => {
    if (this.isRange()) {
      return this.rangeDisplayValue() ?? this._emptyRange;
    }
    if (this.isDateTimeRange()) {
      // The calendar runs the PlainDate adapter, so it consumes the date parts
      // of the datetime range. `datePart` already casts via `as unknown as D`.
      const r = this.rangeDisplayValue();
      return new DateRange<D>(
        this.datePart(r?.start ?? null),
        this.datePart(r?.end ?? null),
      );
    }
    if (this.isDateTime()) {
      return this.datePart(this.displayValue());
    }
    return this.displayValue();
  });

  /** Calendar `[minDate]`/`[maxDate]` — date parts in either datetime mode. */
  protected readonly calendarMin = computed<D | null>(() =>
    this.isAnyDateTime() ? this.datePart(this.min()) : this.min(),
  );
  protected readonly calendarMax = computed<D | null>(() =>
    this.isAnyDateTime() ? this.datePart(this.max()) : this.max(),
  );

  /** Value bound to the time panel — the time part in datetime mode, else the value. */
  protected readonly timePanelValue = computed<D | null>(() => {
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      const v = this.displayValue();
      return dt && v != null && dt.isValid(v) ? (dt.getTime(v) as unknown as D) : null;
    }
    return this.displayValue();
  });

  /**
   * Time-panel floor: the min's time, but only on the min's day. On any later
   * day there is no time floor. In pure-time mode the picker `min` is itself a
   * time. (`max` is symmetric.)
   */
  private boundaryTime(bound: D | null): D | null {
    if (!this.isDateTime()) return null;
    const dt = this.dtAdapter;
    const v = this.displayValue();
    if (!dt || bound == null || v == null || !dt.isValid(bound) || !dt.isValid(v)) {
      return null;
    }
    return dt.compareDate(v, bound) === 0 ? (dt.getTime(bound) as unknown as D) : null;
  }

  protected readonly timePanelMin = computed<D | null>(() =>
    this.isTime() ? this.min() : this.boundaryTime(this.min()),
  );
  protected readonly timePanelMax = computed<D | null>(() =>
    this.isTime() ? this.max() : this.boundaryTime(this.max()),
  );

  protected readonly effectiveStartAt = computed(() => {
    const adapter = this.adapter;
    if (!adapter) {
      return null;
    }
    let anchor: D | null;
    if (this.isDateTimeRange()) {
      anchor = this.datePart(this.rangeDisplayValue()?.start ?? null);
    } else if (this.isRange()) {
      anchor = this.rangeDisplayValue()?.start ?? null;
    } else if (this.isDateTime()) {
      anchor = this.datePart(this.displayValue());
    } else {
      anchor = this.displayValue();
    }
    const startAt = this.isAnyDateTime()
      ? this.datePart(this.startAt())
      : this.startAt();
    return anchor ?? startAt ?? adapter.today();
  });

  /** Open the overlay anchored to `origin`. No-op if disabled, inline, or already open. */
  open(origin?: NgxDtOrigin): void {
    if (this.disabled() || this.inline() || this._open()) {
      return;
    }
    // Anchor precedence: an explicit origin wins; otherwise prefer the
    // registered single-date input, then the registered range input (the
    // canonical anchors for a text-field picker), falling back to any
    // previously-set origin.
    const anchor =
      origin ??
      this._input()?.getOverlayOrigin() ??
      this._rangeInput()?.getOverlayOrigin() ??
      this._origin();
    if (!anchor) {
      return; // overlay requires an anchor element
    }
    this._origin.set(anchor);
    this._open.set(true);
    this.openedChange.emit(true);
    this.opened.emit();
  }

  /** Close the overlay and (optionally) restore focus to the trigger. */
  close(): void {
    if (!this._open()) {
      return;
    }
    this._open.set(false);
    this.openedChange.emit(false);
    this.closed.emit();
    if (this.restoreFocus()) {
      this.focusOrigin();
    }
  }

  toggle(origin?: NgxDtOrigin): void {
    this._open() ? this.close() : this.open(origin);
  }

  /** Write a value through the registered input seam, else the model. */
  private commitValue(value: D | null): void {
    const input = this._input();
    if (input) {
      input.setValueFromPicker(value);
    } else {
      this.value.set(value);
    }
  }

  /** Write a range through the registered range input seam, else the model. */
  private commitRange(range: DateRange<D>): void {
    const input = this._rangeInput();
    if (input) {
      input.setRangeFromPicker(range);
    } else {
      this.range.set(range);
    }
  }

  protected onSelectedChange(date: D | null): void {
    if (this.calendarRangeMode()) {
      return; // range selection is handled via (_userSelection)
    }
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const next =
        date == null
          ? null
          : dt.clampDateTime(dt.withDate(this.displayValue(), date), this.min(), this.max());
      this.commitValue(next);
      return; // datetime stays open — the time still needs setting
    }
    this.commitValue(date);
    if (!this.inline()) {
      this.close();
    }
  }

  protected onUserSelection(event: MatCalendarUserEvent<D | null>): void {
    if (!this.calendarRangeMode()) {
      return; // single-date selection is handled via (selectedChange)
    }
    const strategy = this.injector.get<MatDateRangeSelectionStrategy<D>>(
      MAT_DATE_RANGE_SELECTION_STRATEGY,
    );

    if (this.isDateTimeRange()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const current = this.rangeDisplayValue() ?? this._emptyRange;
      // Feed the strategy a date-part range (it compares dates); then lift each
      // end back to a datetime, carrying its existing time (or midnight) and
      // clamping the composed value into [min, max].
      const currentDates = new DateRange<D>(
        this.datePart(current.start),
        this.datePart(current.end),
      );
      const nextDates = strategy.selectionFinished(
        event.value,
        currentDates,
        event.event,
      );
      const start =
        nextDates.start == null
          ? null
          : dt.clampDateTime(
              dt.withDate(current.start, nextDates.start),
              this.min(),
              this.max(),
            );
      const end =
        nextDates.end == null
          ? null
          : dt.clampDateTime(
              dt.withDate(current.end, nextDates.end),
              this.min(),
              this.max(),
            );
      this.commitRange(new DateRange<D>(start, end));
      return; // datetime-range stays open — the time still needs setting
    }

    const current = this.rangeDisplayValue() ?? this._emptyRange;
    const next = strategy.selectionFinished(event.value, current, event.event);
    this.commitRange(next);
    if (!this.inline() && next.start !== null && next.end !== null) {
      this.close();
    }
  }

  protected onTimeChange(time: D | null): void {
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const next =
        time == null
          ? null
          : dt.clampDateTime(dt.withTime(this.displayValue(), time), this.min(), this.max());
      this.commitValue(next);
      return; // never auto-close
    }
    this.commitValue(time); // pure time mode
  }

  protected onNowClick(): void {
    const dt = this.dtAdapter;
    if (!dt) return;
    this.commitValue(dt.clampDateTime(dt.now(), this.min(), this.max()));
  }

  protected onClearClick(): void {
    this.commitValue(null);
  }

  protected onDoneClick(): void {
    this.close();
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    const noModifier =
      !event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
    if (event.key === 'Escape' && noModifier) {
      event.preventDefault();
      this.close();
    }
  }

  private focusOrigin(): void {
    const origin = this._origin();
    const el = origin instanceof ElementRef ? origin.nativeElement : origin;
    (el as HTMLElement | null)?.focus?.();
  }
}

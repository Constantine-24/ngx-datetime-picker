import { NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { Directionality } from '@angular/cdk/bidi';
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
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
import { NgxDtEmptyCalendarHeader } from './ngx-dt-empty-calendar-header';

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
      <div class="ngx-dt-panel" role="group" [attr.aria-label]="ariaLabel()" [attr.dir]="direction()">
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
          [attr.dir]="direction()"
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
          [timeFilter]="timeFilter()"
        />
      } @else {
        <div class="ngx-dt-body" [class.ngx-dt-body-datetime]="isAnyDateTime()">
          @if (dualCalendars()) {
            <div class="ngx-dt-calendars">
              <div class="ngx-dt-cal-nav" role="group" aria-label="Calendar navigation">
                <button
                  type="button"
                  class="ngx-dt-cal-arrow"
                  data-testid="cal-prev"
                  [disabled]="disabled()"
                  aria-label="Previous month"
                  (click)="onPrevMonth()"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <span class="ngx-dt-cal-label">{{ monthLabel(activeMonthStart()) }}</span>
                <span class="ngx-dt-cal-label">{{ monthLabel(activeMonthNext()) }}</span>
                <button
                  type="button"
                  class="ngx-dt-cal-arrow"
                  data-testid="cal-next"
                  [disabled]="disabled()"
                  aria-label="Next month"
                  (click)="onNextMonth()"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              <div class="ngx-dt-calendars-row">
                @for (m of dualMonths(); track m.key) {
                  <mat-calendar
                    [startAt]="m.start"
                    [startView]="'month'"
                    [headerComponent]="emptyHeader"
                    [selected]="calendarSelection()"
                    [minDate]="calendarMin()"
                    [maxDate]="calendarMax()"
                    [dateFilter]="dateFilter()"
                    (selectedChange)="onSelectedChange($event)"
                    (_userSelection)="onUserSelection($event)"
                  />
                }
              </div>
            </div>
          } @else {
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
          }
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
              [timeFilter]="timeFilter()"
            />
          }
          @if (isDateTimeRange()) {
            <div class="ngx-dt-range-times">
              <div class="ngx-dt-range-time">
                <span class="ngx-dt-range-time-label">Start time</span>
                <ngx-dt-time-panel
                  [value]="startTimePanelValue()"
                  (valueChange)="onStartTimeChange($event)"
                  [min]="startTimePanelMin()"
                  [max]="startTimePanelMax()"
                  [hourCycle]="hourCycle()"
                  [minuteStep]="minuteStep()"
                  [showSeconds]="showSeconds()"
                  [disabled]="disabled()"
                  ariaLabel="Choose a start time"
                  [timeFilter]="timeFilter()"
                />
              </div>
              <div class="ngx-dt-range-time">
                <span class="ngx-dt-range-time-label">End time</span>
                <ngx-dt-time-panel
                  [value]="endTimePanelValue()"
                  (valueChange)="onEndTimeChange($event)"
                  [min]="endTimePanelMin()"
                  [max]="endTimePanelMax()"
                  [hourCycle]="hourCycle()"
                  [minuteStep]="minuteStep()"
                  [showSeconds]="showSeconds()"
                  [disabled]="disabled()"
                  ariaLabel="Choose an end time"
                  [timeFilter]="timeFilter()"
                />
              </div>
            </div>
          }
          @if (showFooter()) {
            <div class="ngx-dt-actions" role="group" aria-label="Actions">
              @if (isAnyDateTime()) {
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
              }
              @if (draftMode() && !inline()) {
                <button
                  type="button"
                  class="ngx-dt-action"
                  data-testid="dt-cancel"
                  (click)="onCancelClick()"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="ngx-dt-action ngx-dt-action-primary"
                  data-testid="dt-apply"
                  (click)="onApplyClick()"
                >
                  Apply
                </button>
              } @else if (isAnyDateTime() && !inline()) {
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
      .ngx-dt-range-times {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ngx-dt-range-time {
        display: flex;
        flex-direction: column;
      }
      .ngx-dt-range-time-label {
        padding: 0 8px;
        font: var(--mat-sys-label-small, inherit);
        color: var(--mat-sys-on-surface-variant, inherit);
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
      .ngx-dt-calendars-row {
        display: flex;
        gap: 8px;
      }
      .ngx-dt-cal-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
      }
      .ngx-dt-cal-label {
        flex: 1;
        text-align: center;
        font: var(--mat-sys-title-small, inherit);
        color: var(--mat-sys-on-surface, inherit);
      }
      .ngx-dt-cal-arrow {
        min-width: 32px;
        min-height: 32px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--mat-sys-on-surface-variant, currentColor);
        cursor: pointer;
      }
      .ngx-dt-cal-arrow:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-cal-arrow:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-cal-arrow[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      @media (prefers-reduced-motion: reduce) {
        .ngx-dt-panel,
        .ngx-dt-panel * {
          transition: none !important;
          animation: none !important;
        }
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

  private readonly dir = inject(Directionality, { optional: true });
  private readonly _direction = signal<'ltr' | 'rtl'>(this.dir?.value ?? 'ltr');
  protected readonly direction = this._direction.asReadonly();

  constructor() {
    this.dir?.change
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this._direction.set(value));
  }

  readonly type = input<NgxDtPickerType>('date');
  readonly inline = input(false);
  readonly startAt = input<D | null>(null);
  readonly startView = input<'month' | 'year' | 'multi-year'>('month');
  readonly min = input<D | null>(null);
  readonly max = input<D | null>(null);
  /** Predicate to disable individual calendar dates. For datetime variants the argument is the date part of the datetime value. */
  readonly dateFilter = input<(date: D) => boolean>(() => true);
  /** Show two side-by-side calendars in range modes (`1` for single calendar, `2` for dual). Ignored for non-range variants. */
  readonly monthsToDisplay = input<1 | 2>(1);
  /** Buffer all changes into a draft until the user confirms with Apply; Cancel discards the draft without updating the form. */
  readonly draftMode = input(false);
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
  /** Predicate to disable individual time steps in the time panel. Receives a time value of type `D`. */
  readonly timeFilter = input<(time: D) => boolean>(() => true);

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

  /** Footer renders for datetime variants (Now/Clear) and/or draft mode (Apply/Cancel). */
  protected readonly showFooter = computed(
    () => this.isAnyDateTime() || (this.draftMode() && !this.inline()),
  );

  readonly openedChange = output<boolean>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  protected readonly positions = PICKER_POSITIONS;

  private readonly _open = signal(false);
  /** Whether the overlay is currently open. */
  readonly isOpen = this._open.asReadonly();

  private readonly _draftActive = signal(false);
  private readonly _draftValue = signal<D | null>(null);
  private readonly _draftRange = signal<DateRange<D> | null>(null);

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

  /** Value shown by the calendar: the draft while drafting, the registered input's value, else the model value. */
  protected readonly displayValue = computed<D | null>(() => {
    if (this._draftActive()) return this._draftValue();
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

  /** Range shown by the calendar: the draft while drafting, the registered range input's value, else the model. */
  protected readonly rangeDisplayValue = computed<DateRange<D> | null>(() => {
    if (this._draftActive()) return this._draftRange();
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
   * The bound's time (as `D` for the time-panel binding) iff `v` falls on the
   * bound's calendar day, else null. `null` bounds/values yield null.
   */
  private boundOnDay(v: D | null, bound: D | null): D | null {
    const dt = this.dtAdapter;
    if (!dt || v == null || bound == null || !dt.isValid(v) || !dt.isValid(bound)) {
      return null;
    }
    return dt.compareDate(v, bound) === 0
      ? (dt.getTime(bound) as unknown as D)
      : null;
  }

  /**
   * Time-panel floor for the single-datetime variant: the bound's time only on
   * the bound's day (anchored to the current value). In pure-time mode the
   * caller uses `min()`/`max()` directly.
   */
  private boundaryTime(bound: D | null): D | null {
    return this.boundOnDay(this.displayValue(), bound);
  }

  protected readonly timePanelMin = computed<D | null>(() =>
    this.isTime() ? this.min() : this.boundaryTime(this.min()),
  );
  protected readonly timePanelMax = computed<D | null>(() =>
    this.isTime() ? this.max() : this.boundaryTime(this.max()),
  );

  /** Time part (cast as `D` for the time-panel binding) of a datetime value. */
  private timePartOf(value: D | null): D | null {
    const dt = this.dtAdapter;
    return dt && value != null && dt.isValid(value)
      ? (dt.getTime(value) as unknown as D)
      : null;
  }

  /** Whether two datetime values fall on the same calendar day. */
  private sameDay(a: D | null, b: D | null): boolean {
    const dt = this.dtAdapter;
    return (
      !!dt &&
      a != null &&
      b != null &&
      dt.isValid(a) &&
      dt.isValid(b) &&
      dt.compareDate(a, b) === 0
    );
  }

  /** The earlier of two times (null = unbounded). */
  private earlierTime(a: D | null, b: D | null): D | null {
    const dt = this.dtAdapter;
    if (a == null) return b;
    if (b == null) return a;
    if (!dt) return a;
    return dt.compareTime(a, b) <= 0 ? a : b;
  }

  /** The later of two times (null = unbounded). */
  private laterTime(a: D | null, b: D | null): D | null {
    const dt = this.dtAdapter;
    if (a == null) return b;
    if (b == null) return a;
    if (!dt) return a;
    return dt.compareTime(a, b) >= 0 ? a : b;
  }

  protected readonly startTimePanelValue = computed<D | null>(() =>
    this.timePartOf(this.rangeDisplayValue()?.start ?? null),
  );
  protected readonly endTimePanelValue = computed<D | null>(() =>
    this.timePartOf(this.rangeDisplayValue()?.end ?? null),
  );

  // Start panel: floor from the picker min on the start's day; ceiling is the
  // earlier of the picker max (on the start's day) and the end time on a shared
  // day — so the start can never be pushed past the end.
  protected readonly startTimePanelMin = computed<D | null>(() =>
    this.boundOnDay(this.rangeDisplayValue()?.start ?? null, this.min()),
  );
  // The time panel pre-clamps the composed value against these bounds before it
  // emits, so a same-day start can never be stepped past the end (and vice versa).
  protected readonly startTimePanelMax = computed<D | null>(() => {
    const r = this.rangeDisplayValue();
    const start = r?.start ?? null;
    const end = r?.end ?? null;
    const pickerCeil = this.boundOnDay(start, this.max());
    const sameDayEnd = this.sameDay(start, end) ? this.timePartOf(end) : null;
    return this.earlierTime(pickerCeil, sameDayEnd);
  });

  // End panel: ceiling from the picker max on the end's day; floor is the later
  // of the picker min (on the end's day) and the start time on a shared day.
  protected readonly endTimePanelMin = computed<D | null>(() => {
    const r = this.rangeDisplayValue();
    const start = r?.start ?? null;
    const end = r?.end ?? null;
    const pickerFloor = this.boundOnDay(end, this.min());
    const sameDayStart = this.sameDay(start, end) ? this.timePartOf(start) : null;
    return this.laterTime(pickerFloor, sameDayStart);
  });
  protected readonly endTimePanelMax = computed<D | null>(() =>
    this.boundOnDay(this.rangeDisplayValue()?.end ?? null, this.max()),
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

  /** Custom header component used to hide each calendar's built-in nav. */
  protected readonly emptyHeader = NgxDtEmptyCalendarHeader;

  /** Dual months are only meaningful for the range variants. */
  protected readonly dualCalendars = computed(
    () => this.monthsToDisplay() === 2 && this.calendarRangeMode(),
  );

  /** Left month anchor; user navigation overrides the computed start-at. */
  private readonly _activeMonth = signal<D | null>(null);
  protected readonly activeMonthStart = computed<D | null>(
    () => this._activeMonth() ?? this.effectiveStartAt(),
  );
  protected readonly activeMonthNext = computed<D | null>(() => {
    const adapter = this.adapter;
    const start = this.activeMonthStart();
    return adapter && start ? adapter.addCalendarMonths(start, 1) : null;
  });

  /** Keyed descriptors for the two calendars; key change forces recreation. */
  protected readonly dualMonths = computed(() => {
    const adapter = this.adapter;
    const start = this.activeMonthStart();
    const next = this.activeMonthNext();
    if (!adapter || !start || !next) return [];
    return [
      { key: this.monthKey(start), start },
      { key: this.monthKey(next), start: next },
    ];
  });

  private monthKey(d: D): string {
    const a = this.adapter!;
    return `${a.getYear(d)}-${a.getMonth(d)}`;
  }

  protected monthLabel(d: D | null): string {
    const a = this.adapter;
    if (!a || !d) return '';
    return `${a.getMonthNames('long')[a.getMonth(d)]} ${a.getYear(d)}`;
  }

  protected onPrevMonth(): void {
    const a = this.adapter;
    const start = this.activeMonthStart();
    if (a && start) this._activeMonth.set(a.addCalendarMonths(start, -1));
  }

  protected onNextMonth(): void {
    const a = this.adapter;
    const start = this.activeMonthStart();
    if (a && start) this._activeMonth.set(a.addCalendarMonths(start, 1));
  }

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
    if (this.draftMode()) {
      this._draftValue.set(this._input() ? this._input()!.value() : this.value());
      this._draftRange.set(
        this._rangeInput() ? this._rangeInput()!.range() : this.range(),
      );
      this._draftActive.set(true);
    }
    this._open.set(true);
    this.openedChange.emit(true);
    this.opened.emit();
  }

  /** Close the overlay and (optionally) restore focus to the trigger. */
  close(): void {
    if (!this._open()) {
      return;
    }
    this._draftActive.set(false); // discard any uncommitted draft
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

  /** Write a value through the registered input seam, else the model. Buffers into draft when draft is active. */
  private commitValue(value: D | null): void {
    if (this._draftActive()) {
      this._draftValue.set(value);
      return;
    }
    const input = this._input();
    if (input) {
      input.setValueFromPicker(value);
    } else {
      this.value.set(value);
    }
  }

  /** Write a range through the registered range input seam, else the model. Buffers into draft when draft is active. */
  private commitRange(range: DateRange<D>): void {
    if (this._draftActive()) {
      this._draftRange.set(range);
      return;
    }
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
    if (!this.inline() && !this._draftActive()) {
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
    if (!this.inline() && !this._draftActive() && next.start !== null && next.end !== null) {
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

  protected onStartTimeChange(time: D | null): void {
    if (!this.isDateTimeRange()) return;
    const dt = this.dtAdapter;
    if (!dt) return;
    const r = this.rangeDisplayValue() ?? this._emptyRange;
    const start =
      time == null
        ? null
        : dt.clampDateTime(dt.withTime(r.start, time), this.min(), this.max());
    this.commitRange(new DateRange<D>(start, r.end));
  }

  protected onEndTimeChange(time: D | null): void {
    if (!this.isDateTimeRange()) return;
    const dt = this.dtAdapter;
    if (!dt) return;
    const r = this.rangeDisplayValue() ?? this._emptyRange;
    const end =
      time == null
        ? null
        : dt.clampDateTime(dt.withTime(r.end, time), this.min(), this.max());
    this.commitRange(new DateRange<D>(r.start, end));
  }

  protected onNowClick(): void {
    const dt = this.dtAdapter;
    if (!dt) return;
    const now = dt.clampDateTime(dt.now(), this.min(), this.max());
    if (this.isDateTimeRange()) {
      const r = this.rangeDisplayValue() ?? this._emptyRange;
      if (r.start == null) {
        this.commitRange(new DateRange<D>(now, r.end));
      } else if (r.end == null) {
        this.commitRange(new DateRange<D>(r.start, now));
      }
      // both ends already set -> no-op
      return;
    }
    this.commitValue(now);
  }

  protected onClearClick(): void {
    if (this.isDateTimeRange()) {
      this.commitRange(this._emptyRange);
      return;
    }
    this.commitValue(null);
  }

  protected onDoneClick(): void {
    this.close();
  }

  protected onApplyClick(): void {
    if (this._draftActive()) {
      this._draftActive.set(false); // deactivate first so commit writes the real sink
      if (this.calendarRangeMode()) {
        this.commitRange(this._draftRange() ?? this._emptyRange);
      } else {
        this.commitValue(this._draftValue());
      }
    }
    this.close();
  }

  protected onCancelClick(): void {
    this.close(); // close() already discards the draft
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

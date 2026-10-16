import { Component, computed, signal } from '@angular/core';
import { Dir } from '@angular/cdk/bidi';
import { FormField, form } from '@angular/forms/signals';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { Temporal } from 'temporal-polyfill';
import {
  DateRange,
  NgxDtDateRangeInput,
  NgxDtDateTimeInput,
  NgxDtDateTimeRangeInput,
  NgxDtEndDate,
  NgxDtEndDateTime,
  NgxDtInput,
  NgxDtPicker,
  NgxDtPickerType,
  NgxDtStartDate,
  NgxDtStartDateTime,
  NgxDtTimeInput,
  NgxDtToggle,
} from '@constantine-24/ngx-datetime-picker';
import { CodeBlock } from '../shared/code-block';
import {
  buildSnippet,
  DEFAULT_PLAYGROUND_CONFIG,
  hasDate,
  hasTime,
  isRange,
  PlaygroundConfig,
} from './snippet';

type HourCycleChoice = 'locale' | 12 | 24;
type TemporalValue = Temporal.PlainDate | Temporal.PlainTime | Temporal.PlainDateTime;

const VARIANTS: readonly { readonly type: NgxDtPickerType; readonly label: string }[] = [
  { type: 'date', label: 'Date' },
  { type: 'date-range', label: 'Date range' },
  { type: 'time', label: 'Time' },
  { type: 'datetime', label: 'Date & time' },
  { type: 'datetime-range', label: 'Datetime range' },
];

/** Formats whatever the active picker produced for the "Value" read-out. */
function describeValue(value: unknown): string {
  if (value instanceof DateRange) {
    return `${value.start?.toString() ?? '…'}  →  ${value.end?.toString() ?? '…'}`;
  }
  return value == null ? 'Nothing selected yet' : String(value);
}

/** Interactive configurator: every option toggles a live picker and regenerates its code. */
@Component({
  selector: 'app-playground',
  imports: [
    Dir,
    FormField,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggle,
    NgxDtPicker,
    NgxDtToggle,
    NgxDtInput,
    NgxDtTimeInput,
    NgxDtDateTimeInput,
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    CodeBlock,
  ],
  templateUrl: './playground.html',
  styleUrl: './playground.scss',
})
export class Playground {
  protected readonly variants = VARIANTS;
  protected readonly minuteSteps = [1, 5, 15, 30] as const;

  protected readonly type = signal<NgxDtPickerType>(DEFAULT_PLAYGROUND_CONFIG.type);
  protected readonly inline = signal(DEFAULT_PLAYGROUND_CONFIG.inline);
  protected readonly hourCycleChoice = signal<HourCycleChoice>('locale');
  protected readonly minuteStep = signal(DEFAULT_PLAYGROUND_CONFIG.minuteStep);
  protected readonly showSeconds = signal(DEFAULT_PLAYGROUND_CONFIG.showSeconds);
  protected readonly twoMonths = signal(false);
  protected readonly draftMode = signal(DEFAULT_PLAYGROUND_CONFIG.draftMode);
  protected readonly weekdaysOnly = signal(DEFAULT_PLAYGROUND_CONFIG.weekdaysOnly);
  protected readonly rtl = signal(false);

  protected readonly showsTime = computed(() => hasTime(this.type()));
  protected readonly showsDate = computed(() => hasDate(this.type()));
  protected readonly showsRange = computed(() => isRange(this.type()));

  protected readonly config = computed<PlaygroundConfig>(() => {
    const hourCycle = this.hourCycleChoice();
    return {
      type: this.type(),
      inline: this.inline(),
      hourCycle: hourCycle === 'locale' ? null : hourCycle,
      minuteStep: this.minuteStep(),
      showSeconds: this.showSeconds(),
      monthsToDisplay: this.twoMonths() ? 2 : 1,
      draftMode: this.draftMode(),
      weekdaysOnly: this.weekdaysOnly(),
    };
  });
  protected readonly snippet = computed(() => buildSnippet(this.config()));

  /**
   * Recreates the picker (and resets its value) whenever the variant or display mode changes.
   * The dev-mode NG0956 warning on such a change is expected: re-creation is the point.
   */
  protected readonly renderKey = computed(() => `${this.type()}:${this.inline()}`);

  // A picker driven by a runtime `type` is `NgxDtPicker<unknown>`, so the predicate takes
  // `unknown` and narrows to the date part the calendar actually passes.
  protected readonly dateFilter = computed(() =>
    this.weekdaysOnly()
      ? (date: unknown) => (date as Temporal.PlainDate).dayOfWeek <= 5
      : () => true,
  );

  // Popup mode: the inputs are bound through Signal Forms.
  protected readonly fields = signal<{
    selected: TemporalValue | null;
    period: DateRange<TemporalValue> | null;
  }>({
    selected: null,
    period: null,
  });
  protected readonly fieldTree = form(this.fields);

  // Inline mode: the picker's own two-way models.
  protected readonly inlineValue = signal<unknown>(null);
  protected readonly inlineRange = signal<DateRange<unknown> | null>(null);

  protected readonly result = computed(() => {
    if (this.inline()) {
      return describeValue(this.showsRange() ? this.inlineRange() : this.inlineValue());
    }
    const { selected, period } = this.fields();
    return describeValue(this.showsRange() ? period : selected);
  });

  protected setType(type: NgxDtPickerType): void {
    this.type.set(type);
    this.resetValues();
  }

  protected setInline(inline: boolean): void {
    this.inline.set(inline);
    this.resetValues();
  }

  private resetValues(): void {
    this.fields.set({ selected: null, period: null });
    this.inlineValue.set(null);
    this.inlineRange.set(null);
  }
}

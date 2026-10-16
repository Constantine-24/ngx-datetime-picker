import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FormField, form } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
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
  NgxDtStartDate,
  NgxDtStartDateTime,
  NgxDtToggle,
} from '@constantine-24/ngx-datetime-picker';
import { ExampleCard } from '../shared/example-card';
import {
  DRAFT_SNIPPET,
  FORMS_SNIPPET,
  MEETING_COMPONENT_SNIPPET,
  MEETING_SNIPPET,
  SHIFT_SNIPPET,
  STAY_SNIPPET,
  VALIDATION_SNIPPET,
} from './example-snippets';

/** Real-world scenarios, each with its live picker and copy-pasteable code. */
@Component({
  selector: 'app-examples',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    FormField,
    MatFormFieldModule,
    MatInputModule,
    NgxDtPicker,
    NgxDtToggle,
    NgxDtInput,
    NgxDtDateTimeInput,
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    ExampleCard,
  ],
  templateUrl: './examples.html',
  styleUrl: './examples.scss',
})
export class Examples {
  protected readonly snippets = {
    validation: VALIDATION_SNIPPET,
    stay: STAY_SNIPPET,
    meeting: MEETING_SNIPPET,
    meetingComponent: MEETING_COMPONENT_SNIPPET,
    shift: SHIFT_SNIPPET,
    draft: DRAFT_SNIPPET,
    forms: FORMS_SNIPPET,
  };

  protected readonly today = Temporal.Now.plainDateISO();
  protected readonly inAYear = this.today.add({ years: 1 });

  protected readonly delivery = new FormControl<Temporal.PlainDate | null>(null, {
    validators: Validators.required,
  });

  protected readonly booking = form(
    signal<{ stay: DateRange<Temporal.PlainDate> | null }>({ stay: null }),
  );

  // Template-ref pickers are `NgxDtPicker<unknown>`, so filters take `unknown` and narrow to
  // the part the picker passes: the calendar feeds the date part, the time panel the time part.
  protected readonly weekdaysOnly = (date: unknown) => (date as Temporal.PlainDate).dayOfWeek <= 5;
  protected readonly businessHours = (time: unknown) => {
    const { hour } = time as Temporal.PlainTime;
    return hour >= 9 && hour < 17;
  };
  protected readonly meeting = new FormControl<Temporal.PlainDateTime | null>(null);

  protected readonly shift = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);

  protected readonly report = new FormControl<Temporal.PlainDate | null>(null);

  protected readonly reactiveDate = new FormControl<Temporal.PlainDate | null>(null);
  protected templateDate: Temporal.PlainDate | null = null;
  protected readonly signalDate = form(signal<{ date: Temporal.PlainDate | null }>({ date: null }));

  protected describe(value: unknown): string {
    if (value instanceof DateRange) {
      return `${value.start?.toString() ?? '…'} → ${value.end?.toString() ?? '…'}`;
    }
    return value == null ? '—' : String(value);
  }
}

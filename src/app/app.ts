import { Component, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormField, form } from '@angular/forms/signals';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterOutlet } from '@angular/router';
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
  NgxDtTimeInput,
  NgxDtToggle,
} from 'ngx-datetime-picker';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    ReactiveFormsModule,
    FormsModule,
    FormField,
    MatFormFieldModule,
    MatInputModule,
    NgxDtPicker,
    NgxDtToggle,
    NgxDtInput,
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtTimeInput,
    NgxDtDateTimeInput,
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('date-time-picker');
  protected readonly inlineValue = signal<Temporal.PlainDate | null>(null);
  protected readonly popupValue = signal<Temporal.PlainDate | null>(null);

  // Reactive Forms
  protected readonly reactiveCtrl = new FormControl<Temporal.PlainDate | null>(null);

  // Date range (Reactive Forms)
  protected readonly rangeCtrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);

  // ngModel
  protected ngModelValue: Temporal.PlainDate | null = null;

  // Signal Forms
  protected readonly signalModel = signal<{ date: Temporal.PlainDate | null }>({ date: null });
  protected readonly signalForm = form(this.signalModel);

  // Time picker
  protected readonly inlineTime = signal<Temporal.PlainTime | null>(null);
  protected readonly timeCtrl = new FormControl<Temporal.PlainTime | null>(null);

  // Datetime picker
  protected readonly inlineDateTime = signal<Temporal.PlainDateTime | null>(null);
  protected readonly dateTimeCtrl = new FormControl<Temporal.PlainDateTime | null>(null);

  // Datetime range (Reactive Forms)
  protected readonly dateTimeRangeCtrl =
    new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
}

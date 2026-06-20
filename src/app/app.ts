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
  NgxDtEndDate,
  NgxDtInput,
  NgxDtPicker,
  NgxDtStartDate,
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
}

import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Temporal } from 'temporal-polyfill';
import { NgxDtPicker, NgxDtToggle } from 'ngx-datetime-picker';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxDtPicker, NgxDtToggle],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('date-time-picker');
  protected readonly inlineValue = signal<Temporal.PlainDate | null>(null);
  protected readonly popupValue = signal<Temporal.PlainDate | null>(null);
}

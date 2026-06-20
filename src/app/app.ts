import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MatCalendar } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatCalendar],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('date-time-picker');
  protected readonly selected = signal<Temporal.PlainDate | null>(null);

  protected onSelected(date: Temporal.PlainDate | null): void {
    this.selected.set(date);
  }
}

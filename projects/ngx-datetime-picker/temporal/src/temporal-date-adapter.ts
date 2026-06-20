import { Injectable, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainDate. */
const INVALID = {} as Temporal.PlainDate;

function range<T>(length: number, fn: (i: number) => T): T[] {
  return Array.from({ length }, (_, i) => fn(i));
}

@Injectable()
export class TemporalDateAdapter extends DateAdapter<Temporal.PlainDate> {
  constructor() {
    super();
    this.setLocale(inject(MAT_DATE_LOCALE, { optional: true }) ?? 'en-US');
  }

  createDate(year: number, month: number, date: number): Temporal.PlainDate {
    if (month < 0 || month > 11) {
      throw new Error(`Invalid month index "${month}". Expected 0-11.`);
    }
    if (date < 1) {
      throw new Error(`Invalid date "${date}". Date must be greater than 0.`);
    }
    return Temporal.PlainDate.from(
      { year, month: month + 1, day: date },
      { overflow: 'reject' },
    );
  }

  // --- remaining abstract members are filled in by Tasks 6-10 ---
  getYear(date: Temporal.PlainDate): number {
    return date.year;
  }
  getMonth(date: Temporal.PlainDate): number {
    return date.month - 1;
  }
  getDate(date: Temporal.PlainDate): number {
    return date.day;
  }
  getDayOfWeek(date: Temporal.PlainDate): number {
    return date.dayOfWeek % 7;
  }
  getMonthNames(): string[] {
    return range(12, () => '');
  }
  getDateNames(): string[] {
    return range(31, (i) => String(i + 1));
  }
  getDayOfWeekNames(): string[] {
    return range(7, () => '');
  }
  getYearName(date: Temporal.PlainDate): string {
    return String(date.year);
  }
  getFirstDayOfWeek(): number {
    return 0;
  }
  getNumDaysInMonth(date: Temporal.PlainDate): number {
    return date.daysInMonth;
  }
  clone(date: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.from(date);
  }
  today(): Temporal.PlainDate {
    return Temporal.Now.plainDateISO();
  }
  parse(value: unknown): Temporal.PlainDate | null {
    return value == null ? null : INVALID;
  }
  format(date: Temporal.PlainDate): string {
    return date.toString();
  }
  addCalendarYears(date: Temporal.PlainDate, years: number): Temporal.PlainDate {
    return date.add({ years });
  }
  addCalendarMonths(
    date: Temporal.PlainDate,
    months: number,
  ): Temporal.PlainDate {
    return date.add({ months });
  }
  addCalendarDays(date: Temporal.PlainDate, days: number): Temporal.PlainDate {
    return date.add({ days });
  }
  toIso8601(date: Temporal.PlainDate): string {
    return date.toString();
  }
  isDateInstance(obj: unknown): boolean {
    return obj instanceof Temporal.PlainDate;
  }
  isValid(date: Temporal.PlainDate): boolean {
    return date instanceof Temporal.PlainDate;
  }
  invalid(): Temporal.PlainDate {
    return INVALID;
  }
}

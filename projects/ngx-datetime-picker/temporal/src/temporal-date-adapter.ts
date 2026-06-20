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
  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, {
      month: style,
      timeZone: 'UTC',
    });
    return range(12, (i) => fmt.format(new Date(Date.UTC(2026, i, 1))));
  }
  getDateNames(): string[] {
    return range(31, (i) => String(i + 1));
  }
  override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, {
      weekday: style,
      timeZone: 'UTC',
    });
    // 2023-01-01 is a Sunday → iterate Sun..Sat.
    return range(7, (i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
  }
  override getYearName(date: Temporal.PlainDate): string {
    return date.toLocaleString(this.locale, { year: 'numeric' });
  }
  override getFirstDayOfWeek(): number {
    try {
      const locale = new Intl.Locale(this.locale);
      // weekInfo.firstDay is 1=Mon .. 7=Sun; map to 0=Sun .. 6=Sat.
      const firstDay = (locale as { weekInfo?: { firstDay?: number } }).weekInfo
        ?.firstDay;
      return firstDay == null ? 0 : firstDay % 7;
    } catch {
      return 0;
    }
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
  override parse(value: unknown): Temporal.PlainDate | null {
    if (value == null) return null;
    if (value instanceof Temporal.PlainDate) return value;
    const str = String(value).trim();
    if (!str) return null;

    // 1) ISO-8601 fast path (the only format Temporal.from understands).
    try {
      return Temporal.PlainDate.from(str, { overflow: 'reject' });
    } catch {
      /* fall through */
    }
    // 2) Locale numeric fallback.
    return this.parseLocaleNumeric(str) ?? this.invalid();
  }

  private parseLocaleNumeric(str: string): Temporal.PlainDate | null {
    const nums = str.match(/\d+/g);
    if (!nums || nums.length < 3) return null;
    const order = this.numericFieldOrder();
    const field: Record<'year' | 'month' | 'day', number> = {
      year: 0,
      month: 0,
      day: 0,
    };
    order.forEach((f, i) => (field[f] = Number(nums[i])));
    if (field.year < 100) field.year += 2000; // naive 2-digit-year expansion
    try {
      return Temporal.PlainDate.from(field, { overflow: 'reject' });
    } catch {
      return null;
    }
  }

  /** Derives field order (e.g. ['month','day','year'] for en-US) from Intl. */
  private numericFieldOrder(): Array<'year' | 'month' | 'day'> {
    const ref = new Date(Date.UTC(2026, 0, 2)); // y=2026, m=01, d=02 — all distinct
    return new Intl.DateTimeFormat(this.locale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    })
      .formatToParts(ref)
      .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
      .map((p) => p.type as 'year' | 'month' | 'day');
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

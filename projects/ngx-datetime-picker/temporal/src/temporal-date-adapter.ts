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
  private fieldOrder: Array<'year' | 'month' | 'day'> = ['year', 'month', 'day'];

  constructor() {
    super();
    this.setLocale(
      (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US',
    );
  }

  override setLocale(locale: string): void {
    super.setLocale(locale);
    this.fieldOrder = this.numericFieldOrder();
  }

  override createDate(
    year: number,
    month: number,
    date: number,
  ): Temporal.PlainDate {
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
  override getYear(date: Temporal.PlainDate): number {
    return date.year;
  }
  override getMonth(date: Temporal.PlainDate): number {
    return date.month - 1;
  }
  override getDate(date: Temporal.PlainDate): number {
    return date.day;
  }
  override getDayOfWeek(date: Temporal.PlainDate): number {
    return date.dayOfWeek % 7;
  }
  override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, {
      month: style,
      timeZone: 'UTC',
    });
    return range(12, (i) => fmt.format(new Date(Date.UTC(2026, i, 1))));
  }
  override getDateNames(): string[] {
    const fmt = new Intl.DateTimeFormat(this.locale, {
      day: 'numeric',
      timeZone: 'UTC',
    });
    return range(31, (i) => fmt.format(new Date(Date.UTC(2026, 0, i + 1))));
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
      const locale = new Intl.Locale(this.locale) as Intl.Locale & {
        getWeekInfo?: () => { firstDay?: number };
        weekInfo?: { firstDay?: number };
      };
      const info = locale.getWeekInfo?.() ?? locale.weekInfo;
      const firstDay = info?.firstDay ?? 0;
      // weekInfo encodes Mon=1..Sun=7; Material wants Sun=0..Sat=6.
      return firstDay === 7 ? 0 : firstDay;
    } catch {
      return 0;
    }
  }
  override getNumDaysInMonth(date: Temporal.PlainDate): number {
    return date.daysInMonth;
  }
  override clone(date: Temporal.PlainDate): Temporal.PlainDate {
    return Temporal.PlainDate.from(date);
  }
  override today(): Temporal.PlainDate {
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
    if (!nums || nums.length !== 3) return null;
    const order = this.fieldOrder;
    const field: Record<'year' | 'month' | 'day', number> = {
      year: 0,
      month: 0,
      day: 0,
    };
    order.forEach((f, i) => (field[f] = Number(nums[i])));
    // 2-digit years are expanded into the 2000s (e.g. "26" → 2026, "99" → 2099).
    // This is a fixed-window heuristic; a configurable pivot year is a future enhancement.
    if (field.year < 100) field.year += 2000;
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
  override format(
    date: Temporal.PlainDate,
    displayFormat: Intl.DateTimeFormatOptions,
  ): string {
    if (!this.isValid(date)) {
      throw new Error('TemporalDateAdapter: Cannot format invalid date.');
    }
    return date.toLocaleString(this.locale, displayFormat);
  }

  override deserialize(value: unknown): Temporal.PlainDate | null {
    if (value == null || value === '') return null;
    if (value instanceof Temporal.PlainDate) return value;
    if (value instanceof Temporal.PlainDateTime) return value.toPlainDate();
    if (value instanceof Temporal.ZonedDateTime) return value.toPlainDate();
    if (typeof value === 'string') {
      try {
        return Temporal.PlainDate.from(value, { overflow: 'reject' });
      } catch {
        return this.invalid();
      }
    }
    return super.deserialize(value);
  }

  override compareDate(
    first: Temporal.PlainDate,
    second: Temporal.PlainDate,
  ): number {
    return Temporal.PlainDate.compare(first, second);
  }
  override addCalendarYears(
    date: Temporal.PlainDate,
    years: number,
  ): Temporal.PlainDate {
    return date.add({ years });
  }
  override addCalendarMonths(
    date: Temporal.PlainDate,
    months: number,
  ): Temporal.PlainDate {
    return date.add({ months });
  }
  override addCalendarDays(
    date: Temporal.PlainDate,
    days: number,
  ): Temporal.PlainDate {
    return date.add({ days });
  }
  override toIso8601(date: Temporal.PlainDate): string {
    return date.toString();
  }
  override isDateInstance(obj: unknown): boolean {
    return obj instanceof Temporal.PlainDate;
  }
  override isValid(date: Temporal.PlainDate): boolean {
    return date instanceof Temporal.PlainDate;
  }
  override invalid(): Temporal.PlainDate {
    return INVALID;
  }
}

import { Injectable, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtDateTimeAdapter, NgxDtTimeAdapter } from '@constantine-24/ngx-datetime-picker';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainDateTime. */
const INVALID = {} as Temporal.PlainDateTime;

/** Default display format: locale date + 2-digit hour/minute (no seconds). */
const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
};

@Injectable()
export class TemporalDateTimeAdapter extends NgxDtDateTimeAdapter<
  Temporal.PlainDateTime,
  Temporal.PlainDate,
  Temporal.PlainTime
> {
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';
  // Reuse the already-tested date/time locale parsers for the locale fallback.
  private readonly dateAdapter = inject<DateAdapter<Temporal.PlainDate>>(DateAdapter);
  private readonly timeAdapter = inject<NgxDtTimeAdapter<Temporal.PlainTime>>(NgxDtTimeAdapter);

  now(): Temporal.PlainDateTime {
    return Temporal.Now.plainDateTimeISO();
  }

  getDate(value: Temporal.PlainDateTime): Temporal.PlainDate {
    return value.toPlainDate();
  }
  getTime(value: Temporal.PlainDateTime): Temporal.PlainTime {
    return value.toPlainTime();
  }
  combine(date: Temporal.PlainDate, time: Temporal.PlainTime): Temporal.PlainDateTime {
    return date.toPlainDateTime(time);
  }
  protected startOfDayTime(): Temporal.PlainTime {
    return new Temporal.PlainTime(0, 0, 0);
  }

  compareDateTime(a: Temporal.PlainDateTime, b: Temporal.PlainDateTime): number {
    return Temporal.PlainDateTime.compare(a, b);
  }
  compareDate(a: Temporal.PlainDateTime, b: Temporal.PlainDateTime): number {
    return Temporal.PlainDate.compare(a.toPlainDate(), b.toPlainDate());
  }

  isValid(value: Temporal.PlainDateTime): boolean {
    return value instanceof Temporal.PlainDateTime;
  }
  invalid(): Temporal.PlainDateTime {
    return INVALID;
  }

  parse(value: unknown): Temporal.PlainDateTime | null {
    if (value == null) return null;
    if (value instanceof Temporal.PlainDateTime) return value;
    if (value instanceof Temporal.PlainDate) return value.toPlainDateTime();
    const str = String(value).trim();
    if (!str) return null;
    // ISO fast path ("2026-06-21T14:30", and lenient space separator).
    try {
      return Temporal.PlainDateTime.from(str, { overflow: 'reject' });
    } catch {
      /* fall through to locale parse */
    }
    return this.parseLocale(str) ?? this.invalid();
  }

  /**
   * Locale fallback: locate a time token (`HH:MM[:SS]` with optional am/pm),
   * delegate it to the time adapter and the remainder to the date adapter.
   * A string with no time token is parsed as a date at the start of the day.
   */
  private parseLocale(str: string): Temporal.PlainDateTime | null {
    const timeMatch = str.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?/i);
    if (!timeMatch) {
      const dateOnly = this.dateAdapter.parse(str, null);
      return dateOnly && this.dateAdapter.isValid(dateOnly)
        ? this.combine(dateOnly, this.startOfDayTime())
        : null;
    }
    const timeStr = timeMatch[0];
    const dateStr = (str.slice(0, timeMatch.index) + str.slice(timeMatch.index! + timeStr.length))
      .replace(/,/g, ' ')
      .trim();
    const date = this.dateAdapter.parse(dateStr, null);
    const time = this.timeAdapter.parse(timeStr);
    if (date && this.dateAdapter.isValid(date) && time && this.timeAdapter.isValid(time)) {
      return this.combine(date, time);
    }
    return null;
  }

  format(
    value: Temporal.PlainDateTime,
    options: Intl.DateTimeFormatOptions = DEFAULT_FORMAT,
  ): string {
    if (!this.isValid(value)) {
      throw new Error('TemporalDateTimeAdapter: Cannot format invalid datetime.');
    }
    return value.toLocaleString(this.locale, options);
  }
}

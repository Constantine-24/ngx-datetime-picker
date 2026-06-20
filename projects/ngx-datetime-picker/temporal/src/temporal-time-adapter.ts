import { Injectable, inject } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtTimeAdapter } from 'ngx-datetime-picker';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainTime. */
const INVALID = {} as Temporal.PlainTime;

@Injectable()
export class TemporalTimeAdapter extends NgxDtTimeAdapter<Temporal.PlainTime> {
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';

  now(): Temporal.PlainTime {
    return Temporal.Now.plainTimeISO();
  }

  getHour(time: Temporal.PlainTime): number {
    return time.hour;
  }
  getMinute(time: Temporal.PlainTime): number {
    return time.minute;
  }
  getSecond(time: Temporal.PlainTime): number {
    return time.second;
  }

  createTime(hour: number, minute: number, second: number): Temporal.PlainTime {
    return new Temporal.PlainTime(hour, minute, second);
  }

  compareTime(a: Temporal.PlainTime, b: Temporal.PlainTime): number {
    return Temporal.PlainTime.compare(a, b);
  }

  isValid(time: Temporal.PlainTime): boolean {
    return time instanceof Temporal.PlainTime;
  }
  invalid(): Temporal.PlainTime {
    return INVALID;
  }

  parse(value: unknown): Temporal.PlainTime | null {
    if (value == null) return null;
    if (value instanceof Temporal.PlainTime) return value;
    if (value instanceof Temporal.PlainDateTime) return value.toPlainTime();
    const str = String(value).trim();
    if (!str) return null;
    // ISO fast path ("14:30", "14:30:00", "14:30:00.5").
    try {
      return Temporal.PlainTime.from(str, { overflow: 'reject' });
    } catch {
      /* fall through to locale parse */
    }
    return this.parseLocale(str) ?? this.invalid();
  }

  private parseLocale(str: string): Temporal.PlainTime | null {
    const nums = str.match(/\d+/g);
    if (!nums || nums.length < 1 || nums.length > 3) return null;
    let hour = Number(nums[0]);
    const minute = nums.length > 1 ? Number(nums[1]) : 0;
    const second = nums.length > 2 ? Number(nums[2]) : 0;
    // Meridiem: a trailing "p"/"pm" pushes 1–11 → 13–23; "a"/"am" maps 12 → 0.
    const meridiem = /([ap])\.?m?\.?\s*$/i.exec(str)?.[1]?.toLowerCase();
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    try {
      return Temporal.PlainTime.from(
        { hour, minute, second },
        { overflow: 'reject' },
      );
    } catch {
      return null;
    }
  }

  format(
    time: Temporal.PlainTime,
    options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    },
  ): string {
    if (!this.isValid(time)) {
      throw new Error('TemporalTimeAdapter: Cannot format invalid time.');
    }
    return time.toLocaleString(this.locale, options);
  }
}

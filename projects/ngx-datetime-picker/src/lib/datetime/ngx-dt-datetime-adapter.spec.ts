import { describe, expect, it } from 'vitest';
import { NgxDtDateTimeAdapter } from './ngx-dt-datetime-adapter';

/**
 * Fake adapter: a datetime is "minutes since an epoch" (a single number).
 * date part = whole days; time part = minute-of-day. Lets us exercise the
 * concrete bridge logic without Temporal.
 */
class FakeDateTimeAdapter extends NgxDtDateTimeAdapter<number, number, number> {
  now(): number {
    return 0;
  }
  getDate(v: number): number {
    return Math.floor(v / 1440);
  }
  getTime(v: number): number {
    return ((v % 1440) + 1440) % 1440;
  }
  combine(date: number, time: number): number {
    return date * 1440 + time;
  }
  protected startOfDayTime(): number {
    return 0;
  }
  compareDateTime(a: number, b: number): number {
    return a - b;
  }
  compareDate(a: number, b: number): number {
    return this.getDate(a) - this.getDate(b);
  }
  isValid(v: number): boolean {
    return Number.isFinite(v) && v >= 0;
  }
  invalid(): number {
    return -1;
  }
  parse(v: unknown): number | null {
    return v == null || v === '' ? null : Number(v);
  }
  format(v: number): string {
    return String(v);
  }
}

describe('NgxDtDateTimeAdapter (concrete bridge)', () => {
  const a = new FakeDateTimeAdapter();

  it('sameDateTime is null-tolerant and uses compareDateTime', () => {
    expect(a.sameDateTime(null, null)).toBe(true);
    expect(a.sameDateTime(null, 5)).toBe(false);
    expect(a.sameDateTime(2910, 2910)).toBe(true);
    expect(a.sameDateTime(2910, 2911)).toBe(false);
    // two invalids are equal; valid vs invalid is not
    expect(a.sameDateTime(a.invalid(), a.invalid())).toBe(true);
    expect(a.sameDateTime(a.invalid(), 5)).toBe(false);
  });

  it('sameDatePart compares date parts only', () => {
    expect(a.sameDatePart(a.combine(2, 30), a.combine(2, 59))).toBe(true);
    expect(a.sameDatePart(a.combine(2, 30), a.combine(3, 30))).toBe(false);
  });

  it('clampDateTime clamps to the inclusive window', () => {
    expect(a.clampDateTime(2910, 1440, 4320)).toBe(2910);
    expect(a.clampDateTime(1000, 1440, null)).toBe(1440);
    expect(a.clampDateTime(5000, null, 4320)).toBe(4320);
  });

  it('withDate keeps the value time, or midnight when value is null', () => {
    expect(a.withDate(null, 3)).toBe(a.combine(3, 0)); // midnight
    expect(a.withDate(a.combine(2, 30), 5)).toBe(a.combine(5, 30)); // time carried
  });

  it('withTime keeps the value date, or today() when value is null', () => {
    expect(a.withTime(null, 45)).toBe(a.combine(a.getDate(a.now()), 45));
    expect(a.withTime(a.combine(2, 30), 45)).toBe(a.combine(2, 45)); // date carried
  });

  it('compareTime orders time parts independent of date', () => {
    // Fake: time = minute-of-day. now() === 0 so getDate(now()) === 0.
    expect(a.compareTime(30, 45)).toBeLessThan(0);
    expect(a.compareTime(45, 30)).toBeGreaterThan(0);
    expect(a.compareTime(30, 30)).toBe(0);
  });
});

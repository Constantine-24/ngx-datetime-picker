import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtDateTimeAdapter } from '@constantine-24/ngx-datetime-picker';
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { TemporalDateTimeAdapter } from './temporal-datetime-adapter';
import { provideTemporalDateTimeAdapter } from './provide-temporal-datetime-adapter';

function adapter(locale = 'en-US'): TemporalDateTimeAdapter {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [provideTemporalDateTimeAdapter(), { provide: MAT_DATE_LOCALE, useValue: locale }],
  });
  return TestBed.inject(NgxDtDateTimeAdapter) as TemporalDateTimeAdapter;
}

describe('TemporalDateTimeAdapter', () => {
  const dt = Temporal.PlainDateTime.from('2026-06-21T14:30:00');

  it('splits and recombines a PlainDateTime losslessly', () => {
    const a = adapter();
    const date = a.getDate(dt);
    const time = a.getTime(dt);
    expect(date).toBeInstanceOf(Temporal.PlainDate);
    expect(time).toBeInstanceOf(Temporal.PlainTime);
    const back = a.combine(date, time);
    expect(a.compareDateTime(back, dt)).toBe(0);
  });

  it('compareDate ignores the time component', () => {
    const a = adapter();
    const morning = Temporal.PlainDateTime.from('2026-06-21T08:00');
    const evening = Temporal.PlainDateTime.from('2026-06-21T20:00');
    expect(a.compareDate(morning, evening)).toBe(0);
    expect(a.compareDateTime(morning, evening)).toBeLessThan(0);
  });

  it('parses ISO datetime strings', () => {
    const a = adapter();
    const v = a.parse('2026-06-21T14:30') as Temporal.PlainDateTime;
    expect(v).toBeInstanceOf(Temporal.PlainDateTime);
    expect(v.hour).toBe(14);
    expect(v.day).toBe(21);
  });

  it('parses locale "date time" by delegating to date+time adapters', () => {
    const a = adapter('en-US'); // MDY + 12h
    const v = a.parse('06/21/2026 2:30 PM') as Temporal.PlainDateTime;
    expect(v).toBeInstanceOf(Temporal.PlainDateTime);
    expect(v.year).toBe(2026);
    expect(v.month).toBe(6);
    expect(v.day).toBe(21);
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(30);
  });

  it('parses a date-only string at the start of day', () => {
    const a = adapter();
    const v = a.parse('2026-06-21') as Temporal.PlainDateTime;
    expect(v.hour).toBe(0);
    expect(v.minute).toBe(0);
  });

  it('returns null for empty, invalid() for garbage', () => {
    const a = adapter();
    expect(a.parse('')).toBeNull();
    expect(a.parse(null)).toBeNull();
    expect(a.isValid(a.parse('nonsense') as Temporal.PlainDateTime)).toBe(false);
  });

  it('withDate carries the time; withTime carries the date', () => {
    const a = adapter();
    const moved = a.withDate(dt, Temporal.PlainDate.from('2026-12-25'));
    expect(moved.month).toBe(12);
    expect(moved.hour).toBe(14);
    expect(moved.minute).toBe(30);
    const retimed = a.withTime(dt, Temporal.PlainTime.from('09:05'));
    expect(retimed.day).toBe(21);
    expect(retimed.hour).toBe(9);
    expect(retimed.minute).toBe(5);
  });

  it('formats with a sensible default and throws on invalid', () => {
    const a = adapter();
    const out = a.format(dt);
    expect(out).toContain('14'); // hour present in en-US 2-digit
    expect(() => a.format(a.invalid())).toThrow();
  });

  it('now() returns a PlainDateTime', () => {
    expect(adapter().now()).toBeInstanceOf(Temporal.PlainDateTime);
  });
});

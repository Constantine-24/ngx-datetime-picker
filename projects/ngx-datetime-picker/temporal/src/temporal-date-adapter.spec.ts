import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';
import { beforeEach, describe, expect, it } from 'vitest';
import { TemporalDateAdapter } from './temporal-date-adapter';

function makeAdapter(locale = 'en-US'): TemporalDateAdapter {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DATE_LOCALE, useValue: locale },
      { provide: DateAdapter, useClass: TemporalDateAdapter },
    ],
  });
  return TestBed.inject(DateAdapter) as TemporalDateAdapter;
}

describe('TemporalDateAdapter — construction', () => {
  let adapter: TemporalDateAdapter;
  beforeEach(() => (adapter = makeAdapter()));

  it('is a DateAdapter', () => {
    expect(adapter).toBeInstanceOf(DateAdapter);
  });

  it('createDate uses 0-indexed months (Material contract)', () => {
    const d = adapter.createDate(2026, 5, 20); // month 5 === June
    expect(d).toBeInstanceOf(Temporal.PlainDate);
    expect(d.month).toBe(6);
    expect(d.day).toBe(20);
  });
});

describe('TemporalDateAdapter — field accessors & arithmetic', () => {
  let adapter: TemporalDateAdapter;
  beforeEach(() => (adapter = makeAdapter()));
  const jun20 = Temporal.PlainDate.from('2026-06-20'); // a Saturday

  it('getMonth is 0-indexed', () => expect(adapter.getMonth(jun20)).toBe(5));
  it('getDate returns day of month', () => expect(adapter.getDate(jun20)).toBe(20));
  it('getYear returns the year', () => expect(adapter.getYear(jun20)).toBe(2026));
  it('getDayOfWeek maps Sunday→0 .. Saturday→6', () => {
    expect(adapter.getDayOfWeek(jun20)).toBe(6); // Saturday
    expect(adapter.getDayOfWeek(Temporal.PlainDate.from('2026-06-21'))).toBe(0); // Sunday
  });
  it('getNumDaysInMonth', () => expect(adapter.getNumDaysInMonth(jun20)).toBe(30));
  it('addCalendarMonths rolls the year', () => {
    expect(adapter.addCalendarMonths(jun20, 8).toString()).toBe('2027-02-20');
  });
  it('addCalendarDays', () => {
    expect(adapter.addCalendarDays(jun20, 12).toString()).toBe('2026-07-02');
  });
  it('clone is value-equal', () => {
    expect(adapter.clone(jun20).equals(jun20)).toBe(true);
  });
});

describe('TemporalDateAdapter — localized names', () => {
  it('English month names (long)', () => {
    const a = makeAdapter('en-US');
    expect(a.getMonthNames('long')[5]).toBe('June');
    expect(a.getMonthNames('short')[5]).toBe('Jun');
  });
  it('German month names', () => {
    expect(makeAdapter('de-DE').getMonthNames('long')[5]).toBe('Juni');
  });
  it('day-of-week names start on Sunday', () => {
    const names = makeAdapter('en-US').getDayOfWeekNames('long');
    expect(names[0]).toBe('Sunday');
    expect(names[6]).toBe('Saturday');
  });
  it('first day of week is locale-aware', () => {
    expect(makeAdapter('en-US').getFirstDayOfWeek()).toBe(0); // Sunday
    expect(makeAdapter('de-DE').getFirstDayOfWeek()).toBe(1); // Monday
  });
  it('year name', () => {
    expect(makeAdapter('en-US').getYearName(Temporal.PlainDate.from('2026-06-20'))).toBe('2026');
  });
});

describe('TemporalDateAdapter — parse', () => {
  it('parses ISO-8601', () => {
    expect(makeAdapter().parse('2026-06-20')!.toString()).toBe('2026-06-20');
  });
  it('parses en-US m/d/y', () => {
    expect(makeAdapter('en-US').parse('06/20/2026')!.toString()).toBe('2026-06-20');
  });
  it('parses de-DE d.m.y', () => {
    expect(makeAdapter('de-DE').parse('20.06.2026')!.toString()).toBe('2026-06-20');
  });
  it('expands 2-digit years', () => {
    expect(makeAdapter('en-US').parse('6/20/26')!.toString()).toBe('2026-06-20');
  });
  it('passes through an existing PlainDate', () => {
    const d = Temporal.PlainDate.from('2026-06-20');
    expect(makeAdapter().parse(d)).toBe(d);
  });
  it('null/empty → null', () => {
    expect(makeAdapter().parse(null)).toBeNull();
    expect(makeAdapter().parse('')).toBeNull();
  });
  it('garbage → invalid (not valid)', () => {
    const a = makeAdapter('en-US');
    const r = a.parse('not a date');
    expect(a.isValid(r as Temporal.PlainDate)).toBe(false);
  });
  it('out-of-range numeric → invalid', () => {
    const a = makeAdapter('en-US');
    expect(a.isValid(a.parse('13/40/2026') as Temporal.PlainDate)).toBe(false);
  });
});

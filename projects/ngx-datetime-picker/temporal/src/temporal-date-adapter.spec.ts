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
  it('re-derives field order when locale changes via setLocale', () => {
    const a = makeAdapter('en-US');
    expect(a.parse('06/20/2026')!.toString()).toBe('2026-06-20'); // m/d/y
    a.setLocale('de-DE');
    expect(a.parse('20.06.2026')!.toString()).toBe('2026-06-20'); // d/m/y
  });
  it('numeric string with extra number groups → invalid', () => {
    const a = makeAdapter('en-US');
    expect(a.isValid(a.parse('Version 2 dated 06/20/2026') as Temporal.PlainDate)).toBe(false);
  });
});

describe('TemporalDateAdapter — getDateNames (locale-aware)', () => {
  it('returns ASCII 1..31 for en-US', () => {
    const names = makeAdapter('en-US').getDateNames();
    expect(names).toHaveLength(31);
    expect(names[0]).toBe('1');
    expect(names[30]).toBe('31');
  });
  it('uses locale numerals for ar-EG (not ASCII)', () => {
    const names = makeAdapter('ar-EG').getDateNames();
    expect(names).toHaveLength(31);
    expect(names[0]).not.toBe('1'); // Eastern Arabic numeral, e.g. ١
  });
});

describe('TemporalDateAdapter — format / compare / validity', () => {
  const d = Temporal.PlainDate.from('2026-06-20');

  it('formats via Intl options', () => {
    const out = makeAdapter('en-US').format(d, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(out).toBe('Jun 20, 2026');
  });
  it('throws when formatting an invalid date', () => {
    const a = makeAdapter();
    expect(() => a.format(a.invalid(), { year: 'numeric' })).toThrow();
  });
  it('round-trips parse↔format (en-US)', () => {
    const a = makeAdapter('en-US');
    const fmt = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    expect(a.parse(a.format(d, fmt))!.toString()).toBe('2026-06-20');
  });
  it('toIso8601', () => expect(makeAdapter().toIso8601(d)).toBe('2026-06-20'));
  it('deserialize accepts ISO strings and PlainDate', () => {
    const a = makeAdapter();
    expect(a.deserialize('2026-06-20')!.toString()).toBe('2026-06-20');
    expect(a.deserialize(d)).toBe(d);
    expect(a.deserialize(null)).toBeNull();
    expect(a.deserialize('')).toBeNull();
  });
  it('compareDate orders dates', () => {
    const a = makeAdapter();
    expect(a.compareDate(d, Temporal.PlainDate.from('2026-06-21'))).toBeLessThan(0);
    expect(a.compareDate(d, d)).toBe(0);
  });
  it('isValid distinguishes valid from invalid()', () => {
    const a = makeAdapter();
    expect(a.isValid(d)).toBe(true);
    expect(a.isValid(a.invalid())).toBe(false);
  });
  it('isDateInstance', () => {
    const a = makeAdapter();
    expect(a.isDateInstance(d)).toBe(true);
    expect(a.isDateInstance('2026-06-20')).toBe(false);
  });
});

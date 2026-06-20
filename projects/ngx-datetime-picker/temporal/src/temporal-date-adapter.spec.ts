import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';
import { beforeEach, describe, expect, it } from 'vitest';
import { TemporalDateAdapter } from './temporal-date-adapter';

function makeAdapter(locale = 'en-US'): TemporalDateAdapter {
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

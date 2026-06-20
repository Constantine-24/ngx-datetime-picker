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

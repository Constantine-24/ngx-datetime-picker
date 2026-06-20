import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { provideTemporalDateAdapter } from './provide-temporal-date-adapter';
import { TemporalDateAdapter } from './temporal-date-adapter';

describe('provideTemporalDateAdapter', () => {
  it('wires DateAdapter → TemporalDateAdapter and supplies formats', () => {
    TestBed.configureTestingModule({ providers: [provideTemporalDateAdapter()] });
    expect(TestBed.inject(DateAdapter)).toBeInstanceOf(TemporalDateAdapter);
    expect(TestBed.inject(MAT_DATE_FORMATS).display.dateInput).toBeTruthy();
  });

  it('the wired adapter produces PlainDate today()', () => {
    TestBed.configureTestingModule({ providers: [provideTemporalDateAdapter()] });
    expect(TestBed.inject(DateAdapter).today()).toBeInstanceOf(Temporal.PlainDate);
  });
});

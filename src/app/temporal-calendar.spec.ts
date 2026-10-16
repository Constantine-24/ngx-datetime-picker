import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { MatCalendar } from '@angular/material/datepicker';
import { DateAdapter } from '@angular/material/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import {
  provideTemporalDateAdapter,
  TemporalDateAdapter,
} from '@constantine-24/ngx-datetime-picker/temporal';
import { describe, expect, it } from 'vitest';

describe('demo: TemporalDateAdapter drives MatCalendar', () => {
  function setup() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateAdapter(),
      ],
    });
  }

  it('wires TemporalDateAdapter as the active DateAdapter', () => {
    setup();
    expect(TestBed.inject(DateAdapter)).toBeInstanceOf(TemporalDateAdapter);
  });

  it('renders a MatCalendar grid using a Temporal start date', () => {
    setup();
    const fixture = TestBed.createComponent(MatCalendar<Temporal.PlainDate>);
    fixture.componentInstance.startAt = Temporal.PlainDate.from('2026-06-20');
    fixture.detectChanges();
    const body: HTMLElement | null =
      fixture.nativeElement.querySelector('.mat-calendar-body');
    expect(body).toBeTruthy();
    // The month grid should contain day cells rendered via the adapter.
    expect(
      fixture.nativeElement.querySelectorAll('.mat-calendar-body-cell').length,
    ).toBeGreaterThan(0);
  });
});

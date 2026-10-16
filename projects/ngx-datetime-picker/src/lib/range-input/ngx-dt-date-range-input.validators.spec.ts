import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateRangeInput, NgxDtEndDate, NgxDtStartDate } from './ngx-dt-date-range-input';

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

@Component({
  imports: [NgxDtDateRangeInput, NgxDtStartDate, NgxDtEndDate, NgxDtPicker, ReactiveFormsModule],
  template: `
    <ngx-dt-date-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDate />
      <input ngxDtEndDate />
    </ngx-dt-date-range-input>
    <ngx-dt-picker
      #picker
      [inline]="true"
      type="date-range"
      [min]="min()"
      [max]="max"
      [dateFilter]="filter"
    />
  `,
})
class ValidatedHost {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  readonly min = signal(Temporal.PlainDate.from('2026-06-10'));
  max = Temporal.PlainDate.from('2026-06-20');
  filter = (d: Temporal.PlainDate) => d.day !== 12;
}

function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const root = fixture.nativeElement as HTMLElement;
  const els = root.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — validation', () => {
  beforeEach(setup);

  it('reports ngxDtRangeStart for an unparseable start', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });

  it('reports ngxDtRangeEnd for an unparseable end', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeEnd')).toBe(true);
  });

  it('reports ngxDtRangeOrder when end is before start', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-18');
    type(end, '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtMin when an end is below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-01');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax when an end is above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, '2026-06-25');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('reports ngxDtFilter for a filtered-out end', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-12');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtFilter')).toBe(true);
  });

  it('passes for an in-range, ordered range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13');
    type(end, '2026-06-18');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('re-validates when the picker min tightens past the current range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13');
    type(end, '2026-06-18');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();

    fixture.componentInstance.min.set(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });
});

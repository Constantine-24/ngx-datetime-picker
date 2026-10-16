import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtStartDateTime,
} from './ngx-dt-datetime-range-input';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateTimeAdapter(),
    ],
  });
}

@Component({
  imports: [
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDateTime />
      <input ngxDtEndDateTime />
    </ngx-dt-datetime-range-input>
    <ngx-dt-picker
      #picker
      [inline]="true"
      type="datetime-range"
      [min]="min()"
      [max]="max"
    />
  `,
})
class ValidatedHost {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly min = signal(Temporal.PlainDateTime.from('2026-06-10T08:00'));
  max = Temporal.PlainDateTime.from('2026-06-20T20:00');
}

@Component({
  imports: [
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDateTime />
      <input ngxDtEndDateTime />
    </ngx-dt-datetime-range-input>
    <ngx-dt-picker
      #picker
      [inline]="true"
      type="datetime-range"
      [dateFilter]="dateFilter()"
    />
  `,
})
class ValidatedHostWithFilter {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly dateFilter = signal<(d: Temporal.PlainDateTime) => boolean>(() => true);
}

function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateTimeRangeInput — validation', () => {
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

  it('reports ngxDtRangeOrder when end is before start on a different day', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-18T09:00');
    type(end, '2026-06-15T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtRangeOrder when end is earlier than start on the SAME day', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-15T14:00');
    type(end, '2026-06-15T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtMin when an end is below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-09T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax when an end is above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, '2026-06-25T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('passes for an in-range, ordered range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13T10:00');
    type(end, '2026-06-18T16:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('re-validates when the picker min tightens past the current range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13T10:00');
    type(end, '2026-06-18T16:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();

    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-15T10:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtFilter when an end datetime is on a filtered-out day', async () => {
    setup();
    const fixture = TestBed.createComponent(ValidatedHostWithFilter);
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d as unknown as Temporal.PlainDate, Temporal.PlainDate.from('2026-06-25')) !== 0,
    );
    await fixture.whenStable();
    const [start, end] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];
    start.value = '2026-06-21T09:00';
    start.dispatchEvent(new Event('input'));
    end.value = '2026-06-25T17:00';
    end.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });

  it('passes validation when start and end are on allowed days', async () => {
    setup();
    const fixture = TestBed.createComponent(ValidatedHostWithFilter);
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d as unknown as Temporal.PlainDate, Temporal.PlainDate.from('2026-06-25')) !== 0,
    );
    await fixture.whenStable();
    const [start, end] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];
    start.value = '2026-06-21T09:00';
    start.dispatchEvent(new Event('input'));
    end.value = '2026-06-22T17:00';
    end.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });
});

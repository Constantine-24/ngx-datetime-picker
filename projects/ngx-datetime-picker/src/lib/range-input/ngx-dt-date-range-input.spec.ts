import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtStartDate,
} from './ngx-dt-date-range-input';

@Component({
  imports: [
    NgxDtDateRangeInput,
    NgxDtStartDate,
    NgxDtEndDate,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-date-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDate #start="ngxDtStartDate" />
      <input ngxDtEndDate #end="ngxDtEndDate" />
    </ngx-dt-date-range-input>
    <ngx-dt-picker #picker [inline]="true" type="date-range" />
  `,
})
class Host {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
}

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

function inputs(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = fixture.nativeElement.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — text I/O', () => {
  beforeEach(setup);

  it('aggregates typed start + end into a DateRange model value', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = inputs(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDate.from('2026-06-10'));
    expect(value.end).toEqual(Temporal.PlainDate.from('2026-06-20'));
  });

  it('writes a DateRange model down into both inputs (formatted)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDate.from('2026-06-10'),
        Temporal.PlainDate.from('2026-06-20'),
      ),
    );
    fixture.detectChanges();

    const { start, end } = inputs(fixture);
    expect(start.value).toBe('6/10/2026');
    expect(end.value).toBe('6/20/2026');
  });

  it('disables both inputs through the control', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    const { start, end } = inputs(fixture);
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);
  });
});

describe('NgxDtDateRangeInput — picker bridge', () => {
  beforeEach(setup);

  it('reflects a calendar range selection into both inputs and the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const cells = Array.from(
      root.querySelectorAll<HTMLElement>('.mat-calendar-body-cell'),
    );
    cells[4].click(); // start
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end
    fixture.detectChanges();
    await fixture.whenStable();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start?.day).toBe(5);
    expect(value.end?.day).toBe(10);
    const { start, end } = inputs(fixture);
    expect(start.value).toMatch(/\d+\/\d+\/\d{4}/);
    expect(end.value).toMatch(/\d+\/\d+\/\d{4}/);
  });

  it('opens the picker on Alt+ArrowDown from the start input', async () => {
    @Component({
      imports: [NgxDtDateRangeInput, NgxDtStartDate, NgxDtEndDate, NgxDtPicker],
      template: `
        <ngx-dt-date-range-input [rangePicker]="picker">
          <input ngxDtStartDate />
          <input ngxDtEndDate />
        </ngx-dt-date-range-input>
        <ngx-dt-picker #picker type="date-range" />
      `,
    })
    class OverlayHost {
      readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
    }
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const start = fixture.nativeElement.querySelector('input')!;
    start.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
  });
});

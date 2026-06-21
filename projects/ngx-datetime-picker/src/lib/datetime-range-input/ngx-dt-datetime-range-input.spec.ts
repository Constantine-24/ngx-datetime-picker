import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtStartDateTime,
} from './ngx-dt-datetime-range-input';

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
      <input ngxDtStartDateTime #start="ngxDtStartDateTime" />
      <input ngxDtEndDateTime #end="ngxDtEndDateTime" />
    </ngx-dt-datetime-range-input>
    <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
  `,
})
class Host {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
}

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

describe('NgxDtDateTimeRangeInput — text I/O', () => {
  beforeEach(setup);

  it('aggregates typed start + end into a DateRange of PlainDateTime', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = inputs(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDateTime.from('2026-06-10T09:30'));
    expect(value.end).toEqual(Temporal.PlainDateTime.from('2026-06-20T17:45'));
  });

  it('writes a DateRange model down into both inputs (formatted)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:30'),
        Temporal.PlainDateTime.from('2026-06-20T17:45'),
      ),
    );
    fixture.detectChanges();

    const { start, end } = inputs(fixture);
    // Locale display: date + 24h time. Assert robustly rather than exact glyphs.
    expect(start.value).toMatch(/2026/);
    expect(start.value).toMatch(/09:30/);
    expect(end.value).toMatch(/2026/);
    expect(end.value).toMatch(/17:45/);
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

  it('does not re-emit when an invalid keystroke leaves the value unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const directive = fixture.debugElement.query(
      By.directive(NgxDtDateTimeRangeInput),
    ).componentInstance as NgxDtDateTimeRangeInput<Temporal.PlainDateTime>;
    const emissions: DateRange<Temporal.PlainDateTime>[] = [];
    directive.rangeChange.subscribe((r) => emissions.push(r));

    const { start } = inputs(fixture);
    type(start, 'garbage');
    type(start, 'still garbage');
    fixture.detectChanges();

    expect(emissions.length).toBe(0);
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });
});

describe('NgxDtDateTimeRangeInput — picker bridge', () => {
  beforeEach(setup);

  it('reflects a calendar range selection into both inputs and the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mat-calendar-body-cell',
      ),
    );
    cells[4].click(); // start
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end
    fixture.detectChanges();
    await fixture.whenStable();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toBeInstanceOf(Temporal.PlainDateTime);
    expect(value.start?.day).toBe(5);
    expect(value.end?.day).toBe(10);
    const { start, end } = inputs(fixture);
    expect(start.value).toMatch(/2026/);
    expect(end.value).toMatch(/2026/);
  });

  it('setRangeFromPicker does not re-emit when the range is unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const container = fixture.debugElement.query(
      By.directive(NgxDtDateTimeRangeInput),
    ).componentInstance as NgxDtDateTimeRangeInput<Temporal.PlainDateTime>;
    const emissions: DateRange<Temporal.PlainDateTime>[] = [];
    container.rangeChange.subscribe((r) => emissions.push(r));

    container.setRangeFromPicker(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );
    container.setRangeFromPicker(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );

    expect(emissions.length).toBe(1);
  });

  it('opens the picker on Alt+ArrowDown from the start input', async () => {
    @Component({
      imports: [
        NgxDtDateTimeRangeInput,
        NgxDtStartDateTime,
        NgxDtEndDateTime,
        NgxDtPicker,
      ],
      template: `
        <ngx-dt-datetime-range-input [rangePicker]="picker">
          <input ngxDtStartDateTime />
          <input ngxDtEndDateTime />
        </ngx-dt-datetime-range-input>
        <ngx-dt-picker #picker type="datetime-range" />
      `,
    })
    class OverlayHost {
      readonly picker =
        viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
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

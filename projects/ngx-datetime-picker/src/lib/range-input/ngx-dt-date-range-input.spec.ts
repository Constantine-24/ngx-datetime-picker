import { Component, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateRangeInput, NgxDtEndDate, NgxDtStartDate } from './ngx-dt-date-range-input';

// Specs click calendar cells by index and assume the calendar opens on June 2026.
// Pin "today" (Date only, so real timers keep fixture.whenStable() working).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-20T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

@Component({
  imports: [NgxDtDateRangeInput, NgxDtStartDate, NgxDtEndDate, NgxDtPicker, ReactiveFormsModule],
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
      new DateRange(Temporal.PlainDate.from('2026-06-10'), Temporal.PlainDate.from('2026-06-20')),
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

  it('does not re-emit the value when an invalid keystroke leaves it unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const directive = fixture.debugElement.query(
      (de) => de.componentInstance instanceof NgxDtDateRangeInput,
    ).componentInstance as NgxDtDateRangeInput<Temporal.PlainDate>;
    const emissions: DateRange<Temporal.PlainDate>[] = [];
    directive.rangeChange.subscribe((range) => emissions.push(range));

    const { start } = inputs(fixture);
    type(start, 'garbage');
    type(start, 'still garbage');
    fixture.detectChanges();

    // Both keystrokes parse to null, which equals the initial null start — no
    // value transition, so the committed range value is never re-emitted.
    expect(emissions.length).toBe(0);
    // Validator notifications still fire, so the parse error surfaces.
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });
});

describe('NgxDtDateRangeInput — picker bridge', () => {
  beforeEach(setup);

  it('reflects a calendar range selection into both inputs and the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    const cells = Array.from(root.querySelectorAll<HTMLElement>('.mat-calendar-body-cell'));
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

  it('setRangeFromPicker does not re-emit when the range is unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const container = fixture.debugElement.query(By.directive(NgxDtDateRangeInput))
      .componentInstance as NgxDtDateRangeInput<Temporal.PlainDate>;
    const emissions: DateRange<Temporal.PlainDate>[] = [];
    container.rangeChange.subscribe((r) => emissions.push(r));

    container.setRangeFromPicker(
      new DateRange(Temporal.PlainDate.from('2026-06-10'), Temporal.PlainDate.from('2026-06-20')),
    );
    // Identical values, different instance — must NOT re-emit.
    container.setRangeFromPicker(
      new DateRange(Temporal.PlainDate.from('2026-06-10'), Temporal.PlainDate.from('2026-06-20')),
    );

    expect(emissions.length).toBe(1);
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

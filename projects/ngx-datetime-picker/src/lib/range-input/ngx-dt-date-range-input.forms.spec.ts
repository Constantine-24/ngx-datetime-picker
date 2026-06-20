import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DateRange,
  NgxDtDateRangeInput,
  NgxDtEndDate,
  NgxDtPicker,
  NgxDtStartDate,
} from 'ngx-datetime-picker';

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
function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const root = fixture.nativeElement as HTMLElement;
  const els = root.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('NgxDtDateRangeInput — Reactive Forms', () => {
  beforeEach(setup);

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
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  }

  it('round-trips model <-> view', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDate.from('2026-06-10'),
        Temporal.PlainDate.from('2026-06-20'),
      ),
    );
    fixture.detectChanges();
    const { start, end } = startEnd(fixture);
    expect(start.value).toBe('6/10/2026');
    expect(end.value).toBe('6/20/2026');

    type(start, '2026-07-01');
    type(end, '2026-07-09');
    fixture.detectChanges();
    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDate.from('2026-07-01'));
    expect(value.end).toEqual(Temporal.PlainDate.from('2026-07-09'));
  });
});

describe('NgxDtDateRangeInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateRangeInput,
      NgxDtStartDate,
      NgxDtEndDate,
      NgxDtPicker,
      FormsModule,
    ],
    template: `
      <ngx-dt-date-range-input [rangePicker]="picker" [(ngModel)]="value">
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class NgModelHost {
    value: DateRange<Temporal.PlainDate> | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value?.start).toEqual(
      Temporal.PlainDate.from('2026-06-10'),
    );
    expect(fixture.componentInstance.value?.end).toEqual(
      Temporal.PlainDate.from('2026-06-20'),
    );
  });
});

describe('NgxDtDateRangeInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateRangeInput,
      NgxDtStartDate,
      NgxDtEndDate,
      NgxDtPicker,
      FormField,
    ],
    template: `
      <ngx-dt-date-range-input [rangePicker]="picker" [formField]="f.range">
        <input ngxDtStartDate />
        <input ngxDtEndDate />
      </ngx-dt-date-range-input>
      <ngx-dt-picker #picker [inline]="true" type="date-range" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ range: DateRange<Temporal.PlainDate> }>({
      range: new DateRange<Temporal.PlainDate>(null, null),
    });
    readonly f = form(this.model);
  }

  it('binds the range through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10');
    type(end, '2026-06-20');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.range().value().start).toEqual(
      Temporal.PlainDate.from('2026-06-10'),
    );
    expect(fixture.componentInstance.f.range().value().end).toEqual(
      Temporal.PlainDate.from('2026-06-20'),
    );

    fixture.componentInstance.f
      .range()
      .value.set(
        new DateRange(
          Temporal.PlainDate.from('2026-07-01'),
          Temporal.PlainDate.from('2026-07-09'),
        ),
      );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(start.value).toBe('7/1/2026');
    expect(end.value).toBe('7/9/2026');
  });
});

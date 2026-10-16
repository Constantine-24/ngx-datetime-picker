import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DateRange,
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtPicker,
  NgxDtStartDateTime,
} from '@constantine-24/ngx-datetime-picker';

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
function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('NgxDtDateTimeRangeInput — Reactive Forms', () => {
  beforeEach(setup);

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
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" [hourCycle]="hourCycle()" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
    readonly hourCycle = signal<12 | 24 | null>(null);
  }

  it('round-trips model <-> view', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.componentInstance.hourCycle.set(24);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:30'),
        Temporal.PlainDateTime.from('2026-06-20T17:45'),
      ),
    );
    fixture.detectChanges();
    const { start, end } = startEnd(fixture);
    expect(start.value).toMatch(/09:30/);
    expect(end.value).toMatch(/17:45/);

    type(start, '2026-07-01T08:00');
    type(end, '2026-07-09T18:00');
    fixture.detectChanges();
    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDateTime.from('2026-07-01T08:00'));
    expect(value.end).toEqual(Temporal.PlainDateTime.from('2026-07-09T18:00'));
  });
});

describe('NgxDtDateTimeRangeInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateTimeRangeInput,
      NgxDtStartDateTime,
      NgxDtEndDateTime,
      NgxDtPicker,
      FormsModule,
    ],
    template: `
      <ngx-dt-datetime-range-input [rangePicker]="picker" [(ngModel)]="value">
        <input ngxDtStartDateTime />
        <input ngxDtEndDateTime />
      </ngx-dt-datetime-range-input>
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
    `,
  })
  class NgModelHost {
    value: DateRange<Temporal.PlainDateTime> | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value?.start).toEqual(
      Temporal.PlainDateTime.from('2026-06-10T09:30'),
    );
    expect(fixture.componentInstance.value?.end).toEqual(
      Temporal.PlainDateTime.from('2026-06-20T17:45'),
    );
  });
});

describe('NgxDtDateTimeRangeInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateTimeRangeInput,
      NgxDtStartDateTime,
      NgxDtEndDateTime,
      NgxDtPicker,
      FormField,
    ],
    template: `
      <ngx-dt-datetime-range-input [rangePicker]="picker" [formField]="f.range">
        <input ngxDtStartDateTime />
        <input ngxDtEndDateTime />
      </ngx-dt-datetime-range-input>
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ range: DateRange<Temporal.PlainDateTime> }>({
      range: new DateRange<Temporal.PlainDateTime>(null, null),
    });
    readonly f = form(this.model);
  }

  it('binds the range through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.range().value().start).toEqual(
      Temporal.PlainDateTime.from('2026-06-10T09:30'),
    );
    expect(fixture.componentInstance.f.range().value().end).toEqual(
      Temporal.PlainDateTime.from('2026-06-20T17:45'),
    );
  });
});

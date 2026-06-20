import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
import { NgxDtPicker, NgxDtTimeInput } from 'ngx-datetime-picker';
import { beforeEach, describe, expect, it } from 'vitest';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalTimeAdapter(),
    ],
  });
}

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="time" />
  `,
})
class ReactiveHost {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainTime | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, FormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [(ngModel)]="value" />
    <ngx-dt-picker #picker type="time" />
  `,
})
class NgModelHost {
  picker = viewChild.required(NgxDtPicker);
  value: Temporal.PlainTime | null = null;
}

describe('NgxDtTimeInput forms integration', () => {
  beforeEach(setup);

  it('reactive: writeValue formats the control value into the field', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('13:45'));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(el.value).toContain('45');
  });

  it('reactive: typing updates the control value', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    el.value = '06:15';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value!.minute).toBe(15);
  });

  it('ngModel: round-trips a value', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.componentInstance.value = Temporal.PlainTime.from('22:10');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(el.value).toContain('10');
  });
});

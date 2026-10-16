import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateTimeInput } from './ngx-dt-datetime-input';

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="datetime" />
  `,
})
class ReactiveHost {
  ctrl = new FormControl<Temporal.PlainDateTime | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, FormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [(ngModel)]="value" />
    <ngx-dt-picker #picker type="datetime" />
  `,
})
class NgModelHost {
  value: Temporal.PlainDateTime | null = null;
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

describe('NgxDtDateTimeInput — forms', () => {
  beforeEach(setup);

  it('Reactive: writeValue formats the field, typing updates the control', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T08:15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.value).toContain('08');

    el.value = '2026-06-21T20:45';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value!.hour).toBe(20);
  });

  it('ngModel: round-trips a PlainDateTime', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.componentInstance.value = Temporal.PlainDateTime.from('2026-06-21T11:00');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(el.value).toContain('11');

    el.value = '2026-06-21T12:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value!.hour).toBe(12);
  });
});

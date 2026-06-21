import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateTimeInput } from './ngx-dt-datetime-input';

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="datetime" [min]="min()" [max]="max()" [hourCycle]="hourCycle()" />
  `,
})
class Host {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainDateTime | null>(null);
  min = signal<Temporal.PlainDateTime | null>(null);
  max = signal<Temporal.PlainDateTime | null>(null);
  hourCycle = signal<12 | 24 | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="datetime" [dateFilter]="dateFilter()" />
  `,
})
class HostWithFilter {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainDate | null>(null);
  dateFilter = signal<(d: Temporal.PlainDate) => boolean>(() => true);
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

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function input(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}

describe('NgxDtDateTimeInput', () => {
  beforeEach(setup);

  it('parses typed ISO datetime into a PlainDateTime on the control', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = '2026-06-21T14:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.ctrl.value!;
    expect(v.day).toBe(21);
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(30);
  });

  it('flags unparseable text with a parse error and null value', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = 'nonsense';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value).toBeNull();
    expect(fixture.componentInstance.ctrl.errors).toEqual({
      ngxDtParse: { text: 'nonsense' },
    });
  });

  it('reports ngxDtMin / ngxDtMax against the picker bounds', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T09:00'));
    fixture.componentInstance.max.set(Temporal.PlainDateTime.from('2026-06-21T17:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T08:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMin']).toBeTruthy();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T18:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMax']).toBeTruthy();
  });

  it('setValueFromPicker formats into the field and updates the control', async () => {
    const fixture = await render();
    const dir = fixture.debugElement
      .query(By.directive(NgxDtDateTimeInput))
      .injector.get(NgxDtDateTimeInput);
    dir.setValueFromPicker(Temporal.PlainDateTime.from('2026-06-21T07:05'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input(fixture).value).toContain('07');
    expect(fixture.componentInstance.ctrl.value!.hour).toBe(7);
  });

  it('Alt+ArrowDown opens the picker', async () => {
    const fixture = await render();
    input(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });

  it('formats the field honoring the picker hourCycle (12h shows AM/PM)', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(12);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T14:30'));
    await fixture.whenStable();
    expect(el.value).toMatch(/PM/i);
  });

  it('formats the field in 24h when hourCycle is 24', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(24);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T14:30'));
    await fixture.whenStable();
    expect(el.value).toContain('14:30');
    expect(el.value).not.toMatch(/PM/i);
  });

  it('reports ngxDtFilter when the typed datetime falls on a filtered-out day', async () => {
    setup();
    const fixture = TestBed.createComponent(HostWithFilter);
    // Disallow 2026-06-21 specifically (compare the date part).
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d, Temporal.PlainDate.from('2026-06-21')) !== 0,
    );
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    el.value = '2026-06-21T10:00';
    el.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });

  it('passes validation for a datetime on an allowed day', async () => {
    setup();
    const fixture = TestBed.createComponent(HostWithFilter);
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d, Temporal.PlainDate.from('2026-06-21')) !== 0,
    );
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    el.value = '2026-06-22T10:00';
    el.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });
});

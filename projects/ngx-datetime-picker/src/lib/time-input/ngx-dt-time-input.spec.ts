import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtTimeInput } from './ngx-dt-time-input';

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="time" [min]="min()" [max]="max()" [hourCycle]="hourCycle()" [timeFilter]="timeFilter()" />
  `,
})
class Host {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainTime | null>(null);
  min = signal<Temporal.PlainTime | null>(null);
  max = signal<Temporal.PlainTime | null>(null);
  hourCycle = signal<12 | 24 | null>(null);
  timeFilter = signal<(t: Temporal.PlainTime) => boolean>(() => true);
}

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

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function input(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return (fixture.nativeElement as HTMLElement).querySelector('input')!;
}

describe('NgxDtTimeInput', () => {
  beforeEach(setup);

  it('parses typed text into a PlainTime on the control', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = '14:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.ctrl.value!;
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

  it('reports ngxDtMin when below the picker min', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.min.set(Temporal.PlainTime.from('09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('08:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMin']).toBeTruthy();
  });

  it('reports ngxDtMax when above the picker max', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.max.set(Temporal.PlainTime.from('17:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('18:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMax']).toBeTruthy();
  });

  it('setValueFromPicker formats the time into the field and updates the control', async () => {
    const fixture = await render();
    const dir = fixture.debugElement
      .query(By.directive(NgxDtTimeInput))
      .injector.get(NgxDtTimeInput);
    dir.setValueFromPicker(Temporal.PlainTime.from('07:05'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input(fixture).value).toContain('05');
    expect(fixture.componentInstance.ctrl.value!.hour).toBe(7);
  });

  it('Alt+ArrowDown opens the picker', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });

  it('formats the field in 12h when the picker hourCycle is 12', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(12);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('14:30'));
    await fixture.whenStable();
    expect(el.value).toMatch(/PM/i);
    expect(el.value).toContain('2:30');
  });

  it('formats the field in 24h when the picker hourCycle is 24', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(24);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('14:30'));
    await fixture.whenStable();
    expect(el.value).toContain('14:30');
    expect(el.value).not.toMatch(/PM/i);
  });

  it('reports ngxDtFilter when the typed time is filtered out', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.timeFilter.set((t) => t.minute % 15 === 0);
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    el.value = '10:07';
    el.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });
});

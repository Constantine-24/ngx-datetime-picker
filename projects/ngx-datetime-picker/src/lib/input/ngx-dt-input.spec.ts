import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtInput } from './ngx-dt-input';

@Component({
  imports: [NgxDtInput, NgxDtPicker],
  template: `
    <input [ngxDtInput]="picker" #input="ngxDtInput" (dateChange)="changed.set($event)" />
    <ngx-dt-picker #picker [inline]="true" />
  `,
})
class Host {
  readonly changed = signal<Temporal.PlainDate | null | undefined>(undefined);
  readonly input = viewChild.required<NgxDtInput<Temporal.PlainDate>>('input');
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

function inputEl(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}

function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtInput — value binding & parsing', () => {
  beforeEach(setup);

  it('parses typed ISO text into a date and emits dateChange', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();

    expect(fixture.componentInstance.input().value()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );
    expect(fixture.componentInstance.changed()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );
  });

  it('resolves unparseable text to null', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), 'not a date');
    fixture.detectChanges();

    expect(fixture.componentInstance.input().value()).toBeNull();
  });

  it('reformats the text to the display format on blur', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = inputEl(fixture);
    type(el, '2026-06-15');
    el.dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(el.value).toBe('6/15/2026');
  });

  it('shows the calendar selection as formatted text (picker -> input)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const cell: HTMLElement = fixture.nativeElement.querySelector('.mat-calendar-body-cell');
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(inputEl(fixture).value).toMatch(/\d+\/\d+\/\d{4}/);
    expect(fixture.componentInstance.input().value()).toBeInstanceOf(Temporal.PlainDate);
  });
});

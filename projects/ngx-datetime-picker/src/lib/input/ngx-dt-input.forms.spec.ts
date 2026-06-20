import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtInput, NgxDtPicker } from 'ngx-datetime-picker';

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

function el(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('NgxDtInput — Reactive Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
    template: `
      <input [ngxDtInput]="picker" [formControl]="ctrl" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<Temporal.PlainDate | null>(null);
  }

  it('writes model -> text and text -> model', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    expect(el(fixture).value).toBe('6/15/2026');

    type(el(fixture), '2026-07-04');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.value).toEqual(Temporal.PlainDate.from('2026-07-04'));
  });

  it('disables the input via the control', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    expect(el(fixture).disabled).toBe(true);
  });
});

describe('NgxDtInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, FormsModule],
    template: `
      <input [ngxDtInput]="picker" [(ngModel)]="value" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class NgModelHost {
    value: Temporal.PlainDate | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    type(el(fixture), '2026-06-15');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value).toEqual(Temporal.PlainDate.from('2026-06-15'));
  });
});

describe('NgxDtInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, FormField],
    template: `
      <input [ngxDtInput]="picker" [formField]="f.date" />
      <ngx-dt-picker #picker [inline]="true" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ date: Temporal.PlainDate | null }>({ date: null });
    readonly f = form(this.model);
  }

  it('binds value through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    // view -> field state
    type(el(fixture), '2026-06-15');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.date().value()).toEqual(
      Temporal.PlainDate.from('2026-06-15'),
    );

    // field state -> view
    fixture.componentInstance.f.date().value.set(Temporal.PlainDate.from('2026-07-04'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el(fixture).value).toBe('7/4/2026');
  });
});

import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
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
    expect(fixture.componentInstance.changed()).toEqual(Temporal.PlainDate.from('2026-06-15'));
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

  it('emits dateChange when the calendar selection flows into the input', async () => {
    // Host already wires (dateChange)="changed.set($event)" and exposes
    // input() as NgxDtInput and picker() as NgxDtPicker.
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    // Drive the picker -> input seam directly (as the calendar does).
    fixture.componentInstance.input().setValueFromPicker(Temporal.PlainDate.from('2026-06-21'));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.changed()?.toString()).toBe('2026-06-21');
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

describe('NgxDtInput — keyboard open', () => {
  beforeEach(setup);

  it('opens the picker on Alt+ArrowDown anchored to the input', async () => {
    @Component({
      imports: [NgxDtInput, NgxDtPicker],
      template: `
        <input [ngxDtInput]="picker" />
        <ngx-dt-picker #picker />
      `,
    })
    class OverlayInputHost {
      readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
    }

    const fixture = TestBed.createComponent(OverlayInputHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const el = inputEl(fixture);
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
  });

  it('does not open on Alt+ArrowDown when disabled', async () => {
    @Component({
      imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
      template: `
        <input [ngxDtInput]="picker" [formControl]="ctrl" />
        <ngx-dt-picker #picker />
      `,
    })
    class DisabledInputHost {
      readonly ctrl = new FormControl<Temporal.PlainDate | null>({ value: null, disabled: true });
      readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
    }

    const fixture = TestBed.createComponent(DisabledInputHost);
    fixture.detectChanges();
    await fixture.whenStable();

    inputEl(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(false);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeNull();
  });
});

describe('NgxDtInput — validators', () => {
  beforeEach(setup);

  @Component({
    imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
    template: `
      <input [ngxDtInput]="picker" [formControl]="ctrl" />
      <ngx-dt-picker #picker [inline]="true" [min]="min" [max]="max" [dateFilter]="filter" />
    `,
  })
  class ValidatedHost {
    readonly ctrl = new FormControl<Temporal.PlainDate | null>(null);
    min = Temporal.PlainDate.from('2026-06-10');
    max = Temporal.PlainDate.from('2026-06-20');
    filter = (d: Temporal.PlainDate) => d.day !== 12;
  }

  it('reports ngxDtParse for unparseable text', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtParse')).toBe(true);
  });

  it('reports ngxDtMin below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-01');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-25');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('reports ngxDtFilter for a filtered-out date', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-12');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtFilter')).toBe(true);
  });

  it('passes validation for an in-range, allowed date', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('clears a prior parse error once valid text is typed', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtParse')).toBe(true);

    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('re-validates when the picker constraints change', async () => {
    @Component({
      imports: [NgxDtInput, NgxDtPicker, ReactiveFormsModule],
      template: `
        <input [ngxDtInput]="picker" [formControl]="ctrl" />
        <ngx-dt-picker #picker [inline]="true" [min]="min()" />
      `,
    })
    class ConstraintHost {
      readonly ctrl = new FormControl<Temporal.PlainDate | null>(null);
      readonly min = signal(Temporal.PlainDate.from('2026-06-10'));
    }

    const fixture = TestBed.createComponent(ConstraintHost);
    fixture.detectChanges();
    await fixture.whenStable();

    type(inputEl(fixture), '2026-06-15');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();

    // Tighten min above the typed value — the directive's effect must re-validate
    // even though the control value itself is unchanged.
    fixture.componentInstance.min.set(Temporal.PlainDate.from('2026-06-16'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });
});

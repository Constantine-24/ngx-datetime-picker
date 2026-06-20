import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from './ngx-dt-picker';

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      #picker
      [inline]="true"
      [(value)]="value"
    />
  `,
})
class InlineHost {
  value = signal<Temporal.PlainDate | null>(null);
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

describe('NgxDtPicker — inline', () => {
  beforeEach(setup);

  it('renders a MatCalendar inline', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('mat-calendar'),
    ).toBeTruthy();
  });

  it('writes the picked date back through [(value)]', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const cell: HTMLElement = fixture.nativeElement.querySelector(
      '.mat-calendar-body-cell',
    );
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBeInstanceOf(
      Temporal.PlainDate,
    );
  });
});

import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtToggle } from './ngx-dt-toggle';

@Component({
  imports: [NgxDtPicker, NgxDtToggle],
  template: `
    <ngx-dt-toggle [for]="picker" />
    <ngx-dt-picker #picker="ngxDtPicker" [(value)]="value" />
  `,
})
class ToggleHost {
  value = signal<Temporal.PlainDate | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtToggle],
  template: `
    <ngx-dt-toggle [for]="picker" [disabled]="true" />
    <ngx-dt-picker #picker="ngxDtPicker" [(value)]="value" />
  `,
})
class ToggleHostDisabled {
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

describe('NgxDtToggle', () => {
  beforeEach(setup);

  function button(fixture: { nativeElement: HTMLElement }) {
    return fixture.nativeElement.querySelector<HTMLButtonElement>('button.ngx-dt-toggle-button')!;
  }

  it('renders a button with aria-haspopup=dialog and collapsed state', () => {
    const fixture = TestBed.createComponent(ToggleHost);
    fixture.detectChanges();
    const btn = button(fixture);
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the picker on click and reflects aria-expanded', async () => {
    const fixture = TestBed.createComponent(ToggleHost);
    fixture.detectChanges();
    button(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
    expect(button(fixture).getAttribute('aria-expanded')).toBe('true');
  });

  it('reflects the disabled state on the button', async () => {
    const fixture = TestBed.createComponent(ToggleHostDisabled);
    await fixture.whenStable();
    const btn = fixture.nativeElement.querySelector('.ngx-dt-toggle-button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
